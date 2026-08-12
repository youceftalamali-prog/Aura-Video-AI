import { eq, asc } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { templates } from '../../../db/schema.js';
import type {
  CreativeStrategy,
  ProductAnalysis,
  Template,
  TemplateRecommendation,
  TemplateFit,
} from '@aura/types';
import { NotFoundError } from '@aura/shared';

export class TemplateService {
  constructor(private readonly db: Database) {}

  async listActive(): Promise<Template[]> {
    const rows = await this.db
      .select()
      .from(templates)
      .where(eq(templates.status, 'published'))
      .orderBy(asc(templates.sortOrder));
    return rows as unknown as Template[];
  }

  async getById(id: string): Promise<Template | null> {
    const rows = await this.db.select().from(templates).where(eq(templates.id, id)).limit(1);
    return (rows[0] as unknown as Template | undefined) ?? null;
  }

  async getByIdOrThrow(id: string): Promise<Template> {
    const t = await this.getById(id);
    if (!t || t.status !== 'active') {
      throw new NotFoundError('Template');
    }
    return t;
  }

  /**
   * Deterministic ranking based on category, duration, aspect ratio, premium flags.
   * AI is not required for ranking; optional reason strings are rule-based.
   */
  recommend(
    productAnalysis: ProductAnalysis,
    strategy: CreativeStrategy,
    all: Template[],
    limit = 5,
  ): TemplateRecommendation[] {
    const scored = all
      .filter((t) => t.status === 'active')
      .map((t) => {
        let score = 0.4;
        const reasons: string[] = [];

        const cat = (t.category || '').toLowerCase();
        const productCat = productAnalysis.category.toLowerCase();
        if (cat && (productCat.includes(cat) || cat.includes(productCat.split(' ')[0] || ''))) {
          score += 0.2;
          reasons.push(`Category match (${t.category})`);
        }

        if (t.aspectRatio === strategy.suggestedAspectRatio) {
          score += 0.15;
          reasons.push(`Aspect ratio ${t.aspectRatio}`);
        }

        const dur = t.durationSeconds ?? 15;
        const diff = Math.abs(dur - strategy.suggestedDuration);
        if (diff <= 3) {
          score += 0.15;
          reasons.push('Duration close to strategy');
        } else if (diff <= 8) {
          score += 0.08;
        }

        if (!t.isPremium) {
          score += 0.05;
          reasons.push('Available on standard plans');
        }

        // Soft keyword overlap with template name/description
        const blob = `${t.name} ${t.description ?? ''}`.toLowerCase();
        const keywords = productAnalysis.keywords.slice(0, 8);
        const hits = keywords.filter((k) => blob.includes(k.toLowerCase())).length;
        if (hits > 0) {
          score += Math.min(0.1, hits * 0.03);
          reasons.push(`Keyword overlap (${hits})`);
        }

        score = Math.min(0.99, Math.round(score * 100) / 100);
        const fit = this.toFit(score);

        return {
          templateId: t.id,
          score,
          reason: reasons.length ? reasons.join('; ') : 'General product ad template',
          fit,
          name: t.name,
          category: t.category,
          thumbnailUrl: t.thumbnailUrl,
          creditsCost: t.creditsCost,
          aspectRatio: t.aspectRatio,
          durationSeconds: t.durationSeconds,
        } satisfies TemplateRecommendation;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  private toFit(score: number): TemplateFit {
    if (score >= 0.85) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'fair';
    return 'poor';
  }
}
