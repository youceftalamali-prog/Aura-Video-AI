import { ValidationError, AppError } from '@aura/shared';
import type { ProductUrlMetadata } from '@aura/types';
import type { IUrlMetadataExtractor } from '../interfaces/url-extractor.interface.js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
]);

/** Parse a dotted-quad IPv4 string to a 32-bit number; null if not a valid IPv4. */
function ipv4ToNumber(addr: string): number | null {
  const parts = addr.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = Number(part);
    if (v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

/** True if the IPv4 address is loopback/private/link-local/unspecified/multicast/reserved. */
export function isBlockedIPv4(addr: string): boolean {
  const n = ipv4ToNumber(addr);
  if (n === null) return true; // unparseable -> block (defensive)
  const a = n >>> 24;
  const b = (n >>> 16) & 0xff;
  const c = (n >>> 8) & 0xff;
  return (
    a === 0 || // 0.0.0.0/8 unspecified ("this network")
    a === 10 || // 10.0.0.0/8 private
    a === 127 || // 127.0.0.0/8 loopback
    n >= 0x64400000 && n <= 0x647fffff || // 100.64.0.0/10 shared (CGNAT)
    a === 169 && b === 254 || // 169.254.0.0/16 link-local
    a === 172 && b >= 16 && b <= 31 || // 172.16.0.0/12 private
    a === 192 && b === 0 && c === 0 || // 192.0.0.0/24 IETF protocol assignments
    a === 192 && b === 0 && c === 2 || // 192.0.2.0/24 TEST-NET-1 (docs)
    a === 192 && b === 168 || // 192.168.0.0/16 private
    a === 198 && b === 18 || // 198.18.0.0/15 benchmarking
    a === 198 && b === 51 && c === 100 || // 198.51.100.0/24 TEST-NET-2 (docs)
    a === 203 && b === 0 && c === 113 || // 203.0.113.0/24 TEST-NET-3 (docs)
    a >= 224 // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + broadcast
  );
}

/** Expand an IPv6 literal (incl. IPv4-embedded forms, minus zone id) to 128-bit halves. */
function expandIPv6(addr: string): { hi: bigint; lo: bigint } | null {
  let a = addr.toLowerCase();
  const zone = a.indexOf('%');
  if (zone !== -1) a = a.slice(0, zone);
  if (a.includes('.')) {
    const lastColon = a.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4 = a.slice(lastColon + 1);
    const v4n = ipv4ToNumber(v4);
    if (v4n === null) return null;
    a = a.slice(0, lastColon + 1) + ((v4n >>> 16) & 0xffff).toString(16) + ':' + (v4n & 0xffff).toString(16);
  }
  if (a.indexOf('::') !== -1 && a.indexOf('::') !== a.lastIndexOf('::')) return null;
  const parts = a.split('::');
  const pre = parts[0] ? parts[0]!.split(':') : [];
  const post = parts[1] ? parts[1]!.split(':') : [];
  if (!a.includes('::') && pre.length !== 8) return null;
  if (pre.length + post.length > 7) return null;
  const missing = 8 - pre.length - post.length;
  const groups = [...pre, ...Array(missing).fill('0'), ...post];
  if (groups.length !== 8) return null;
  let hi = 0n;
  let lo = 0n;
  for (let i = 0; i < 8; i++) {
    const g = Number.parseInt(groups[i]!, 16);
    if (!Number.isFinite(g) || g < 0 || g > 0xffff) return null;
    if (i < 4) hi = (hi << 16n) | BigInt(g);
    else lo = (lo << 16n) | BigInt(g);
  }
  return { hi, lo };
}

/** True if the IPv6 address is loopback/private/link-local/unspecified/multicast/reserved. */
export function isBlockedIPv6(addr: string): boolean {
  const e = expandIPv6(addr);
  if (e === null) return true; // unparseable -> block (defensive)
  const n = (e.hi << 64n) | e.lo;
  if (e.hi === 0n) {
    // ::/96 holds the unspecified (::), loopback (::1), IPv4-mapped
    // (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) forms. Embedded IPv4
    // addresses are validated via isBlockedIPv4; everything else is blocked.
    if (n === 0n || n === 1n) return true; // :: unspecified, ::1 loopback
    if (n >> 32n === 0xffffn || n >> 32n === 0n) {
      const v4 = n & 0xffffffffn;
      return isBlockedIPv4(
        `${v4 >> 24n}.${(v4 >> 16n) & 0xffn}.${(v4 >> 8n) & 0xffn}.${v4 & 0xffn}`,
      );
    }
    return true; // other ::/96 unspecified
  }
  return (
    n >> 121n === 0x7en || // fc00::/7 unique local
    n >> 120n === 0xffn || // ff00::/8 multicast
    n >> 118n === 0x3fan || // fe80::/10 link-local
    n >> 96n === 0x20010db8n || // 2001:db8::/32 documentation
    n >> 112n === 0x2002n || // 2002::/16 6to4 (embeds IPv4)
    n >> 100n === 0x2001001n || // 2001:10::/28 ORCHID (reserved)
    n >> 64n === 0x64ff9b00000000n || // 64:ff9b::/96 NAT64 well-known prefix
    n >> 80n === 0x64ff9b0001n // 64:ff9b:1::/48 NAT64 local-use prefix
  );
}

export interface HtmlUrlExtractorOptions {
  /** DNS resolver override for tests; defaults to node:dns/promises lookup. */
  lookup?: typeof lookup;
}

export class HtmlUrlMetadataExtractor implements IUrlMetadataExtractor {
  private readonly lookup: typeof lookup;

  constructor(options: HtmlUrlExtractorOptions = {}) {
    this.lookup = options.lookup ?? lookup;
  }
  async extract(url: string): Promise<ProductUrlMetadata> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ValidationError('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ValidationError('Only http and https URLs are allowed');
    }

    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new ValidationError('URL host is not allowed');
    }

    // Block private IP ranges (basic SSRF protection)
    if (
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host) ||
      host === 'metadata'
    ) {
      throw new ValidationError('Private network URLs are not allowed');
    }

    // DNS-aware SSRF protection: every address the hostname resolves to must be
    // a public address. Literal IPs are validated directly; hostnames resolve
    // via DNS with all records checked (rejects mixed public/private answers).
    await this.resolveAndValidate(host);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AuraVideoAI-Bot/0.1 (+https://auravideo.ai)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      // Do not automatically follow redirects (SSRF hardening)
      if (response.status >= 300 && response.status < 400) {
        throw new AppError(
          'URL redirects are not followed for security',
          400,
          'URL_REDIRECT_BLOCKED',
        );
      }

      if (!response.ok) {
        throw new AppError(
          `Failed to fetch URL: HTTP ${response.status}`,
          400,
          'URL_FETCH_FAILED',
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new AppError('URL did not return HTML content', 400, 'URL_NOT_HTML');
      }

      const html = (await response.text()).slice(0, 500_000);
      return this.parseHtml(url, html);
    } catch (err) {
      if (err instanceof AppError || err instanceof ValidationError) throw err;
      if ((err as unknown as Error).name === 'AbortError') {
        throw new AppError('URL fetch timed out', 408, 'URL_FETCH_TIMEOUT');
      }
      throw new AppError(
        `URL fetch failed: ${(err as unknown as Error).message}`,
        400,
        'URL_FETCH_FAILED',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Resolve the host via DNS and reject it if ANY resolved address is
   * loopback/private/link-local/unspecified/multicast/reserved (including
   * IPv4-mapped IPv6 and IPv4-embedded 6to4 forms). Hosts given as IP literals
   * are validated directly without DNS.
   */
  private async resolveAndValidate(host: string): Promise<void> {
    // WHATWG URL.hostname keeps the brackets on IPv6 literals ("[::1]") while
    // node:net isIP() expects the unbracketed form.
    const ip = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
    const family = isIP(ip);
    if (family === 4 || family === 6) {
      const blocked = family === 4 ? isBlockedIPv4(ip) : isBlockedIPv6(ip);
      if (blocked) {
        throw new ValidationError('URL host is not allowed');
      }
      return;
    }

    let addrs: Array<{ address: string }>;
    try {
      addrs = await this.lookup(host, { all: true, verbatim: true });
    } catch {
      throw new AppError('URL host could not be resolved', 400, 'URL_FETCH_FAILED');
    }
    if (addrs.length === 0) {
      throw new AppError('URL host could not be resolved', 400, 'URL_FETCH_FAILED');
    }

    for (const a of addrs) {
      const f = isIP(a.address);
      const blocked = f === 4 ? isBlockedIPv4(a.address) : f === 6 ? isBlockedIPv6(a.address) : true;
      if (blocked) {
        throw new ValidationError('URL host resolves to a non-public address');
      }
    }
  }

  private parseHtml(url: string, html: string): ProductUrlMetadata {
    const getMeta = (property: string): string | null => {
      const patterns = [
        new RegExp(
          `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
          'i',
        ),
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
          'i',
        ),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return this.decode(m[1]);
      }
      return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title =
      getMeta('og:title') || getMeta('twitter:title') || (titleMatch ? this.decode(titleMatch[1]!) : null);

    const description =
      getMeta('og:description') || getMeta('twitter:description') || getMeta('description');

    const siteName = getMeta('og:site_name');

    const images: string[] = [];
    const ogImage = getMeta('og:image') || getMeta('twitter:image');
    if (ogImage) images.push(this.absolutize(url, ogImage));

    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRegex.exec(html)) !== null && images.length < 8) {
      const src = imgMatch[1];
      if (!src || src.startsWith('data:')) continue;
      const abs = this.absolutize(url, src);
      if (!images.includes(abs)) images.push(abs);
    }

    const textSnippet = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    return {
      url,
      title,
      description,
      images,
      siteName,
      rawTextSnippet: textSnippet || null,
    };
  }

  private decode(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private absolutize(base: string, href: string): string {
    try {
      return new URL(href, base).href;
    } catch {
      return href;
    }
  }
}
