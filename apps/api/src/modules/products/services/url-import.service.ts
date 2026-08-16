import { AppError, ValidationError } from '@aura/shared';
import type { ExtractedProductData } from '@aura/types';
import { resolveProductAdapter } from '../adapters/index.js';
import { assertSafeRemoteUrl, readResponseText } from '../../../infrastructure/security/url-safety.js';

const MAX_BYTES = 1_500_000;

export class UrlImportService {
  async extract(url: string): Promise<ExtractedProductData> {
    const parsed = await assertSafeRemoteUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const safeUrl = parsed.toString();
      const response = await fetch(safeUrl, {
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
        throw new AppError('Product URL could not be fetched', 400, 'PRODUCT_URL_FETCH_FAILED');
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new AppError('URL did not return HTML', 400, 'PRODUCT_URL_NOT_HTML');
      }

      const html = await readResponseText(response, MAX_BYTES, 'PRODUCT_URL_TOO_LARGE');
      const adapter = resolveProductAdapter(safeUrl);
      const data = await adapter.extract(safeUrl, html);
      if (!data.name && !data.description) {
        throw new AppError('Could not extract product information from URL', 422, 'PRODUCT_EXTRACTION_FAILED');
      }
      console.log(JSON.stringify({
        level: 'info',
        event: 'import_completed',
        host: parsed.hostname,
        platform: data.sourcePlatform,
        hasImages: data.images.length,
      }));
      return data;
    } catch (error) {
      if (error instanceof AppError || error instanceof ValidationError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new AppError('Product URL fetch timed out', 408, 'PRODUCT_URL_TIMEOUT');
      }
      throw new AppError('Product URL could not be fetched', 400, 'PRODUCT_URL_FETCH_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }
}
