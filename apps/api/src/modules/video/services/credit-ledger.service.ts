import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { creditWallets } from '../../../db/schema.js';
import { AppError } from '@aura/shared';
import type { VideoCostEstimate, VideoGenerationMode } from '@aura/types';

type LedgerExecutor = Pick<Database, 'execute' | 'select'>;

type LedgerTransactionRow = {
  transactionType: string;
  amount: number;
  balanceAfter: number;
};

type WalletRow = {
  id: string;
  balance: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
};

export interface CreditMutationOptions {
  userId?: string | null;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  /** A stable key makes retries safe and must identify one logical mutation. */
  idempotencyKey?: string;
}

export class CreditLedgerService {
  constructor(private readonly db: LedgerExecutor) {}

  estimateCost(input: {
    duration: number;
    sceneCount: number;
    mode: VideoGenerationMode;
  }): VideoCostEstimate {
    const base = 10;
    const perSecond = 1;
    const perScene = 2;
    const modeBonus = input.mode === 'image_to_video' ? 5 : input.mode === 'storyboard' ? 8 : 0;
    const durationCost = Math.ceil(input.duration) * perSecond;
    const sceneCost = input.sceneCount * perScene;
    const total = base + durationCost + sceneCost + modeBonus;

    return {
      credits: total,
      duration: input.duration,
      sceneCount: input.sceneCount,
      mode: input.mode,
      breakdown: [
        { item: 'base', credits: base },
        { item: 'duration', credits: durationCost },
        { item: 'scenes', credits: sceneCost },
        { item: 'mode', credits: modeBonus },
      ],
    };
  }

  async getBalance(workspaceId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(creditWallets)
      .where(sql`${creditWallets.workspaceId} = ${workspaceId}`)
      .limit(1);
    return rows[0]?.balance ?? 0;
  }

  /**
   * Atomic usage deduction. The wallet row is locked inside a database
   * transaction and the append-only ledger entry is written with it.
   */
  async deduct(workspaceId: string, amount: number, options: CreditMutationOptions = {}): Promise<number> {
    return this.mutate('usage', workspaceId, amount, options);
  }

  /**
   * Refunds are idempotent when the same logical job/reference is retried.
   */
  async refund(workspaceId: string, amount: number, options: CreditMutationOptions = {}): Promise<number> {
    return this.mutate('refund', workspaceId, amount, options);
  }

  /**
   * Grants credits after a verified payment or subscription event.
   */
  async grant(workspaceId: string, amount: number, options: CreditMutationOptions = {}): Promise<number> {
    return this.mutate('grant', workspaceId, amount, options);
  }

  private async mutate(
    transactionType: 'grant' | 'usage' | 'refund',
    workspaceId: string,
    amount: number,
    options: CreditMutationOptions,
  ): Promise<number> {
    this.assertAmount(amount);
    const idempotencyKey = options.idempotencyKey ?? `${transactionType}:${workspaceId}:${randomUUID()}`;
    if (!idempotencyKey.trim() || idempotencyKey.length > 255) {
      throw new AppError('Credit mutation idempotency key is invalid', 400, 'INVALID_CREDIT_MUTATION');
    }

    return this.withTransaction(async (db) => {
      // Granting may be the first operation for a workspace. Creating the row
      // before locking it also makes concurrent first grants safe.
      await db.execute(sql`
        INSERT INTO credit_wallets (
          id, workspace_id, balance, lifetime_granted, lifetime_used, created_at, updated_at
        )
        VALUES (gen_random_uuid(), ${workspaceId}, 0, 0, 0, NOW(), NOW())
        ON CONFLICT (workspace_id) DO NOTHING
      `);

      const walletRows = this.rows<WalletRow>(await db.execute(sql`
        SELECT
          id,
          balance,
          lifetime_granted AS "lifetimeGranted",
          lifetime_used AS "lifetimeUsed"
        FROM credit_wallets
        WHERE workspace_id = ${workspaceId}
        FOR UPDATE
      `));
      const wallet = walletRows[0];
      if (!wallet) {
        throw new AppError('Credit wallet not found', 404, 'CREDIT_WALLET_NOT_FOUND');
      }

      const existingRows = this.rows<LedgerTransactionRow>(await db.execute(sql`
        SELECT
          transaction_type AS "transactionType",
          amount,
          balance_after AS "balanceAfter"
        FROM credit_transactions
        WHERE workspace_id = ${workspaceId}
          AND idempotency_key = ${idempotencyKey}
        LIMIT 1
      `));
      const existing = existingRows[0];
      const signedAmount = transactionType === 'usage' ? -amount : amount;

      if (existing) {
        if (existing.transactionType !== transactionType || Number(existing.amount) !== signedAmount) {
          throw new AppError(
            'Credit mutation idempotency key was reused for a different operation',
            409,
            'CREDIT_MUTATION_CONFLICT',
          );
        }
        return Number(existing.balanceAfter);
      }

      if (transactionType === 'usage' && Number(wallet.balance) < amount) {
        throw new AppError('Insufficient credits', 402, 'INSUFFICIENT_CREDITS');
      }
      if (transactionType === 'refund' && Number(wallet.lifetimeUsed) < amount) {
        throw new AppError('Refund exceeds used credits', 409, 'CREDIT_REFUND_EXCEEDS_USAGE');
      }

      const nextBalance = Number(wallet.balance) + signedAmount;
      const nextLifetimeGranted =
        transactionType === 'grant' ? Number(wallet.lifetimeGranted) + amount : Number(wallet.lifetimeGranted);
      const nextLifetimeUsed =
        transactionType === 'usage'
          ? Number(wallet.lifetimeUsed) + amount
          : transactionType === 'refund'
            ? Number(wallet.lifetimeUsed) - amount
            : Number(wallet.lifetimeUsed);

      const updatedRows = this.rows<{ balance: number }>(await db.execute(sql`
        UPDATE credit_wallets
        SET
          balance = ${nextBalance},
          lifetime_granted = ${nextLifetimeGranted},
          lifetime_used = ${nextLifetimeUsed},
          updated_at = NOW()
        WHERE id = ${wallet.id}
          AND workspace_id = ${workspaceId}
        RETURNING balance
      `));
      if (!updatedRows[0]) {
        throw new AppError('Credit wallet update failed', 409, 'CREDIT_WALLET_UPDATE_FAILED');
      }

      await db.execute(sql`
        INSERT INTO credit_transactions (
          wallet_id,
          workspace_id,
          user_id,
          transaction_type,
          amount,
          balance_after,
          description,
          reference_type,
          reference_id,
          idempotency_key,
          created_at
        )
        VALUES (
          ${wallet.id},
          ${workspaceId},
          ${options.userId ?? null},
          ${transactionType},
          ${signedAmount},
          ${nextBalance},
          ${options.description ?? null},
          ${options.referenceType ?? null},
          ${options.referenceId ?? null},
          ${idempotencyKey},
          NOW()
        )
      `);

      return nextBalance;
    });
  }

  private async withTransaction<T>(work: (db: LedgerExecutor) => Promise<T>): Promise<T> {
    // A normal Drizzle database exposes transaction(); a transaction object
    // passed by a caller intentionally does not, so it executes in its parent
    // transaction without opening a nested transaction.
    const candidate = this.db as unknown as {
      transaction?: (callback: (tx: LedgerExecutor) => Promise<T>) => Promise<T>;
    };
    if (typeof candidate.transaction === 'function') {
      return candidate.transaction(work);
    }
    return work(this.db);
  }

  private rows<T>(result: unknown): T[] {
    if (Array.isArray(result)) return result as T[];
    if (result && typeof result === 'object' && 'rows' in result) {
      const rows = (result as { rows?: unknown }).rows;
      return Array.isArray(rows) ? (rows as T[]) : [];
    }
    return [];
  }

  private assertAmount(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new AppError('Credit amount must be a positive integer', 400, 'INVALID_CREDIT_AMOUNT');
    }
  }
}
