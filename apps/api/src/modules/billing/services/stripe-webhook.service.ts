/** DORMANT — Phase 12 active provider is PayPal. This file is not wired. */
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import type { Database } from '../../../db/client.js';
import { subscriptions, stripeWebhookEvents, workspaces } from '../../../db/schema.js';
import { AppError } from '@aura/shared';
import { CreditLedgerService } from '../../video/services/credit-ledger.service.js';
import { constructWebhookEvent } from '../providers/stripe.provider.js';
import { PLAN_IDS, CREDIT_PACKAGES, type PlanKey, type CreditPackageKey } from '../providers/plans.js';

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', event, ts: new Date().toISOString(), ...payload }));
}

export class StripeWebhookService {
  private readonly ledger: CreditLedgerService;

  constructor(private readonly db: Database) {
    this.ledger = new CreditLedgerService(db);
  }

  async handleRaw(rawBody: Buffer, signature: string): Promise<{ received: true; duplicate?: boolean }> {
    const event = constructWebhookEvent(rawBody, signature);

    // Idempotency: insert event id; unique constraint fails if already processed
    try {
      await this.db.insert(stripeWebhookEvents).values({
        stripeEventId: event.id,
        eventType: event.type,
      });
    } catch {
      log('stripe_webhook_duplicate', { eventId: event.id, type: event.type });
      return { received: true, duplicate: true };
    }

    try {
      await this.dispatch(event);
    } catch (err) {
      log('stripe_webhook_handler_error', {
        eventId: event.id,
        type: event.type,
        error: (err as unknown as Error).message,
      });
      // Event is marked processed to avoid infinite retry loops on logic bugs;
      // critical payment failures should be monitored via logs.
      throw err;
    }

    return { received: true };
  }

  private async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as unknown as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubscriptionUpsert(event.data.object as unknown as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as unknown as Stripe.Subscription);
        break;
      case 'invoice.paid':
        log('stripe_invoice_paid', { invoiceId: (event.data.object as unknown as Stripe.Invoice).id });
        break;
      case 'invoice.payment_failed':
        log('stripe_invoice_payment_failed', { invoiceId: (event.data.object as unknown as Stripe.Invoice).id });
        break;
      default:
        log('stripe_webhook_ignored', { type: event.type });
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const meta = session.metadata || {};
    const workspaceId = meta.workspaceId;
    const userId = meta.userId;
    const purchaseType = meta.purchaseType;

    if (!workspaceId || !userId) {
      log('stripe_checkout_missing_metadata', { sessionId: session.id });
      return;
    }

    if (purchaseType === 'credits') {
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        log('stripe_checkout_credits_not_paid', { sessionId: session.id, payment_status: session.payment_status });
        return;
      }
      const pkg = meta.creditPackage as unknown as CreditPackageKey;
      const creditsFromMeta = Number(meta.credits);
      const credits =
        Number.isFinite(creditsFromMeta) && creditsFromMeta > 0
          ? creditsFromMeta
          : CREDIT_PACKAGES[pkg]?.credits;
      if (!credits) {
        throw new AppError('Invalid credit package in checkout metadata', 400, 'INVALID_CREDIT_PACKAGE');
      }
      await this.ledger.grant(workspaceId, credits);
      log('stripe_credits_granted', { workspaceId, credits, sessionId: session.id });
      return;
    }

    if (purchaseType === 'subscription' && session.subscription) {
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      // Full sync via subscription retrieve is handled by subscription.* events;
      // ensure row exists with external id.
      const planKey = (meta.planId as unknown as PlanKey) || 'starter';
      const planUuid = PLAN_IDS[planKey] || PLAN_IDS.starter;
      await this.upsertSubscriptionRow({
        workspaceId,
        userId,
        stripeSubscriptionId: subId,
        planUuid,
        status: 'active',
        cancelAtPeriodEnd: false,
      });
    }
  }

  private async onSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
    const meta = sub.metadata || {};
    let workspaceId = meta.workspaceId;
    const userId = meta.userId;

    if (!workspaceId && typeof sub.customer === 'string') {
      const rows = await this.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.stripeCustomerId, sub.customer))
        .limit(1);
      workspaceId = rows[0]?.id;
    }
    if (!workspaceId) {
      log('stripe_subscription_no_workspace', { subscriptionId: sub.id });
      return;
    }

    const planKey = (meta.planId as unknown as PlanKey) || 'starter';
    const planUuid = PLAN_IDS[planKey] || PLAN_IDS.starter;
    const periodStart = new Date((sub.current_period_start || 0) * 1000);
    const periodEnd = new Date((sub.current_period_end || 0) * 1000);

    await this.upsertSubscriptionRow({
      workspaceId,
      userId: userId || (await this.ownerOf(workspaceId)),
      stripeSubscriptionId: sub.id,
      planUuid,
      status: sub.status,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      periodStart,
      periodEnd,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    });
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({
        status: 'canceled',
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.externalId, sub.id));
  }

  private async ownerOf(workspaceId: string): Promise<string> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (!rows[0]) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return rows[0].ownerId;
  }

  private async upsertSubscriptionRow(input: {
    workspaceId: string;
    userId: string;
    stripeSubscriptionId: string;
    planUuid: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    periodStart?: Date;
    periodEnd?: Date;
    canceledAt?: Date | null;
  }): Promise<void> {
    const existing = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, input.workspaceId))
      .limit(1);

    const now = new Date();
    const periodStart = input.periodStart || now;
    const periodEnd = input.periodEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (existing[0]) {
      await this.db
        .update(subscriptions)
        .set({
          planId: input.planUuid,
          status: input.status,
          externalId: input.stripeSubscriptionId,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          canceledAt: input.canceledAt ?? existing[0].canceledAt,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing[0].id));
    } else {
      await this.db.insert(subscriptions).values({
        userId: input.userId,
        workspaceId: input.workspaceId,
        planId: input.planUuid,
        status: input.status,
        interval: 'month',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        canceledAt: input.canceledAt ?? null,
        externalId: input.stripeSubscriptionId,
      });
    }
  }
}
