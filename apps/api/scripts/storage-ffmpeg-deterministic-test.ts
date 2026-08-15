/**
 * Phase 20 storage policy checks. Uses only a temporary local directory.
 * Run with: pnpm --filter @aura/api test:storage
 */
import fs from 'node:fs/promises';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/aura_test_dummy';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_PREFIX = 'aura:';
process.env.JWT_SECRET = 'storage-test-secret-0123456789abcdef0123456789';
process.env.API_URL = 'http://localhost:3001';
process.env.STORAGE_PROVIDER = 'local';
process.env.LOCAL_STORAGE_PATH = `/tmp/aura-storage-phase20-${process.pid}`;
process.env.TOKEN_ENCRYPTION_KEY = 'storage-test-encryption-key-0123456789';

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

async function main(): Promise<void> {
  const {
    buildLocalStorageUrl,
    createStorageToken,
    decodeStorageKey,
    encodeStorageKey,
    verifyStorageToken,
  } = await import('../src/infrastructure/storage/local-signing.js');
  const { LocalStorageProvider } = await import('../src/infrastructure/storage/local.provider.js');

  const key = 'videos/workspace-1/generated.mp4';
  const encoded = encodeStorageKey(key);
  const now = Math.floor(Date.now() / 1000);
  const validToken = createStorageToken(key, now + 60);
  const expiredToken = createStorageToken(key, now - 1);

  check('storage key encoding round-trips', decodeStorageKey(encoded) === key);
  check('valid storage token verifies', verifyStorageToken(key, validToken));
  check('storage token rejects another key', !verifyStorageToken(`${key}.other`, validToken));
  check('expired storage token is rejected', !verifyStorageToken(key, expiredToken));
  check('tampered storage token is rejected', !verifyStorageToken(key, `${validToken}tampered`));

  const url = buildLocalStorageUrl(key, 100_000);
  const tokenFromUrl = new URL(url).searchParams.get('token');
  check('signed URL contains a token', Boolean(tokenFromUrl));
  if (tokenFromUrl) {
    const expiry = Number(tokenFromUrl.split('.')[1]);
    check('signed URL lifetime is capped', expiry <= now + 24 * 60 * 60 + 1);
  }

  const storage = new LocalStorageProvider();
  const probeKey = `runtime/${process.pid}/probe.txt`;
  try {
    const uploaded = await storage.upload({
      key: probeKey,
      body: Buffer.from('storage-probe'),
      contentType: 'text/plain',
    });
    check('local provider uploads a probe', uploaded.key === probeKey && uploaded.size === 13);
    check('local provider reports uploaded object', await storage.exists(probeKey));
    await storage.delete(probeKey);
    check('local provider deletes the probe', !(await storage.exists(probeKey)));

    let traversalRejected = false;
    try {
      await storage.getSignedUrl('../escape.txt');
    } catch {
      traversalRejected = true;
    }
    check('local provider rejects path traversal', traversalRejected);
  } finally {
    await storage.delete(probeKey).catch(() => undefined);
    await fs.rm(process.env.LOCAL_STORAGE_PATH!, { recursive: true, force: true });
  }

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
