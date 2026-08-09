import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { subscriptions, videoGenerationJobs, workspaces } from '../../../db/schema.js';
import { AppError, NotFoundError } from '@aura/shared';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import type { CreditRepository } from '../../../domain/repositories/credit.repository.js';
import { CreditLedgerService } from '../../video/services/credit-ledger.service.js';
import { getEnv } from '@aura/config';

export interface WalletSummary {
  workspaceId: string;
  balance: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
  updatedAt: string;
}

export interface SubscriptionSummary {
  id: string;
  planId: string;
  status: string;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface CreditUsageItem {
  jobId: string;
  status: string;
  creditsCharged: number;
  mode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BillingOverview {
  wallet: WalletSummary;
  subscription: SubscriptionSummary | null;
  recentUsage: CreditUsageItem[];
  estimateSample: ReturnType<CreditLedgerService['estimateCost']>;
}

export class BillingService {
  private readonly ledger: CreditLedgerService;

  constructor(
    private readonly db: Database,
    private readonly workspaces: WorkspaceRepository,
    private readonly credits: CreditRepository,
  ) {
    this.ledger = new CreditLedgerService(db);
  }

  private async workspaceId(userId: string): Promise<string> {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return ws.id;
  }

  async getOverview(userId: string): Promise<BillingOverview> {
    const workspaceId = await this.workspaceId(userId);
    let wallet = await this.credits.findByWorkspaceId(workspaceId);
    if (!wallet) {
      wallet = await this.credits.create(workspaceId, 0);
    }

    const subRows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const sub = subRows[0];
    const usageRows = await this.db
      .select({
        id: videoGenerationJobs.id,
        status: videoGenerationJobs.status,
        creditsCharged: videoGenerationJobs.creditsCharged,
        input: videoGenerationJobs.input,
        createdAt: videoGenerationJobs.createdAt,
        completedAt: videoGenerationJobs.completedAt,
      })
      .from(videoGenerationJobs)
      .where(eq(videoGenerationJobs.workspaceId, workspaceId))
      .orderBy(desc(videoGenerationJobs.createdAt))
      .limit(20);

    return {
      wallet: {
        workspaceId,
        balance: wallet.balance,
        lifetimeGranted: wallet.lifetimeGranted,
        lifetimeUsed: wallet.lifetimeUsed,
        updatedAt: new Date(wallet.updatedAt).toISOString(),
      },
      subscription: sub
        ? {
            id: sub.id,
            planId: sub.planId,
            status: sub.status,
            interval: sub.interval,
            currentPeriodStart: new Date(sub.currentPeriodStart).toISOString(),
            currentPeriodEnd: new Date(sub.currentPeriodEnd).toISOString(),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          }
        : null,
      recentUsage: usageRows.map((r) => {
        const input = (r.input || {}) as unknown as Record<string, unknown>;
        const mode = typeof input.mode === 'string' ? input.mode : null;
        return {
          jobId: r.id,
          status: r.status,
          creditsCharged: r.creditsCharged,
          mode,
          createdAt: new Date(r.createdAt).toISOString(),
          completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
        };
      }),
      estimateSample: this.ledger.estimateCost({ duration: 15, sceneCount: 4, mode: 'storyboard' }),
    };
  }

  async getBalance(userId: string): Promise<{ balance: number; workspaceId: string }> {
    const workspaceId = await this.workspaceId(userId);
    const balance = await this.ledger.getBalance(workspaceId);
    return { balance, workspaceId };
  }

  async estimate(userId: string, input: { duration: number; sceneCount: number; mode: 'text_to_video' | 'image_to_video' | 'storyboard' }) {
    await this.workspaceId(userId);
    return this.ledger.estimateCost(input);
  }

  /**
   * Top-up requires an external billing provider. Never invent payment success.
   */
  async requestTopUp(userId: string, amount: number): Promise<never> {
    await this.workspaceId(userId);
    if (amount <= 0 || amount > 1_000_000) {
      throw new AppError('Invalid top-up amount', 400, 'INVALID_TOP_UP_AMOUNT');
    }
    const env = getEnv() as unknown as Record<string, unknown>;
    const configured = Boolean(env.STRIPE_SECRET_KEY || env.BILLING_PROVIDER_API_KEY);
    if (!configured) {
      throw new AppError(
        'Billing provider is not configured. Set STRIPE_SECRET_KEY or BILLING_PROVIDER_API_KEY to enable credit purchases.',
        503,
        'BILLING_PROVIDER_NOT_CONFIGURED',
      );
    }
    throw new AppError(
      'Billing provider adapter is configured but checkout is not fully enabled for this environment.',
      501,
      'BILLING_CHECKOUT_NOT_IMPLEMENTED',
    );
  }

  async getWorkspace(userId: string) {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new NotFoundError('Workspace');
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      ownerId: ws.ownerId,
      createdAt: new Date(ws.createdAt).toISOString(),
      updatedAt: new Date(ws.updatedAt).toISOString(),
    };
  }

  async updateWorkspaceName(userId: string, name: string) {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new NotFoundError('Workspace');
    if (ws.ownerId !== userId) {
      throw new AppError('Only workspace owner can update settings', 403, 'FORBIDDEN');
    }
    const rows = await this.db
      .update(workspaces)
      .set({ name, updatedAt: new Date() })
      .where(eq(workspaces.id, ws.id))
      .returning();
    const updated = rows[0]!;
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      ownerId: updated.ownerId,
      createdAt: new Date(updated.createdAt).toISOString(),
      updatedAt: new Date(updated.updatedAt).toISOString(),
    };
  }
}
