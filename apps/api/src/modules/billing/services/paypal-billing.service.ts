import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { subscriptions } from '../../../db/schema.js';
import { AppError } from '@aura/shared';
import { getEnv } from '@aura/config';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import { paypalRequest, isPayPalConfigured } from '../providers/paypal.provider.js';
import {
  PLAN_IDS,
  PLAN_META,
  CREDIT_PACKAGES,
  paypalPlanId,
  creditPackageValue,
  requirePayPalConfig,
  type PlanKey,
  type CreditPackageKey,
} from '../providers/plans.js';

interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  links?: PayPalLink[];
}

interface PayPalSubscription {
  id: string;
  status: string;
  links?: PayPalLink[];
}

function approveUrl(links?: PayPalLink[]): string {
  const link = links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
  if (!link?.href) {
    throw new AppError('PayPal did not return an approval URL', 502, 'PAYPAL_CHECKOUT_FAILED');
  }
  return link.href;
}

export class PayPalBillingService {
  constructor(
    private readonly db: Database,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  private async getWorkspaceForUser(userId: string) {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return ws;
  }

  listPlans() {
    const env = getEnv();
    return (Object.keys(PLAN_IDS) as unknown as PlanKey[]).map((key) => ({
      key,
      planId: PLAN_IDS[key],
      name: PLAN_META[key].name,
      includedCredits: PLAN_META[key].includedCredits,
      priceConfigured: Boolean(
        key === 'starter'
          ? env.PAYPAL_STARTER_PLAN_ID
          : key === 'pro'
            ? env.PAYPAL_PRO_PLAN_ID
            : env.PAYPAL_BUSINESS_PLAN_ID,
      ),
    }));
  }

  listCreditPackages() {
    return (Object.keys(CREDIT_PACKAGES) as unknown as CreditPackageKey[]).map((key) => ({
      key,
      ...CREDIT_PACKAGES[key],
      priceConfigured: isPayPalConfigured(),
      value: creditPackageValue(key).value,
      currency: creditPackageValue(key).currency,
    }));
  }

  getClientId(): string | null {
    if (!isPayPalConfigured()) return null;
    return getEnv().PAYPAL_CLIENT_ID || null;
  }

  async createSubscriptionCheckout(userId: string, plan: PlanKey) {
    requirePayPalConfig();
    if (!(plan in PLAN_IDS)) {
      throw new AppError('Invalid billing plan', 400, 'INVALID_BILLING_PLAN');
    }
    const planId = paypalPlanId(plan);
    const ws = await this.getWorkspaceForUser(userId);

    // Prevent duplicate ACTIVE subscriptions for the same workspace
    const existing = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, ws.id))
      .limit(1);
    if (existing[0] && existing[0].status === 'active' && existing[0].externalId) {
      throw new AppError(
        'An active subscription already exists. Cancel it before starting a new plan, or use upgrade flow.',
        409,
        'PAYPAL_SUBSCRIPTION_ALREADY_ACTIVE',
      );
    }

    const env = getEnv();
    try {
      const sub = await paypalRequest<PayPalSubscription>('POST', '/v1/billing/subscriptions', {
        plan_id: planId,
        custom_id: JSON.stringify({ workspaceId: ws.id, userId, planId: plan, purchaseType: 'subscription' }),
        application_context: {
          brand_name: 'Aura Video AI',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${env.PAYPAL_SUCCESS_URL}?provider=paypal&type=subscription`,
          cancel_url: env.PAYPAL_CANCEL_URL,
        },
      });
      return {
        checkoutUrl: approveUrl(sub.links),
        sessionId: sub.id,
        provider: 'paypal' as const,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`PayPal subscription failed: ${(err as unknown as Error).message}`, 502, 'PAYPAL_CHECKOUT_FAILED');
    }
  }

  async createCreditCheckout(userId: string, pkg: CreditPackageKey) {
    requirePayPalConfig();
    if (!(pkg in CREDIT_PACKAGES)) {
      throw new AppError('Invalid credit package', 400, 'INVALID_CREDIT_PACKAGE');
    }
    const ws = await this.getWorkspaceForUser(userId);
    const { value, currency, credits } = creditPackageValue(pkg);
    const env = getEnv();
    try {
      const order = await paypalRequest<PayPalOrder>('POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value,
            },
            description: `Aura Video AI credits pack: ${pkg} (${credits} credits)`,
            custom_id: `${ws.id}|${userId}|credits|${pkg}|${credits}`,
          },
        ],
        application_context: {
          brand_name: 'Aura Video AI',
          user_action: 'PAY_NOW',
          return_url: `${env.PAYPAL_SUCCESS_URL}?provider=paypal&type=credits`,
          cancel_url: env.PAYPAL_CANCEL_URL,
        },
      });
      return {
        checkoutUrl: approveUrl(order.links),
        sessionId: order.id,
        provider: 'paypal' as const,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`PayPal order failed: ${(err as unknown as Error).message}`, 502, 'PAYPAL_CHECKOUT_FAILED');
    }
  }

  /**
   * Capture a PayPal order after buyer approval (also done via webhook).
   * Does NOT grant credits — webhook fulfillment is authoritative for grants.
   */
  async captureOrder(orderId: string): Promise<{ status: string; orderId: string }> {
    requirePayPalConfig();
    const result = await paypalRequest<PayPalOrder>('POST', `/v2/checkout/orders/${orderId}/capture`, {});
    return { status: result.status, orderId: result.id };
  }

  async cancelSubscription(userId: string) {
    requirePayPalConfig();
    const ws = await this.getWorkspaceForUser(userId);
    const subRows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, ws.id))
      .limit(1);
    const sub = subRows[0];
    if (!sub?.externalId) {
      throw new AppError('No active PayPal subscription', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    await paypalRequest('POST', `/v1/billing/subscriptions/${sub.externalId}/cancel`, {
      reason: 'User requested cancellation',
    });
    // PayPal cancel ends the subscription on PayPal side immediately.
    await this.db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: false,
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));
    return { status: 'canceled', cancelAtPeriodEnd: false, canceledAt: new Date().toISOString() };
  }

  /** PayPal has no generic "portal" — return billing page path for UI compatibility */
  async createPortalSession(_userId: string) {
    requirePayPalConfig();
    return { url: '/billing', provider: 'paypal' as const, note: 'Manage subscriptions from billing page or PayPal account' };
  }

  async getSubscriptionStatus(userId: string) {
    const ws = await this.getWorkspaceForUser(userId);
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, ws.id))
      .limit(1);
    const sub = rows[0];
    if (!sub) {
      return {
        plan: null,
        status: 'none' as const,
        provider: 'paypal' as const,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        externalId: null,
      };
    }
    const planKey =
      (Object.keys(PLAN_IDS) as PlanKey[]).find((k) => PLAN_IDS[k] === sub.planId) || null;
    return {
      plan: planKey,
      planId: sub.planId,
      status: sub.status,
      provider: 'paypal' as const,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      externalId: sub.externalId,
      includedCredits: planKey ? PLAN_META[planKey].includedCredits : null,
    };
  }

}
