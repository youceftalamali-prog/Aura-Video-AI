/** DORMANT — Phase 12 active provider is PayPal. This file is not wired. */
import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { workspaces, subscriptions } from '../../../db/schema.js';
import { AppError } from '@aura/shared';
import { getEnv } from '@aura/config';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import { getStripe, isStripeConfigured } from '../providers/stripe.provider.js';
import {
  PLAN_IDS,
  PLAN_META,
  CREDIT_PACKAGES,
  priceIdForPlan,
  priceIdForCredits,
  requireStripeConfig,
  type PlanKey,
  type CreditPackageKey,
} from '../providers/plans.js';

export class StripeBillingService {
  constructor(
    private readonly db: Database,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  private async getWorkspaceForUser(userId: string) {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return ws;
  }

  private async ensureStripeCustomer(userId: string, email?: string): Promise<{ workspaceId: string; customerId: string }> {
    requireStripeConfig();
    const ws = await this.getWorkspaceForUser(userId);
    const row = await this.db.select().from(workspaces).where(eq(workspaces.id, ws.id)).limit(1);
    const current = row[0];
    if (current?.stripeCustomerId) {
      return { workspaceId: ws.id, customerId: current.stripeCustomerId };
    }
    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: email || undefined,
      metadata: { workspaceId: ws.id, userId },
    });
    await this.db
      .update(workspaces)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(workspaces.id, ws.id));
    return { workspaceId: ws.id, customerId: customer.id };
  }

  listPlans() {
    return (Object.keys(PLAN_IDS) as unknown as PlanKey[]).map((key) => ({
      key,
      planId: PLAN_IDS[key],
      name: PLAN_META[key].name,
      includedCredits: PLAN_META[key].includedCredits,
      priceConfigured: Boolean(
        key === 'starter'
          ? getEnv().STRIPE_PRICE_STARTER
          : key === 'pro'
            ? getEnv().STRIPE_PRICE_PRO
            : getEnv().STRIPE_PRICE_BUSINESS,
      ),
    }));
  }

  listCreditPackages() {
    return (Object.keys(CREDIT_PACKAGES) as unknown as CreditPackageKey[]).map((key) => ({
      key,
      ...CREDIT_PACKAGES[key],
      priceConfigured: Boolean(
        key === 'small'
          ? getEnv().STRIPE_PRICE_CREDITS_SMALL
          : key === 'medium'
            ? getEnv().STRIPE_PRICE_CREDITS_MEDIUM
            : getEnv().STRIPE_PRICE_CREDITS_LARGE,
      ),
    }));
  }

  getPublishableKey(): string | null {
    if (!isStripeConfigured()) return null;
    return getEnv().STRIPE_PUBLISHABLE_KEY || null;
  }

  async createSubscriptionCheckout(userId: string, plan: PlanKey, email?: string) {
    requireStripeConfig();
    if (!(plan in PLAN_IDS)) {
      throw new AppError('Invalid billing plan', 400, 'INVALID_BILLING_PLAN');
    }
    const priceId = priceIdForPlan(plan);
    const { workspaceId, customerId } = await this.ensureStripeCustomer(userId, email);
    const env = getEnv();
    try {
      const session = await getStripe().checkout.sessions.create(
        {
          mode: 'subscription',
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: env.STRIPE_CANCEL_URL,
          metadata: {
            workspaceId,
            userId,
            purchaseType: 'subscription',
            planId: plan,
          },
          subscription_data: {
            metadata: {
              workspaceId,
              userId,
              planId: plan,
            },
          },
        },
        { idempotencyKey: `sub_checkout_${workspaceId}_${plan}_${Date.now()}` },
      );
      if (!session.url) {
        throw new AppError('Stripe did not return a checkout URL', 502, 'STRIPE_CHECKOUT_FAILED');
      }
      return { checkoutUrl: session.url, sessionId: session.id };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Stripe checkout failed: ${(err as unknown as Error).message}`,
        502,
        'STRIPE_CHECKOUT_FAILED',
      );
    }
  }

  async createCreditCheckout(userId: string, pkg: CreditPackageKey, email?: string) {
    requireStripeConfig();
    if (!(pkg in CREDIT_PACKAGES)) {
      throw new AppError('Invalid credit package', 400, 'INVALID_CREDIT_PACKAGE');
    }
    const priceId = priceIdForCredits(pkg);
    const { workspaceId, customerId } = await this.ensureStripeCustomer(userId, email);
    const env = getEnv();
    try {
      const session = await getStripe().checkout.sessions.create(
        {
          mode: 'payment',
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: env.STRIPE_CANCEL_URL,
          metadata: {
            workspaceId,
            userId,
            purchaseType: 'credits',
            creditPackage: pkg,
            credits: String(CREDIT_PACKAGES[pkg].credits),
          },
        },
        { idempotencyKey: `credits_checkout_${workspaceId}_${pkg}_${Date.now()}` },
      );
      if (!session.url) {
        throw new AppError('Stripe did not return a checkout URL', 502, 'STRIPE_CHECKOUT_FAILED');
      }
      return { checkoutUrl: session.url, sessionId: session.id };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Stripe checkout failed: ${(err as unknown as Error).message}`,
        502,
        'STRIPE_CHECKOUT_FAILED',
      );
    }
  }

  async createPortalSession(userId: string) {
    requireStripeConfig();
    const ws = await this.getWorkspaceForUser(userId);
    const row = await this.db.select().from(workspaces).where(eq(workspaces.id, ws.id)).limit(1);
    const customerId = row[0]?.stripeCustomerId;
    if (!customerId) {
      throw new AppError('No Stripe customer for this workspace', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    try {
      const session = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: getEnv().STRIPE_SUCCESS_URL.replace('/success', ''),
      });
      return { url: session.url };
    } catch (err) {
      throw new AppError(
        `Stripe portal failed: ${(err as unknown as Error).message}`,
        502,
        'STRIPE_PORTAL_FAILED',
      );
    }
  }

  async cancelSubscription(userId: string) {
    requireStripeConfig();
    const ws = await this.getWorkspaceForUser(userId);
    const subRows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, ws.id))
      .limit(1);
    const sub = subRows[0];
    if (!sub?.externalId) {
      throw new AppError('No active Stripe subscription', 404, 'BILLING_CUSTOMER_NOT_FOUND');
    }
    const updated = await getStripe().subscriptions.update(sub.externalId, {
      cancel_at_period_end: true,
    });
    await this.db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        status: updated.status,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));
    return { status: updated.status, cancelAtPeriodEnd: true };
  }
}
