import { createHmac, timingSafeEqual } from 'node:crypto';
import { APP_CONSTANTS, getEnv } from '@aura/config';

const TOKEN_VERSION = 'v1';
const MAX_URL_LIFETIME_SECONDS = 24 * 60 * 60;

export function encodeStorageKey(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url');
}

export function decodeStorageKey(encoded: string): string | null {
  if (!encoded || encoded.length > 4096) return null;
  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    return decoded || null;
  } catch {
    return null;
  }
}

export function createStorageToken(key: string, expiresAt: number): string {
  const payload = `${TOKEN_VERSION}.${Math.floor(expiresAt)}.${encodeStorageKey(key)}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyStorageToken(key: string, token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return false;
  const expiresAt = Number(parts[1]);
  const encodedKey = parts[2];
  const actualSignature = parts[3];
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  if (encodedKey !== encodeStorageKey(key) || !actualSignature) return false;

  const expectedSignature = sign(`${parts[0]}.${parts[1]}.${parts[2]}`);
  const actual = Buffer.from(actualSignature);
  const expected = Buffer.from(expectedSignature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function buildLocalStorageUrl(key: string, expiresInSeconds = 3600): string {
  const lifetime = Math.max(1, Math.min(Math.floor(expiresInSeconds), MAX_URL_LIFETIME_SECONDS));
  const expiresAt = Math.floor(Date.now() / 1000) + lifetime;
  const token = createStorageToken(key, expiresAt);
  const env = getEnv();
  const apiUrl = env.API_URL.replace(/\/$/, '');
  return `${apiUrl}${APP_CONSTANTS.API_PREFIX}/storage/${encodeStorageKey(key)}?token=${encodeURIComponent(token)}`;
}

function sign(payload: string): string {
  return createHmac('sha256', getEnv().JWT_SECRET).update(payload).digest('base64url');
}
