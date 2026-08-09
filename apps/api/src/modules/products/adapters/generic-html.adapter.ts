import type { ExtractedProductData } from '@aura/types';
import type { IProductSourceAdapter } from '../interfaces/product-source-adapter.interface.js';

export class GenericHTMLProductAdapter implements IProductSourceAdapter {
  readonly name = 'generic_html';

  canHandle(_url: string): boolean {
    return true;
  }

  async extract(url: string, html: string): Promise<ExtractedProductData> {
    const title =
      this.meta(html, 'og:title') ||
      this.meta(html, 'twitter:title') ||
      this.tag(html, 'title') ||
      this.jsonLdString(html, 'name');
    const description =
      this.meta(html, 'og:description') ||
      this.meta(html, 'description') ||
      this.jsonLdString(html, 'description');
    const images = this.collectImages(html, url);
    const price =
      this.jsonLdString(html, 'price') ||
      this.meta(html, 'product:price:amount') ||
      this.findPrice(html);
    const currency =
      this.jsonLdString(html, 'priceCurrency') ||
      this.meta(html, 'product:price:currency') ||
      this.guessCurrency(html);
    const brand = this.jsonLdString(html, 'brand') || this.meta(html, 'product:brand');
    const sku = this.jsonLdString(html, 'sku') || this.meta(html, 'product:retailer_item_id');
    const availability = this.jsonLdString(html, 'availability') || this.meta(html, 'product:availability');
    const category = this.jsonLdString(html, 'category') || null;
    const platform = this.detectPlatform(url);

    const rawFacts: Record<string, string> = {};
    if (title) rawFacts.title = title;
    if (description) rawFacts.description = description.slice(0, 2000);
    if (price) rawFacts.price = price;
    if (currency) rawFacts.currency = currency;
    if (brand) rawFacts.brand = brand;

    return {
      name: title,
      description,
      images,
      price,
      currency,
      brand,
      sku,
      availability,
      category,
      sourceUrl: url,
      sourcePlatform: platform,
      rawFacts,
    };
  }

  private detectPlatform(url: string): string {
    const host = (() => {
      try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
    })();
    if (host.includes('shopify') || host.includes('myshopify')) return 'shopify';
    if (host.includes('woocommerce') || host.includes('wp-content')) return 'woocommerce';
    if (host.includes('amazon.')) return 'amazon';
    if (host.includes('aliexpress.')) return 'aliexpress';
    if (host.includes('alibaba.')) return 'alibaba';
    if (host.includes('ebay.')) return 'ebay';
    return 'generic';
  }

  private meta(html: string, prop: string): string | null {
    const re = new RegExp(
      `<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["'][^>]*>|<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["'][^>]*>`,
      'i',
    );
    const m = html.match(re);
    return m ? (m[1] || m[2] || '').trim() || null : null;
  }

  private tag(html: string, name: string): string | null {
    const m = html.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, 'i'));
    return m && m[1] != null ? m[1].trim() : null;
  }

  private jsonLdString(html: string, key: string): string | null {
    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const s of scripts) {
      try {
        const data = JSON.parse(s[1]!);
        const found = this.walkJson(data, key);
        if (found) return found;
      } catch {
        /* ignore invalid json-ld */
      }
    }
    return null;
  }

  private walkJson(node: unknown, key: string): string | null {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const v = this.walkJson(item, key);
        if (v) return v;
      }
      return null;
    }
    const obj = node as unknown as Record<string, unknown>;
    if (key in obj) {
      const v = obj[key];
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (v && typeof v === 'object' && 'name' in (v as object)) {
        return String((v as { name: unknown }).name);
      }
    }
    for (const val of Object.values(obj)) {
      const found = this.walkJson(val, key);
      if (found) return found;
    }
    return null;
  }

  private collectImages(html: string, pageUrl: string): string[] {
    const set = new Set<string>();
    const og = this.meta(html, 'og:image');
    if (og) set.add(this.abs(og, pageUrl));
    for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      const src = m[1]!;
      if (src.startsWith('data:')) continue;
      if (set.size >= 8) break;
      set.add(this.abs(src, pageUrl));
    }
    return [...set];
  }

  private abs(src: string, pageUrl: string): string {
    try { return new URL(src, pageUrl).toString(); } catch { return src; }
  }

  private findPrice(html: string): string | null {
    const m = html.match(/(?:USD|EUR|GBP|\$|€|£)\s?(\d+(?:[.,]\d{2})?)/i);
    return m ? m[1]!.replace(',', '.') : null;
  }

  private guessCurrency(html: string): string | null {
    if (html.includes('€') || /EUR/i.test(html)) return 'EUR';
    if (html.includes('£') || /GBP/i.test(html)) return 'GBP';
    if (html.includes('$') || /USD/i.test(html)) return 'USD';
    return null;
  }
}
