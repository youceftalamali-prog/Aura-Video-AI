/**
 * Phase 12 PayPal boundary checks. No database, network, or payment provider call.
 * Run with: pnpm --filter @aura/api test:paypal
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/aura_test_dummy';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'paypal-test-secret-0123456789abcdef0123456789';

for (const key of [
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'PAYPAL_STARTER_PLAN_ID',
  'PAYPAL_PRO_PLAN_ID',
  'PAYPAL_BUSINESS_PLAN_ID',
]) {
  delete process.env[key];
}

import { AppError } from '@aura/shared';
import { isPayPalConfigured, requirePayPalConfig } from '../src/modules/billing/providers/plans.js';
import { PayPalBillingService } from '../src/modules/billing/services/paypal-billing.service.js';
import { PayPalWebhookService } from '../src/modules/billing/services/paypal-webhook.service.js';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

async function errorCode(action: () => Promise<unknown> | unknown): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof AppError ? error.code : null;
  }
}

async function main(): Promise<void> {
  check('PayPal is disabled without credentials', !isPayPalConfigured());
  check('missing PayPal credentials return the expected error', errorCode(() => requirePayPalConfig()) === 'BILLING_PROVIDER_NOT_CONFIGURED');

  const billing = new PayPalBillingService(null as never, null as never);
  check(
    'credit checkout does not run without PayPal',
    (await errorCode(() => billing.createCreditCheckout('00000000-0000-4000-8000-000000000001', 'small'))) === 'BILLING_PROVIDER_NOT_CONFIGURED',
  );
  check(
    'subscription checkout does not run without PayPal',
    (await errorCode(() => billing.createSubscriptionCheckout('00000000-0000-4000-8000-000000000001', 'starter'))) === 'BILLING_PROVIDER_NOT_CONFIGURED',
  );

  const webhook = new PayPalWebhookService(null as never);
  check(
    'malformed webhook is rejected before verification',
    (await errorCode(() => webhook.handleRaw('{', {}))) === 'PAYPAL_WEBHOOK_INVALID',
  );

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
