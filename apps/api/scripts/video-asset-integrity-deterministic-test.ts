/**
 * Phase 18 project/video-asset boundary checks.
 * Run with: pnpm --filter @aura/api test:video-asset
 */
import { createProjectBodySchema, updateProjectBodySchema } from '../src/modules/library/dto/schemas.js';

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
  const projectId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';

  check(
    'accepts a normal project creation payload',
    createProjectBodySchema.safeParse({ name: 'Canonical video project' }).success,
  );
  check(
    'accepts the public archive mutation',
    updateProjectBodySchema.safeParse({ status: 'archived' }).success,
  );
  check(
    'rejects a client video URL',
    !updateProjectBodySchema.safeParse({ videoUrl: 'https://attacker.example/video.mp4' }).success,
  );
  check(
    'rejects a client video asset relation',
    !updateProjectBodySchema.safeParse({ videoAssetId: assetId }).success,
  );
  check(
    'rejects a client completed status',
    !updateProjectBodySchema.safeParse({ status: 'completed' }).success,
  );
  check(
    'rejects arbitrary server-owned fields',
    !updateProjectBodySchema.safeParse({ projectId, assetId }).success,
  );
  check(
    'accepts clearing the public description',
    updateProjectBodySchema.safeParse({ description: null }).success,
  );

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
