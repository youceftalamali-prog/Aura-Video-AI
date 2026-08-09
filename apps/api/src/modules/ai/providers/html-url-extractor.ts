import { ValidationError, AppError } from '@aura/shared';
import type { ProductUrlMetadata } from '@aura/types';
import type { IUrlMetadataExtractor } from '../interfaces/url-extractor.interface.js';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
]);

export class HtmlUrlMetadataExtractor implements IUrlMetadataExtractor {
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
