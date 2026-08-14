import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError, ValidationError } from '@aura/shared';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data.ec2.internal',
]);
const MAX_URL_LENGTH = 2048;

type DnsLookup = typeof dnsLookup;

function ipv4ToNumber(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

export function isBlockedIPv4(address: string): boolean {
  const value = ipv4ToNumber(address);
  if (value === null) return true;
  const a = value >>> 24;
  const b = (value >>> 16) & 0xff;
  const c = (value >>> 8) & 0xff;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (value >= 0x64400000 && value <= 0x647fffff) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && b === 18) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function expandIPv6(address: string): { hi: bigint; lo: bigint } | null {
  let normalized = address.toLowerCase();
  const zone = normalized.indexOf('%');
  if (zone !== -1) normalized = normalized.slice(0, zone);

  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4 = normalized.slice(lastColon + 1);
    const v4Number = ipv4ToNumber(v4);
    if (v4Number === null) return null;
    normalized =
      normalized.slice(0, lastColon + 1) +
      ((v4Number >>> 16) & 0xffff).toString(16) +
      ':' +
      (v4Number & 0xffff).toString(16);
  }

  if (normalized.includes('::') && normalized.indexOf('::') !== normalized.lastIndexOf('::')) {
    return null;
  }
  const parts = normalized.split('::');
  const before = parts[0] ? parts[0]!.split(':') : [];
  const after = parts[1] ? parts[1]!.split(':') : [];
  if (!normalized.includes('::') && before.length !== 8) return null;
  if (before.length + after.length > 7) return null;

  const missing = 8 - before.length - after.length;
  const groups = [...before, ...Array(missing).fill('0'), ...after];
  if (groups.length !== 8) return null;

  let hi = 0n;
  let lo = 0n;
  for (let index = 0; index < 8; index += 1) {
    const group = Number.parseInt(groups[index]!, 16);
    if (!Number.isFinite(group) || group < 0 || group > 0xffff) return null;
    if (index < 4) hi = (hi << 16n) | BigInt(group);
    else lo = (lo << 16n) | BigInt(group);
  }
  return { hi, lo };
}

export function isBlockedIPv6(address: string): boolean {
  const expanded = expandIPv6(address);
  if (expanded === null) return true;
  const value = (expanded.hi << 64n) | expanded.lo;

  if (expanded.hi === 0n) {
    if (value === 0n || value === 1n) return true;
    if ((value >> 32n) === 0xffffn || (value >> 32n) === 0n) {
      const v4 = value & 0xffffffffn;
      return isBlockedIPv4(
        `${v4 >> 24n}.${(v4 >> 16n) & 0xffn}.${(v4 >> 8n) & 0xffn}.${v4 & 0xffn}`,
      );
    }
    return true;
  }

  return (
    (value >> 121n) === 0x7en ||
    (value >> 120n) === 0xffn ||
    (value >> 118n) === 0x3fan ||
    (value >> 96n) === 0x20010db8n ||
    (value >> 112n) === 0x2002n ||
    (value >> 100n) === 0x2001001n ||
    (value >> 64n) === 0x64ff9b00000000n ||
    (value >> 80n) === 0x64ff9b0001n
  );
}

function normalizeHost(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1).toLowerCase()
    : hostname.toLowerCase();
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? isBlockedIPv4(address) : family === 6 ? isBlockedIPv6(address) : true;
}

/** Validate a remote URL and all DNS answers before making an outbound request. */
export async function assertSafeRemoteUrl(input: string, lookup: DnsLookup = dnsLookup): Promise<URL> {
  if (!input || input.length > MAX_URL_LENGTH) {
    throw new ValidationError('Product URL is invalid');
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new ValidationError('Product URL is invalid');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Only http/https URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError('URLs with embedded credentials are not allowed');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new ValidationError('Non-standard URL ports are not allowed');
  }

  const host = normalizeHost(parsed.hostname);
  if (
    !host ||
    BLOCKED_HOSTS.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    throw new ValidationError('URL host is not allowed');
  }

  const family = isIP(host);
  if (family) {
    if (isBlockedAddress(host)) throw new ValidationError('URL host is not allowed');
    return parsed;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = (await lookup(host, { all: true, verbatim: true })) as Array<{ address: string }>;
  } catch {
    throw new AppError('URL host could not be resolved', 400, 'PRODUCT_URL_FETCH_FAILED');
  }
  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new ValidationError('URL host resolves to a non-public address');
  }
  return parsed;
}

export async function readResponseText(
  response: Response,
  maxBytes: number,
  errorCode = 'REMOTE_RESPONSE_TOO_LARGE',
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') || '');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new AppError('Remote response exceeds the allowed size', 413, errorCode);
  }
  if (!response.body) {
    throw new AppError('Remote response body is unavailable', 502, 'REMOTE_RESPONSE_INVALID');
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AppError('Remote response exceeds the allowed size', 413, errorCode);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString('utf8');
}
