# Aura Video AI — Phase 12 (PayPal)

**Active payment provider: PayPal** (Stripe files remain dormant/unused).

## Flow

### Credits
UI → POST `/billing/checkout/credits` → PayPal Order → buyer approves →  
webhook `CHECKOUT.ORDER.APPROVED` (capture) → `PAYMENT.CAPTURE.COMPLETED` →  
`CreditLedgerService.grant()` (idempotent via `paypal_webhook_events`)

### Subscriptions
UI → POST `/billing/checkout/subscription` → PayPal Subscription →  
webhook `BILLING.SUBSCRIPTION.ACTIVATED|UPDATED|CANCELLED` → `subscriptions` table

## Env
```
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=
PAYPAL_STARTER_PLAN_ID=
PAYPAL_PRO_PLAN_ID=
PAYPAL_BUSINESS_PLAN_ID=
PAYPAL_CURRENCY=USD
PAYPAL_CREDITS_SMALL_VALUE=9.99
PAYPAL_CREDITS_MEDIUM_VALUE=39.99
PAYPAL_CREDITS_LARGE_VALUE=99.99
PAYPAL_SUCCESS_URL=
PAYPAL_CANCEL_URL=
```

Missing credentials → `BILLING_PROVIDER_NOT_CONFIGURED`.

## Webhook
`POST /api/v1/billing/paypal/webhook`  
Verification: PayPal `/v1/notifications/verify-webhook-signature`  
Idempotency: `paypal_webhook_events.paypal_event_id` UNIQUE

## Never grant credits on
- checkout create
- success page load
- frontend claim

Only after verified `PAYMENT.CAPTURE.COMPLETED`.
