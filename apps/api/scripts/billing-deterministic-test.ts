/**
 * Phase 11 billing boundary checks. No database, network, or payment provider call.
 * Run with: pnpm --filter @aura/api test:billing
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/aura_test_dummy';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'billing-test-secret-0123456789abcdef0123456789';

import { estimateBodySchema, topUpBodySchema, workspaceUpdateSchema } from '../src/modules/billing/dto/schemas.js';
import { CREDIT_PACKAGES, PLAN_IDS } from '../src/modules/billing/providers/plans.js';
import { PayPalBillingService } from '../src/modules/billing/services/paypal-billing.service.js';

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

function main(): void {
  check(
    'accepts a valid cost estimate',
    estimateBodySchema.safeParse({ duration: 15, sceneCount: 4, mode: 'storyboard' }).success,
  );
  check(
    'rejects unknown estimate fields',
    !estimateBodySchema.safeParse({ duration: 15, sceneCount: 4, mode: 'storyboard', modelId: 'secret-model' }).success,
  );
  check('accepts explicit credit package checkout', topUpBodySchema.safeParse({ package: 'medium' }).success);
  check('accepts legacy amount checkout', topUpBodySchema.safeParse({ amount: 500 }).success);
  check('rejects empty top-up request', !topUpBodySchema.safeParse({}).success);
  check('trims workspace names', workspaceUpdateSchema.parse({ name: '  Aura Workspace  ' }).name === 'Aura Workspace');
  check('rejects blank workspace names', !workspaceUpdateSchema.safeParse({ name: '   ' }).success);
  check('has three configured plan keys', Object.keys(PLAN_IDS).length === 3);
  check('has three credit packages', Object.keys(CREDIT_PACKAGES).length === 3);

  // listCreditPackages must remain usable on the billing visibility page even
  // when PayPal pricing secrets are absent.
  const service = new PayPalBillingService(null as never, null as never);
  const packages = service.listCreditPackages();
  check('lists credit packages without payment configuration', packages.length === 3);
  check('marks unavailable pricing as not configured', packages.every((p) => p.priceConfigured === false));

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
