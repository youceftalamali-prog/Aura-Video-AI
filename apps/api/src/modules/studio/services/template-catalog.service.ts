import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { templates } from '../../../db/schema.js';
import type { Template, TemplateDefinition, TemplatePlatform, AspectRatio } from '@aura/types';
import { NotFoundError } from '@aura/shared';

/** Built-in data-driven template definitions (not hard-coded in React). */
const CATALOG: Omit<TemplateDefinition, 'id'>[] = [
  {
    name: 'TikTok Hook Product',
    platform: 'tiktok',
    aspectRatio: '9:16',
    durationSeconds: 15,
    scenes: [
      { order: 1, type: 'hook', durationSeconds: 3, textPosition: 'center', animation: 'pop' },
      { order: 2, type: 'product', durationSeconds: 5, productPosition: 'center', animation: 'scale' },
      { order: 3, type: 'benefits', durationSeconds: 4, textPosition: 'bottom', animation: 'slide' },
      { order: 4, type: 'cta', durationSeconds: 3, cta: true, textPosition: 'center', animation: 'fade_in' },
    ],
    musicStyle: 'upbeat',
    voiceStyle: 'energetic',
    captionsDefault: true,
  },
  {
    name: 'Instagram Reels Showcase',
    platform: 'instagram_reels',
    aspectRatio: '9:16',
    durationSeconds: 20,
    scenes: [
      { order: 1, type: 'hook', durationSeconds: 4, animation: 'fade_in' },
      { order: 2, type: 'product', durationSeconds: 6, productPosition: 'full' },
      { order: 3, type: 'benefits', durationSeconds: 5, animation: 'slide' },
      { order: 4, type: 'social_proof', durationSeconds: 3 },
      { order: 5, type: 'cta', durationSeconds: 2, cta: true },
    ],
    captionsDefault: true,
  },
  {
    name: 'YouTube Shorts Promo',
    platform: 'youtube_shorts',
    aspectRatio: '9:16',
    durationSeconds: 30,
    scenes: [
      { order: 1, type: 'hook', durationSeconds: 4 },
      { order: 2, type: 'problem', durationSeconds: 5 },
      { order: 3, type: 'product', durationSeconds: 8, productPosition: 'center' },
      { order: 4, type: 'benefits', durationSeconds: 7 },
      { order: 5, type: 'cta', durationSeconds: 6, cta: true },
    ],
  },
  {
    name: 'Feed Square Product',
    platform: 'instagram_feed',
    aspectRatio: '1:1',
    durationSeconds: 12,
    scenes: [
      { order: 1, type: 'product', durationSeconds: 5, productPosition: 'center' },
      { order: 2, type: 'benefits', durationSeconds: 4 },
      { order: 3, type: 'cta', durationSeconds: 3, cta: true },
    ],
  },
  {
    name: 'Facebook Ad Landscape',
    platform: 'facebook_ads',
    aspectRatio: '16:9',
    durationSeconds: 20,
    scenes: [
      { order: 1, type: 'hook', durationSeconds: 4 },
      { order: 2, type: 'product', durationSeconds: 8 },
      { order: 3, type: 'benefits', durationSeconds: 5 },
      { order: 4, type: 'cta', durationSeconds: 3, cta: true },
    ],
  },
  {
    name: 'UGC Style Testimonial',
    platform: 'ugc',
    aspectRatio: '9:16',
    durationSeconds: 18,
    scenes: [
      { order: 1, type: 'hook', durationSeconds: 3 },
      { order: 2, type: 'social_proof', durationSeconds: 6 },
      { order: 3, type: 'product', durationSeconds: 5 },
      { order: 4, type: 'cta', durationSeconds: 4, cta: true },
    ],
    voiceStyle: 'casual',
  },
  {
    name: 'Product Showcase',
    platform: 'showcase',
    aspectRatio: '4:5',
    durationSeconds: 15,
    scenes: [
      { order: 1, type: 'product', durationSeconds: 6, productPosition: 'full', animation: 'scale' },
      { order: 2, type: 'benefits', durationSeconds: 5 },
      { order: 3, type: 'cta', durationSeconds: 4, cta: true },
    ],
  },
  {
    name: 'Sale / Discount Burst',
    platform: 'sale',
    aspectRatio: '9:16',
    durationSeconds: 12,
    scenes: [
      { order: 1, type: 'hook', durationSeconds: 3, animation: 'pop' },
      { order: 2, type: 'product', durationSeconds: 5 },
      { order: 3, type: 'cta', durationSeconds: 4, cta: true, animation: 'pop' },
    ],
    musicStyle: 'energetic',
  },
];

export class TemplateCatalogService {
  constructor(private readonly db: Database) {}

  /** Definitions for platforms — independent of DB rows. */
  listDefinitions(): TemplateDefinition[] {
    return CATALOG.map((t, i) => ({
      ...t,
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    }));
  }

  getDefinition(id: string): TemplateDefinition | null {
    return this.listDefinitions().find((t) => t.id === id) ?? null;
  }

  async listDbTemplates(): Promise<Template[]> {
    const rows = await this.db.select().from(templates).where(eq(templates.status, 'active'));
    return rows as unknown as Template[];
  }

  async getDbTemplate(id: string): Promise<Template> {
    const rows = await this.db.select().from(templates).where(eq(templates.id, id)).limit(1);
    if (!rows[0]) throw new NotFoundError('Template');
    return rows[0] as unknown as Template;
  }

  matchDefinitionToAspect(aspect: AspectRatio, platform?: TemplatePlatform): TemplateDefinition[] {
    return this.listDefinitions().filter(
      (t) => t.aspectRatio === aspect && (!platform || t.platform === platform),
    );
  }
}
