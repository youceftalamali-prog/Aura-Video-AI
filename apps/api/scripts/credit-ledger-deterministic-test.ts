/**
 * Phase 19 credit policy checks. No database, network, or payment provider call.
 * Run with: pnpm --filter @aura/api test:credits
 */
import { CreditLedgerService } from '../src/modules/video/services/credit-ledger.service.js';

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

async function expectFailure(label: string, expectedCode: string, operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
    check(label, false);
  } catch (error) {
    check(label, (error as { code?: string }).code === expectedCode);
  }
}

async function main(): Promise<void> {
  const ledger = new CreditLedgerService(null as never);
  const text = ledger.estimateCost({ duration: 15, sceneCount: 3, mode: 'text_to_video' });
  const image = ledger.estimateCost({ duration: 15, sceneCount: 3, mode: 'image_to_video' });
  const storyboard = ledger.estimateCost({ duration: 15, sceneCount: 3, mode: 'storyboard' });

  check('text-to-video cost is deterministic', text.credits === 31);
  check('image-to-video mode bonus is deterministic', image.credits === 36);
  check('storyboard mode bonus is deterministic', storyboard.credits === 39);
  check('cost breakdown sums to total', storyboard.breakdown.reduce((sum, item) => sum + item.credits, 0) === storyboard.credits);

  await expectFailure('rejects zero-credit mutations', 'INVALID_CREDIT_AMOUNT', () => ledger.deduct('workspace', 0));
  await expectFailure('rejects fractional-credit mutations', 'INVALID_CREDIT_AMOUNT', () => ledger.deduct('workspace', 1.5));
  await expectFailure('rejects blank idempotency keys', 'INVALID_CREDIT_MUTATION', () => ledger.grant('workspace', 1, { idempotencyKey: '   ' }));
  await expectFailure(
    'rejects oversized idempotency keys',
    'INVALID_CREDIT_MUTATION',
    () => ledger.grant('workspace', 1, { idempotencyKey: 'x'.repeat(256) }),
  );

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
