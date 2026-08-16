/**
 * Final production-hardening checks. No database, network, or provider call.
 * Run with: pnpm --filter @aura/api test:production
 */
import { requestIdMiddleware } from '../src/infrastructure/http/middleware/request-id.middleware.js';

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

function invoke(candidate?: string) {
  const headers: Record<string, string> = {};
  let nextCalled = false;
  const req = {
    header: (name: string) => name.toLowerCase() === 'x-request-id' ? candidate : undefined,
  } as never;
  const res = {
    locals: {} as Record<string, unknown>,
    setHeader: (name: string, value: string) => { headers[name] = value; },
  } as never;
  requestIdMiddleware(req, res, () => { nextCalled = true; });
  return { headers, locals: (res as { locals: Record<string, unknown> }).locals, nextCalled };
}

const accepted = invoke('checkout-2026-08-15:abc');
check('accepts a bounded safe request id', accepted.headers['X-Request-Id'] === 'checkout-2026-08-15:abc');
check('stores the request id for log correlation', accepted.locals.requestId === 'checkout-2026-08-15:abc');
check('continues the request chain', accepted.nextCalled);

const invalid = invoke('bad id\nwith-header-injection');
check('replaces an unsafe request id', invalid.headers['X-Request-Id'] !== 'bad id\nwith-header-injection');
check('generates a UUID-shaped fallback', /^[0-9a-f-]{36}$/.test(invalid.headers['X-Request-Id'] ?? ''));

const oversized = invoke(`x${'a'.repeat(128)}`);
check('replaces an oversized request id', oversized.headers['X-Request-Id'] !== `x${'a'.repeat(128)}`);

console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
