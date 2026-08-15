/**
 * Phase 10 library boundary checks. No database, network, storage, or paid call.
 * Run with: pnpm --filter @aura/api test:library
 */
import { assetTypeSchema, createProjectBodySchema, updateProjectBodySchema } from '../src/modules/library/dto/schemas.js';

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
    'accepts a valid project create payload',
    createProjectBodySchema.safeParse({
      name: 'Summer product campaign',
      description: 'Vertical product advertisement',
    }).success,
  );
  check(
    'rejects empty project names',
    !createProjectBodySchema.safeParse({ name: '   ' }).success,
  );
  check(
    'accepts an archive-only project mutation',
    updateProjectBodySchema.safeParse({ status: 'archived' }).success,
  );
  check(
    'rejects client-provided video URL',
    !updateProjectBodySchema.safeParse({ videoUrl: 'https://attacker.example/video.mp4' }).success,
  );
  check(
    'rejects client-provided completed status',
    !updateProjectBodySchema.safeParse({ status: 'completed' }).success,
  );
  check(
    'rejects client-provided thumbnail URL',
    !updateProjectBodySchema.safeParse({ thumbnailUrl: 'https://attacker.example/thumb.jpg' }).success,
  );
  check('accepts video asset filter', assetTypeSchema.safeParse('video').success);
  check('rejects arbitrary asset filter', !assetTypeSchema.safeParse('secret').success);

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
