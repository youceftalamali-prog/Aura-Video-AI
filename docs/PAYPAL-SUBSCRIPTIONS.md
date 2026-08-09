# PayPal Subscriptions — Aura Video AI

## Overview

Active billing provider is **PayPal**. Stripe modules remain in the repo but are **dormant**.

Flow:

```
Select plan → POST /api/v1/billing/checkout/subscription
  → PayPal Create Subscription → approve_url
  → User approves on PayPal
  → Webhooks (verified) → local subscription ACTIVE
  → Monthly credits granted (idempotent per webhook event)
```

**Return URL is not proof of payment.** Activation requires verified PayPal webhooks.

## Environment

```bash
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox   # or live
PAYPAL_WEBHOOK_ID=
PAYPAL_STARTER_PLAN_ID=      # PayPal Billing Plan ID
PAYPAL_PRO_PLAN_ID=
PAYPAL_BUSINESS_PLAN_ID=
PAYPAL_CURRENCY=USD
PAYPAL_CREDITS_SMALL_VALUE=9.99
PAYPAL_CREDITS_MEDIUM_VALUE=39.99
PAYPAL_CREDITS_LARGE_VALUE=99.99
PAYPAL_SUCCESS_URL=http://localhost:5173/billing/success
PAYPAL_CANCEL_URL=http://localhost:5173/billing/cancel
```

## Setup (Sandbox)

1. Create a PayPal Developer App (Sandbox).
2. Create a **Product** and **Billing Plans** (Starter / Pro / Business) with monthly intervals.
3. Copy each Plan ID into `PAYPAL_*_PLAN_ID`.
4. Create a Webhook pointing to `https://<api-host>/api/v1/billing/paypal/webhook`.
5. Subscribe to at least:
   - `BILLING.SUBSCRIPTION.CREATED`
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `PAYMENT.SALE.COMPLETED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `CHECKOUT.ORDER.APPROVED`
6. Copy Webhook ID into `PAYPAL_WEBHOOK_ID`.

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/billing/overview` | JWT | Plans, packs, current sub, balance |
| GET | `/api/v1/billing/subscription` | JWT | Subscription status |
| POST | `/api/v1/billing/checkout/subscription` | JWT | Body `{ plan: "starter"|"pro"|"business" }` → `{ checkoutUrl }` |
| POST | `/api/v1/billing/checkout/credits` | JWT | One-time credit packs |
| POST | `/api/v1/billing/subscription/cancel` | JWT | Cancel on PayPal + local |
| POST | `/api/v1/billing/paypal/webhook` | signature | Verified events |

## Plans (local catalog)

| Key | Monthly credits | Env plan ID |
|-----|-----------------|-------------|
| starter | 200 | `PAYPAL_STARTER_PLAN_ID` |
| pro | 1000 | `PAYPAL_PRO_PLAN_ID` |
| business | 5000 | `PAYPAL_BUSINESS_PLAN_ID` |

Plan keys are validated server-side. Frontend cannot set arbitrary prices.

## Idempotency

- Table `paypal_webhook_events` with unique `paypal_event_id`.
- Duplicate deliveries return `{ received: true, duplicate: true }` without re-applying side effects.
- Handler failures delete the claim so PayPal can retry.

## Credits

- **Subscription activation** (`BILLING.SUBSCRIPTION.ACTIVATED`): grants plan `includedCredits`.
- **Renewal** (`PAYMENT.SALE.COMPLETED`): grants plan credits again and rolls the billing period.
- **Credit packs** (`PAYMENT.CAPTURE.COMPLETED`): grants pack size from order `custom_id`.

Credits are never granted on return URL alone.

## Cancel

`POST /subscription/cancel` calls PayPal `POST /v1/billing/subscriptions/{id}/cancel` then updates local status.

## Security

- Secrets only on server.
- Webhook signature verified via PayPal Verify Webhook Signature API.
- Active subscription blocks creating a second active sub (`PAYPAL_SUBSCRIPTION_ALREADY_ACTIVE`).
- Stripe paths remain dormant.

## Production

Set `PAYPAL_ENVIRONMENT=live` and live Client ID / Secret / Plan IDs / Webhook ID.

## Troubleshooting

| Code | Meaning |
|------|---------|
| `BILLING_PROVIDER_NOT_CONFIGURED` | Missing client id/secret or plan IDs |
| `PAYPAL_AUTH_FAILED` | OAuth token failure |
| `PAYPAL_WEBHOOK_INVALID` | Signature verification failed |
| `PAYPAL_SUBSCRIPTION_ALREADY_ACTIVE` | Cancel existing sub first |
| `INVALID_BILLING_PLAN` | Unknown plan key |


## Production Audit Notes

- Active provider: **PayPal only**. Stripe services remain in repo but are not wired into `createBillingModule()`.
- Plan keys accepted by API: `starter` | `pro` | `business` (Zod-validated). Prices come from PayPal Plan IDs in env, never from the client.
- Webhook verification: PayPal `POST /v1/notifications/verify-webhook-signature` with `PAYPAL_WEBHOOK_ID`.
- Idempotency: unique `paypal_webhook_events.paypal_event_id`.
- Credits: granted on `BILLING.SUBSCRIPTION.ACTIVATED` and on `PAYMENT.SALE.COMPLETED` (renewal); packs on `PAYMENT.CAPTURE.COMPLETED`.
- Cancel: calls PayPal cancel API then sets local `status=canceled` (immediate).
- Duplicate active subscription: blocked with `PAYPAL_SUBSCRIPTION_ALREADY_ACTIVE`.
- Return URL is not used to grant credits or activate subscriptions.

