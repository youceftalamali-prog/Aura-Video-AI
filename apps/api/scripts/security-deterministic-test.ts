/**
 * Security checks. They use no database, network, provider, or paid call.
 * Run with: pnpm --filter @aura/api test:security
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/aura_test_dummy';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'security-test-secret-0123456789abcdef0123456789';

import jwt from 'jsonwebtoken';
import { lookup } from 'node:dns/promises';
import { assertSafeRemoteUrl, isBlockedIPv4, isBlockedIPv6, readResponseText } from '../src/infrastructure/security/url-safety.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../src/infrastructure/auth/jwt.js';
import {
  createStorageToken,
  decodeStorageKey,
  encodeStorageKey,
  verifyStorageToken,
} from '../src/infrastructure/storage/local-signing.js';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function rejects(label: string, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
    check(label, false, 'request was accepted');
  } catch {
    check(label, true);
  }
}

const publicLookup = (async () => [{ address: '93.184.216.34' }]) as typeof lookup;
const mixedLookup = (async () => [
  { address: '93.184.216.34' },
  { address: '10.0.0.8' },
]) as typeof lookup;

async function main(): Promise<void> {
  console.log('IP range checks');
  check('blocks IPv4 loopback', isBlockedIPv4('127.0.0.1'));
  check('blocks IPv4 private', isBlockedIPv4('10.0.0.1'));
  check('blocks IPv4 link-local', isBlockedIPv4('169.254.169.254'));
  check('allows public IPv4', !isBlockedIPv4('93.184.216.34'));
  check('blocks IPv6 loopback', isBlockedIPv6('::1'));
  check('blocks IPv6 unique-local', isBlockedIPv6('fd00::1'));
  check('blocks IPv4-mapped IPv6 private', isBlockedIPv6('::ffff:10.0.0.1'));

  console.log('URL boundary checks');
  await rejects('blocks IPv4 loopback URL', () => assertSafeRemoteUrl('http://127.0.0.1/'));
  await rejects('blocks IPv6 loopback URL', () => assertSafeRemoteUrl('http://[::1]/'));
  await rejects('blocks cloud metadata hostname', () => assertSafeRemoteUrl('http://metadata.google.internal/'));
  await rejects('blocks embedded credentials', () => assertSafeRemoteUrl('https://user:pass@example.com/'));
  await rejects('blocks non-standard port', () => assertSafeRemoteUrl('https://example.com:8443/'));
  await rejects('blocks mixed DNS answers', () => assertSafeRemoteUrl('https://shop.example/', mixedLookup));
  const publicUrl = await assertSafeRemoteUrl('https://shop.example/products/1', publicLookup);
  check('accepts public DNS answer', publicUrl.hostname === 'shop.example');

  console.log('Response size boundary');
  const smallResponse = new Response('safe');
  check('reads response under limit', (await readResponseText(smallResponse, 10)) === 'safe');
  await rejects('rejects response over limit', () => readResponseText(new Response('0123456789'), 5));

  console.log('JWT trust-boundary checks');
  const payload = { sub: 'user-1', email: 'user@example.com', role: 'user' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  check('accepts a correctly scoped access token', verifyToken(accessToken, 'access').sub === payload.sub);
  check('accepts a correctly scoped refresh token', verifyToken(refreshToken, 'refresh').sub === payload.sub);
  await rejects('rejects an access token as a refresh token', async () => verifyToken(accessToken, 'refresh'));
  const wrongIssuerToken = jwt.sign({ ...payload, type: 'access' }, process.env.JWT_SECRET!, {
    algorithm: 'HS256',
    audience: 'aura-video-ai-client',
    issuer: 'untrusted-service',
    expiresIn: '1m',
  });
  await rejects('rejects a token from another issuer', async () => verifyToken(wrongIssuerToken, 'access'));
  const wrongAudienceToken = jwt.sign({ ...payload, type: 'access' }, process.env.JWT_SECRET!, {
    algorithm: 'HS256',
    audience: 'another-client',
    issuer: 'aura-video-ai',
    expiresIn: '1m',
  });
  await rejects('rejects a token for another audience', async () => verifyToken(wrongAudienceToken, 'access'));

  console.log('Signed local storage URL checks');
  const key = 'videos/workspace-1/job-1.mp4';
  const encoded = encodeStorageKey(key);
  check('storage key round trips', decodeStorageKey(encoded) === key);
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  const token = createStorageToken(key, expiresAt);
  check('accepts valid storage token', verifyStorageToken(key, token));
  check('rejects token for another key', !verifyStorageToken('videos/workspace-2/job-1.mp4', token));
  check('rejects modified token', !verifyStorageToken(key, `${token}x`));
  check('rejects expired token', !verifyStorageToken(key, createStorageToken(key, Math.floor(Date.now() / 1000) - 1)));

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
