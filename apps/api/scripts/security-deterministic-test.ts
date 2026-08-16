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
import { readFile } from 'node:fs/promises';
import type { NextFunction, Response } from 'express';
import { assertSafeRemoteUrl, isBlockedIPv4, isBlockedIPv6, readResponseText } from '../src/infrastructure/security/url-safety.js';
import { signAccessToken, signRefreshToken, verifyToken } from '../src/infrastructure/auth/jwt.js';
import {
  createStorageToken,
  decodeStorageKey,
  encodeStorageKey,
  verifyStorageToken,
} from '../src/infrastructure/storage/local-signing.js';
import { AuthController, readCookie } from '../src/infrastructure/http/controllers/auth.controller.js';
import { GOOGLE_OAUTH_STATE_COOKIE } from '../src/infrastructure/auth/google-oauth.service.js';
import type { GoogleOAuthService } from '../src/infrastructure/auth/google-oauth.service.js';
import type { AuthService } from '../src/domain/services/auth.service.js';
import type { AuthenticatedRequest } from '../src/infrastructure/http/middleware/auth.middleware.js';

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

/* OAuth state cookie harness. The API registers no cookie middleware, so the
 * callback must read the state cookie from the raw request headers. */
const GOOGLE_OAUTH_COOKIE_PATH = '/api/v1/auth/google';
const OAUTH_STATE = 'lq7x93m2.state-token-value';
const OAUTH_STATE_COOKIE = `${OAUTH_STATE}.state-signature-value`;

type ResponseCapture = {
  statusCode?: number;
  body?: unknown;
  cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>;
  clearedCookies: Array<{ name: string; options: Record<string, unknown> }>;
};

type OAuthStubCalls = {
  verifyState: Array<{ state: string; stateCookie: string | undefined; exchangesBefore: number }>;
  exchanges: number;
  logins: number;
};

function createResponseStub(): { res: Response; captured: ResponseCapture } {
  const captured: ResponseCapture = { cookies: [], clearedCookies: [] };
  const stub: Record<string, unknown> = {};
  stub.status = (code: number): unknown => {
    captured.statusCode = code;
    return stub;
  };
  stub.json = (payload: unknown): unknown => {
    captured.body = payload;
    return stub;
  };
  stub.cookie = (name: string, value: string, options: Record<string, unknown> = {}): unknown => {
    captured.cookies.push({ name, value, options });
    return stub;
  };
  stub.clearCookie = (name: string, options: Record<string, unknown> = {}): unknown => {
    captured.clearedCookies.push({ name, options });
    return stub;
  };
  return { res: stub as unknown as Response, captured };
}

function createAuthControllerHarness(acceptState: boolean): { controller: AuthController; calls: OAuthStubCalls } {
  const calls: OAuthStubCalls = { verifyState: [], exchanges: 0, logins: 0 };

  const googleOAuth = {
    createAuthorizationUrl: () => ({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=stub',
      stateCookie: OAUTH_STATE_COOKIE,
      maxAgeMs: 600_000,
    }),
    verifyState: (state: string, stateCookie: string | undefined): boolean => {
      calls.verifyState.push({ state, stateCookie, exchangesBefore: calls.exchanges });
      return acceptState && state === OAUTH_STATE && stateCookie === OAUTH_STATE_COOKIE;
    },
    exchangeAuthorizationCode: async (_code: string) => {
      calls.exchanges += 1;
      return { id: 'google-user-1', email: 'oauth-user@example.com', name: 'OAuth user' };
    },
  } as unknown as GoogleOAuthService;

  const authService = {
    loginWithGoogle: async () => {
      calls.logins += 1;
      return {
        user: { id: 'user-1', email: 'oauth-user@example.com' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
    },
  } as unknown as AuthService;

  return { controller: new AuthController(authService, googleOAuth), calls };
}

async function runGoogleCallback(options: { cookieHeader?: string; acceptState: boolean }): Promise<{
  captured: ResponseCapture;
  calls: OAuthStubCalls;
  nextErrors: number;
}> {
  const { controller, calls } = createAuthControllerHarness(options.acceptState);
  const { res, captured } = createResponseStub();
  const headers: Record<string, string> = {};
  if (options.cookieHeader !== undefined) headers.cookie = options.cookieHeader;
  const req = {
    query: { code: 'stub-authorization-code', state: OAUTH_STATE },
    headers,
    ip: '203.0.113.10',
  } as unknown as AuthenticatedRequest;

  let nextErrors = 0;
  const next = ((): void => {
    nextErrors += 1;
  }) as unknown as NextFunction;

  await controller.googleCallback(req, res, next);
  return { captured, calls, nextErrors };
}

async function runGoogleAuthorize(): Promise<ResponseCapture> {
  const { controller } = createAuthControllerHarness(true);
  const { res, captured } = createResponseStub();
  const next = ((): void => undefined) as unknown as NextFunction;
  await controller.googleAuthorize({ headers: {} } as unknown as AuthenticatedRequest, res, next);
  return captured;
}

function errorCodeOf(body: unknown): string | undefined {
  const error = (body as { error?: { code?: unknown } } | undefined)?.error;
  return typeof error?.code === 'string' ? error.code : undefined;
}

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

  console.log('Request pipeline cookie-middleware checks');
  const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  check('app.ts does not depend on cookie-parser', !appSource.includes('cookie-parser'));
  check('app.ts registers no cookie parsing middleware', !appSource.includes('cookieParser'));

  console.log('OAuth state cookie parsing checks');
  check(
    'reads the exact OAuth state cookie from a multi-cookie header',
    readCookie(`session=x; ${GOOGLE_OAUTH_STATE_COOKIE}=${OAUTH_STATE_COOKIE}; tail=y`, GOOGLE_OAUTH_STATE_COOKIE) === OAUTH_STATE_COOKIE,
  );
  check(
    'decodes a URI-encoded OAuth state cookie value',
    readCookie(
      `${GOOGLE_OAUTH_STATE_COOKIE}=${encodeURIComponent('state value/with+chars')}`,
      GOOGLE_OAUTH_STATE_COOKIE,
    ) === 'state value/with+chars',
  );
  check('ignores a missing cookie header', readCookie(undefined, GOOGLE_OAUTH_STATE_COOKIE) === undefined);
  check('ignores an empty cookie header', readCookie('', GOOGLE_OAUTH_STATE_COOKIE) === undefined);
  check(
    'ignores a similarly named suffix cookie',
    readCookie(`${GOOGLE_OAUTH_STATE_COOKIE}_BACKUP=${OAUTH_STATE_COOKIE}`, GOOGLE_OAUTH_STATE_COOKIE) === undefined,
  );
  check(
    'ignores a similarly named prefix cookie',
    readCookie(`x_${GOOGLE_OAUTH_STATE_COOKIE}=${OAUTH_STATE_COOKIE}`, GOOGLE_OAUTH_STATE_COOKIE) === undefined,
  );
  check('ignores a nameless cookie pair', readCookie(`=${OAUTH_STATE_COOKIE}`, GOOGLE_OAUTH_STATE_COOKIE) === undefined);
  try {
    check(
      'malformed percent-encoding returns undefined instead of throwing',
      readCookie(`${GOOGLE_OAUTH_STATE_COOKIE}=%E0%A4%A`, GOOGLE_OAUTH_STATE_COOKIE) === undefined,
    );
  } catch {
    check('malformed percent-encoding returns undefined instead of throwing', false, 'decodeURIComponent threw');
  }

  console.log('Google OAuth callback trust-boundary checks');
  const authorizeCapture = await runGoogleAuthorize();
  const stateCookieSet = authorizeCapture.cookies.find((entry) => entry.name === GOOGLE_OAUTH_STATE_COOKIE);
  check('authorize still sets the OAuth state cookie', stateCookieSet !== undefined);
  check(
    'OAuth state cookie keeps hardened attributes',
    stateCookieSet?.options.httpOnly === true &&
      stateCookieSet?.options.secure === true &&
      stateCookieSet?.options.sameSite === 'lax' &&
      stateCookieSet?.options.path === GOOGLE_OAUTH_COOKIE_PATH &&
      typeof stateCookieSet?.options.maxAge === 'number',
  );

  const accepted = await runGoogleCallback({
    cookieHeader: `other=1; ${GOOGLE_OAUTH_STATE_COOKIE}=${OAUTH_STATE_COOKIE}`,
    acceptState: true,
  });
  check('callback reads the exact state cookie value', accepted.calls.verifyState[0]?.stateCookie === OAUTH_STATE_COOKIE);
  check('callback verifies state before exchanging the code', accepted.calls.verifyState[0]?.exchangesBefore === 0);
  check('callback exchanges the code once for a valid state', accepted.calls.exchanges === 1 && accepted.calls.logins === 1);
  check('callback answers 200 for a valid state', accepted.captured.statusCode === 200 && accepted.nextErrors === 0);
  const clearedAfterSuccess = accepted.captured.clearedCookies[0];
  check(
    'callback clears the OAuth cookie after success with the same path and flags',
    accepted.captured.clearedCookies.length === 1 &&
      clearedAfterSuccess?.name === GOOGLE_OAUTH_STATE_COOKIE &&
      clearedAfterSuccess?.options.httpOnly === true &&
      clearedAfterSuccess?.options.secure === true &&
      clearedAfterSuccess?.options.sameSite === 'lax' &&
      clearedAfterSuccess?.options.path === GOOGLE_OAUTH_COOKIE_PATH,
  );

  const missingCookie = await runGoogleCallback({ acceptState: true });
  check('missing state cookie is reported as absent to verification', missingCookie.calls.verifyState[0]?.stateCookie === undefined);
  check(
    'missing state cookie fails authentication',
    missingCookie.captured.statusCode === 400 && errorCodeOf(missingCookie.captured.body) === 'AUTHENTICATION_ERROR',
  );
  check('missing state cookie never reaches code exchange', missingCookie.calls.exchanges === 0 && missingCookie.calls.logins === 0);
  check('missing state cookie still clears the OAuth cookie', missingCookie.captured.clearedCookies.length === 1);

  const backupCookie = await runGoogleCallback({
    cookieHeader: `${GOOGLE_OAUTH_STATE_COOKIE}_BACKUP=${OAUTH_STATE_COOKIE}`,
    acceptState: true,
  });
  check(
    'similarly named cookie cannot satisfy state validation',
    backupCookie.captured.statusCode === 400 && backupCookie.calls.exchanges === 0,
  );

  const malformedCookie = await runGoogleCallback({
    cookieHeader: `${GOOGLE_OAUTH_STATE_COOKIE}=%E0%A4%A`,
    acceptState: true,
  });
  check(
    'malformed cookie encoding fails closed without crashing',
    malformedCookie.captured.statusCode === 400 && malformedCookie.calls.exchanges === 0 && malformedCookie.nextErrors === 0,
  );

  const tamperedState = await runGoogleCallback({
    cookieHeader: `${GOOGLE_OAUTH_STATE_COOKIE}=${OAUTH_STATE}.forged-signature`,
    acceptState: false,
  });
  check('invalid state never reaches code exchange', tamperedState.calls.exchanges === 0 && tamperedState.calls.logins === 0);
  check(
    'invalid state response never echoes the cookie value',
    !JSON.stringify(tamperedState.captured.body ?? {}).includes('forged-signature'),
  );

  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
