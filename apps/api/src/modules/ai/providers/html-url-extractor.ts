import { ValidationError, AppError } from '@aura/shared';
import type { ProductUrlMetadata } from '@aura/types';
import type { IUrlMetadataExtractor } from '../interfaces/url-extractor.interface.js';
import { lookup } from 'node:dns/promises';
import { assertSafeRemoteUrl, readResponseText } from '../../../infrastructure/security/url-safety.js';
export { isBlockedIPv4, isBlockedIPv6 } from '../../../infrastructure/security/url-safety.js';
export interface HtmlUrlExtractorOptions { lookup?: typeof lookup; }
export class HtmlUrlMetadataExtractor implements IUrlMetadataExtractor {
  private readonly lookup?: typeof lookup;
  constructor(options: HtmlUrlExtractorOptions = {}) { this.lookup = options.lookup; }
  async extract(url: string): Promise<ProductUrlMetadata> {
    const parsed = await assertSafeRemoteUrl(url, this.lookup);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(parsed.toString(), { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'AuraVideoAI-Bot/0.1 (+https://auravideo.ai)', Accept: 'text/html,application/xhtml+xml' } });
      if (response.status >= 300 && response.status < 400) throw new AppError('URL redirects are not followed for security', 400, 'URL_REDIRECT_BLOCKED');
      if (!response.ok) throw new AppError('URL could not be fetched', 400, 'URL_FETCH_FAILED');
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) throw new AppError('URL did not return HTML content', 400, 'URL_NOT_HTML');
      return this.parseHtml(parsed.toString(), await readResponseText(response, 500_000, 'URL_PAYLOAD_TOO_LARGE'));
    } catch (error) {
      if (error instanceof AppError || error instanceof ValidationError) throw error;
      if ((error as Error).name === 'AbortError') throw new AppError('URL fetch timed out', 408, 'URL_FETCH_TIMEOUT');
      throw new AppError('URL could not be fetched', 400, 'URL_FETCH_FAILED');
    } finally { clearTimeout(timeout); }
  }
  private parseHtml(url: string, html: string): ProductUrlMetadata {
    const getMeta = (property: string): string | null => {
      const patterns = [new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'), new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i')];
      for (const pattern of patterns) { const match = html.match(pattern); if (match?.[1]) return this.decode(match[1]); }
      return null;
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = getMeta('og:title') || getMeta('twitter:title') || (titleMatch ? this.decode(titleMatch[1]!) : null);
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
    const siteName = getMeta('og:site_name'); const images: string[] = [];
    const ogImage = getMeta('og:image') || getMeta('twitter:image'); if (ogImage) images.push(this.absolutize(url, ogImage));
    const imageRegex = /<img[^>]+src=["']([^"']+)["']/gi; let imageMatch: RegExpExecArray | null;
    while ((imageMatch = imageRegex.exec(html)) !== null && images.length < 8) { const src = imageMatch[1]; if (!src || src.startsWith('data:')) continue; const absolute = this.absolutize(url, src); if (!images.includes(absolute)) images.push(absolute); }
    const rawTextSnippet = this.extractText(html).slice(0, 3000);
    return { url, title, description, images, siteName, rawTextSnippet: rawTextSnippet || null };
  }
  private decode(value: string): string {
    const entities: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
    return value.replace(/&(amp|lt|gt|quot|#39|apos);/g, (entity) => entities[entity] ?? entity).trim();
  }
  private extractText(html: string): string {
    let text = ''; let index = 0; const lowerHtml = html.toLowerCase();
    while (index < html.length) {
      if (html.charAt(index) !== '<') { text += html.charAt(index); index += 1; continue; }
      const tagEnd = html.indexOf('>', index + 1); if (tagEnd === -1) break;
      let cursor = index + 1;
      while (cursor < tagEnd) { const character = lowerHtml.charAt(cursor); if (character !== '/' && character !== ' ' && character !== '\t' && character !== '\n' && character !== '\r') break; cursor += 1; }
      const nameStart = cursor;
      while (cursor < tagEnd) { const character = lowerHtml.charAt(cursor); if (!((character >= 'a' && character <= 'z') || (character >= '0' && character <= '9'))) break; cursor += 1; }
      const tagName = lowerHtml.slice(nameStart, cursor); const isClosingTag = lowerHtml.charAt(index + 1) === '/';
      if (!isClosingTag && (tagName === 'script' || tagName === 'style')) { const closingTag = `</${tagName}`; const closingStart = lowerHtml.indexOf(closingTag, tagEnd + 1); if (closingStart === -1) break; const closingEnd = html.indexOf('>', closingStart + closingTag.length); index = closingEnd === -1 ? html.length : closingEnd + 1; } else index = tagEnd + 1;
      text += ' ';
    }
    return text.replace(/\s+/g, ' ').trim();
  }
  private absolutize(base: string, href: string): string { try { return new URL(href, base).href; } catch { return href; } }
}
