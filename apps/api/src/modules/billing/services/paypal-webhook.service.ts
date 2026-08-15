import { eq, and, or, lte, desc } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { subscriptions, paypalWebhookEvents, workspaces } from '../../../db/schema.js';
import { AppError } from '@aura/shared';
import { CreditLedgerService } from '../../video/services/credit-ledger.service.js';
import { verifyPayPalWebhook, paypalRequest } from '../providers/paypal.provider.js';
import { PLAN_IDS, PLAN_META, type PlanKey, type CreditPackageKey, CREDIT_PACKAGES } from '../providers/plans.js';

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', event, ts: new Date().toISOString(), ...payload }));
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
}

export class PayPalWebhookService {
  private readonly ledger: CreditLedgerService;

  constructor(private readonly db: Database) {
    this.ledger = new CreditLedgerService(db);
  }

  async handleRaw(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true; duplicate?: boolean }> {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const valid = await verifyPayPalWebhook(headers, bodyStr);
    if (!valid) {
      throw new AppError('PayPal webhook verification failed', 400, 'PAYPAL_WEBHOOK_INVALID');
    }

    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(bodyStr) as PayPalWebhookEvent;
    } catch {
      throw new AppError('Invalid PayPal webhook payload', 400, 'PAYPAL_WEBHOOK_INVALID');
    }
    if (!event.id || !event.event_type || !event.resource || typeof event.resource !== 'object') {
      throw new AppError('Invalid PayPal webhook payload', 400, 'PAYPAL_WEBHOOK_INVALID');
    }

    // Atomic idempotency: UNIQUE(paypal_event_id). Insert first to claim the event.
    try {
      await this.db.insert(paypalWebhookEvents).values({
        paypalEventId: event.id,
        eventType: event.event_type,
      });
    } catch (err) {
      const msg = String((err as unknown as Error)?.message || err);
      if (/unique|duplicate|23505/i.test(msg)) {
        log('paypal_webhook_duplicate', { eventId: event.id, type: event.event_type });
        return { received: true, duplicate: true };
      }
      throw err;
    }

    try {
      await this.dispatch(event);
    } catch (err) {
      // Allow PayPal to retry: un-claim the event so a later delivery can reprocess.
      try {
        await this.db
          .delete(paypalWebhookEvents)
          .where(eq(paypalWebhookEvents.paypalEventId, event.id));
      } catch {
        /* best-effort */
      }
      log('paypal_webhook_handler_error', {
        eventId: event.id,
        type: event.event_type,
        error: (err as unknown as Error).message,
      });
      throw err;
    }

    return { received: true };
  }

  private async dispatch(event: PayPalWebhookEvent): Promise<void> {
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.onCaptureCompleted(event.resource);
        break;
      case 'CHECKOUT.ORDER.APPROVED':
        await this.onOrderApproved(event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.CREATED':
        await this.onSubscriptionUpsert(event.resource, false);
        break;
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.onSubscriptionUpsert(event.resource, true);
        break;
      case 'BILLING.SUBSCRIPTION.UPDATED':
        await this.onSubscriptionUpsert(event.resource, false);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await this.onSubscriptionPayment(event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.onSubscriptionCancelled(event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await this.onSubscriptionStatus(event.resource, 'past_due');
        break;
      default:
        log('paypal_webhook_ignored', { type: event.event_type });
    }
  }

  private async onOrderApproved(resource: Record<string, unknown>): Promise<void> {
    const orderId = String(resource.id || '');
    if (!orderId) return;
    try {
      await paypalRequest('POST', `/v2/checkout/orders/${orderId}/capture`, {});
      log('paypal_order_captured', { orderId });
    } catch (err) {
      // PayPal can redeliver an approval after a successful capture. Confirm the
      // remote state before deciding whether this delivery should be retried.
      try {
        const current = await paypalRequest<{ status?: string }>('GET', `/v2/checkout/orders/${orderId}`);
        if (String(current.status || '').toUpperCase() === 'COMPLETED') {
          log('paypal_order_already_captured', { orderId });
          return;
        }
      } catch {
        /* preserve the original capture error */
      }
      throw err;
    }
  }

  private async onCaptureCompleted(resource: Record<string, unknown>): Promise<void> {
    let customId = String(resource.custom_id || '');
    if (!customId) customId = await this.resolveCustomIdFromCapture(resource);
    if (!customId) {
      log('paypal_capture_no_custom_id', { captureId: resource.id });
      return;
    }

    // format: workspaceId|userId|credits|pkg|creditsAmount
    const parts = customId.split('|');
    if (parts.length >= 5 && parts[2] === 'credits') {
      const workspaceId = parts[0]!;
      const pkg = parts[3] as CreditPackageKey;
      const expected = CREDIT_PACKAGES[pkg];
      const declaredCredits = Number(parts[4]);
      if (!expected || declaredCredits !== expected.credits) {
        throw new AppError('Invalid credit package in PayPal custom_id', 400, 'INVALID_CREDIT_PACKAGE');
      }
      const captureId = String(resource.id || 'unknown');
      await this.ledger.grant(workspaceId, expected.credits, {
        description: 'PayPal credit purchase',
        referenceType: 'paypal_capture',
        referenceId: captureId,
        idempotencyKey: `paypal:capture:${captureId}`,
      });
      log('paypal_credits_granted', { workspaceId, credits: expected.credits, captureId: resource.id });
    }
  }

  private async resolveCustomIdFromCapture(resource: Record<string, unknown>): Promise<string> {
    const supplementary = resource.supplementary_data as Record<string, unknown> | undefined;
    const related = supplementary?.related_ids as Record<string, unknown> | undefined;
    const orderId = related?.order_id ? String(related.order_id) : '';
    if (!orderId) return '';
    try {
      const order = await paypalRequest<{ purchase_units?: Array<{ custom_id?: string }> }>(
        'GET',
        `/v2/checkout/orders/${orderId}`,
      );
      return String(order.purchase_units?.[0]?.custom_id || '');
    } catch {
      return '';
    }
  }

  private async onSubscriptionUpsert(resource: Record<string, unknown>, grantCredits = false): Promise<void> {
    const subId = String(resource.id || '');
    let custom: { workspaceId?: string; userId?: string; planId?: string } = {};
    try {
      custom = JSON.parse(String(resource.custom_id || '{}')) as typeof custom;
    } catch {
      custom = {};
    }
    const workspaceId = custom.workspaceId;
    const userId = custom.userId;
    const planKey = custom.planId as PlanKey | undefined;

    if (!workspaceId) {
      log('paypal_subscription_no_workspace', { subscriptionId: subId });
      return;
    }
    if (!planKey || !(planKey in PLAN_IDS)) {
      throw new AppError('Invalid PayPal subscription plan', 400, 'INVALID_BILLING_PLAN');
    }

    const planUuid = PLAN_IDS[planKey];
    const status = String(resource.status || 'ACTIVE').toLowerCase();
    const mapped =
      status === 'active'
        ? 'active'
        : status === 'suspended'
          ? 'past_due'
          : status === 'cancelled' || status === 'canceled'
            ? 'canceled'
            : status;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const existing = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspaceId))
      .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt))
      .limit(1);

    const sameSubscription = existing[0]?.externalId === subId;
    const alreadyGranted = Boolean(existing[0]?.periodCreditsGranted);

    if (existing[0]) {
      await this.db
        .update(subscriptions)
        .set({
          planId: planUuid,
          status: mapped,
          externalId: subId,
          currentPeriodStart: sameSubscription && alreadyGranted ? existing[0].currentPeriodStart : now,
          currentPeriodEnd: sameSubscription && alreadyGranted ? existing[0].currentPeriodEnd : periodEnd,
          periodCreditsGranted: sameSubscription ? alreadyGranted : false,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing[0].id));
    } else {
      const ownerId = userId || (await this.ownerOf(workspaceId));
      await this.db.insert(subscriptions).values({
        userId: ownerId,
        workspaceId,
        planId: planUuid,
        status: mapped,
        interval: 'month',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        externalId: subId,
      });
    }
    log('paypal_subscription_synced', { workspaceId, subId, status: mapped });

    if (grantCredits && mapped === 'active') {
      const credits = PLAN_META[planKey].includedCredits;
      if (credits > 0) {
        await this.claimPeriodGrant({
          workspaceId,
          subId,
          credits,
          planKey,
          periodKey: now.toISOString(),
        });
      }
    }
  }

  private async claimPeriodGrant(input: {
    workspaceId: string;
    subId: string;
    credits: number;
    planKey: string;
    periodKey: string;
  }): Promise<void> {
    const { workspaceId, subId, credits, planKey, periodKey } = input;
    await this.db.transaction(async (tx) => {
      const claimed = await tx
        .update(subscriptions)
        .set({ periodCreditsGranted: true })
        .where(
          and(
            eq(subscriptions.workspaceId, workspaceId),
            eq(subscriptions.externalId, subId),
            eq(subscriptions.periodCreditsGranted, false),
          ),
        )
        .returning({ id: subscriptions.id });
      if (claimed.length === 0) {
        log('paypal_period_credits_skipped', { workspaceId, subId, reason: 'already_granted' });
        return;
      }
      await new CreditLedgerService(tx).grant(workspaceId, credits, {
        description: 'PayPal subscription period credits',
        referenceType: 'paypal_subscription_period',
        referenceId: `${subId}:${periodKey}`,
        idempotencyKey: `paypal:subscription:${subId}:${periodKey}`,
      });
      log('paypal_subscription_credits_granted', { workspaceId, credits, subId, planKey });
    });
  }

  private async onSubscriptionPayment(resource: Record<string, unknown>): Promise<void> {
    const billingAgreementId = String(resource.billing_agreement_id || resource.billing_agreement || '');
    if (!billingAgreementId) {
      log('paypal_sale_no_agreement', { id: resource.id });
      return;
    }
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.externalId, billingAgreementId))
      .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt))
      .limit(1);
    const sub = rows[0];
    if (!sub?.workspaceId) {
      log('paypal_sale_unknown_subscription', { billingAgreementId });
      return;
    }
    if (sub.periodCreditsGranted && new Date() < sub.currentPeriodEnd) {
      log('paypal_sale_cycle_already_granted', { billingAgreementId, workspaceId: sub.workspaceId });
      return;
    }
    const planKey =
      (Object.keys(PLAN_IDS) as PlanKey[]).find((k) => PLAN_IDS[k] === sub.planId) || 'starter';
    const credits = PLAN_META[planKey]?.includedCredits ?? 0;
    if (credits <= 0) return;
    const now = new Date();
    await this.db.transaction(async (tx) => {
      const claimed = await tx
        .update(subscriptions)
        .set({
          periodCreditsGranted: true,
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          status: 'active',
          updatedAt: now,
        })
        .where(
          and(
            eq(subscriptions.id, sub.id),
            or(eq(subscriptions.periodCreditsGranted, false), lte(subscriptions.currentPeriodEnd, now)),
          ),
        )
        .returning({ id: subscriptions.id });
      if (claimed.length === 0) {
        log('paypal_sale_cycle_already_granted', { billingAgreementId, workspaceId: sub.workspaceId });
        return;
      }
      await new CreditLedgerService(tx).grant(sub.workspaceId, credits, {
        description: 'PayPal subscription renewal credits',
        referenceType: 'paypal_subscription_period',
        referenceId: `${billingAgreementId}:${now.toISOString()}`,
        idempotencyKey: `paypal:subscription:${billingAgreementId}:${now.toISOString()}`,
      });
      log('paypal_subscription_renewal_credits', {
        workspaceId: sub.workspaceId,
        credits,
        billingAgreementId,
      });
    });
  }

  private async onSubscriptionCancelled(resource: Record<string, unknown>): Promise<void> {
    const subId = String(resource.id || '');
    await this.db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.externalId, subId));
  }

  private async onSubscriptionStatus(resource: Record<string, unknown>, status: string): Promise<void> {
    const subId = String(resource.id || '');
    await this.db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.externalId, subId));
  }

  private async ownerOf(workspaceId: string): Promise<string> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (!rows[0]) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return rows[0].ownerId;
  }
}
