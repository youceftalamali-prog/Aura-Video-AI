import { AppError, ValidationError } from '@aura/shared';
import type { ExtractedProductData } from '@aura/types';
import { resolveProductAdapter } from '../adapters/index.js';

const BLOCKED = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal']);
const MAX_BYTES = 1_500_000;

export class UrlImportService {
  async extract(url: string): Promise<ExtractedProductData> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ValidationError('Invalid product URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ValidationError('Only http/https URLs are allowed');
    }
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new ValidationError('URL host is not allowed');
    }
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host)) {
      throw new ValidationError('Private network URLs are not allowed');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AuraVideoAI-ProductBot/0.1',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (response.status >= 300 && response.status < 400) {
        throw new AppError('URL redirects are not followed for security', 400, 'URL_REDIRECT_BLOCKED');
      }
      if (!response.ok) {
        throw new AppError(`Failed to fetch product URL: HTTP ${response.status}`, 400, 'PRODUCT_URL_FETCH_FAILED');
      }
      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        throw new AppError('URL did not return HTML', 400, 'PRODUCT_URL_NOT_HTML');
      }
      const html = (await response.text()).slice(0, MAX_BYTES);
      const adapter = resolveProductAdapter(url);
      const data = await adapter.extract(url, html);
      if (!data.name && !data.description) {
        throw new AppError('Could not extract product information from URL', 422, 'PRODUCT_EXTRACTION_FAILED');
      }
      console.log(JSON.stringify({ level: 'info', event: 'import_completed', platform: data.sourcePlatform, hasImages: data.images.length }));
      return data;
    } catch (err) {
      if (err instanceof AppError || err instanceof ValidationError) throw err;
      if ((err as unknown as Error).name === 'AbortError') {
        throw new AppError('Product URL fetch timed out', 408, 'PRODUCT_URL_TIMEOUT');
      }
      throw new AppError(`Product URL fetch failed: ${(err as unknown as Error).message}`, 400, 'PRODUCT_URL_FETCH_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }
}
