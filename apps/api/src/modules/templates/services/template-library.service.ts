import { eq, and, asc, ilike, or, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { templates } from '../../../db/schema.js';
import type {
  LibraryTemplateCategory,
  LibraryTemplate,
  InstantiateTemplateResult,
  GenerateFromTemplateResult,
  LibraryTemplateSceneDefinition,
  TemplateCustomization,
  TemplatePreviewConfig,
} from '@aura/types';
import { AppError } from '@aura/shared';
import { TEMPLATE_CATEGORIES, TEMPLATE_SEEDS } from '../data/catalog.js';
import type { ProductService } from '../../products/services/product.service.js';
import type { CreativeStrategyService } from '../../creative/services/creative-strategy.service.js';
import type { AdScriptService } from '../../creative/services/ad-script.service.js';
import type { StoryboardService } from '../../creative/services/storyboard.service.js';
import type { BrandKitService } from '../../studio/services/brand-kit.service.js';

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', event, ts: new Date().toISOString(), ...payload }));
}

export class TemplateLibraryService {
  private seeded = false;

  constructor(
    private readonly db: Database,
    private readonly products: ProductService,
    private readonly strategy: CreativeStrategyService,
    private readonly script: AdScriptService,
    private readonly storyboard: StoryboardService,
    private readonly brandKit: BrandKitService,
  ) {}

  /** Ensure seed templates exist in DB (idempotent by slug). */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    for (const seed of TEMPLATE_SEEDS) {
      const existing = await this.db
        .select()
        .from(templates)
        .where(eq(templates.slug, seed.slug))
        .limit(1);
      if (existing[0]) continue;
      await this.db.insert(templates).values({
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        category: seed.category,
        subCategory: seed.subCategory ?? null,
        durationSeconds: seed.durationSeconds,
        aspectRatio: '9:16',
        status: 'published',
        isFeatured: seed.isFeatured ?? false,
        sortOrder: 0,
        creditsCost: 10,
        metadata: {
          tags: seed.tags,
          scenes: seed.scenes,
          supportedProductTypes: seed.supportedProductTypes,
          hasRealPreview: false,
        },
      });
    }
    this.seeded = true;
    log('templates_seeded', { count: TEMPLATE_SEEDS.length });
  }

  async listCategories(): Promise<LibraryTemplateCategory[]> {
    await this.ensureSeeded();
    const rows = await this.db
      .select({ category: templates.category, count: sql<number>`count(*)::int` })
      .from(templates)
      .where(eq(templates.status, 'published'))
      .groupBy(templates.category);

    const counts = new Map(rows.map((r) => [r.category, Number(r.count)]));
    return TEMPLATE_CATEGORIES.map((c) => ({
      ...c,
      templateCount: counts.get(c.slug) ?? 0,
    })).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listTemplates(filters: {
    category?: string;
    search?: string;
    featured?: boolean;
    aspectRatio?: string;
  }): Promise<LibraryTemplate[]> {
    await this.ensureSeeded();
    const conditions = [eq(templates.status, 'published')];
    if (filters.category) conditions.push(eq(templates.category, filters.category));
    if (filters.featured) conditions.push(eq(templates.isFeatured, true));
    if (filters.aspectRatio) conditions.push(eq(templates.aspectRatio, filters.aspectRatio));
    if (filters.search) {
      conditions.push(
        or(
          ilike(templates.name, `%${filters.search}%`),
          ilike(templates.description, `%${filters.search}%`),
        )!,
      );
    }
    const rows = await this.db
      .select()
      .from(templates)
      .where(and(...conditions))
      .orderBy(asc(templates.sortOrder), asc(templates.name));
    return rows.map((r) => this.mapTemplate(r));
  }

  async getByIdOrSlug(idOrSlug: string): Promise<LibraryTemplate> {
    await this.ensureSeeded();
    const byId = await this.db.select().from(templates).where(eq(templates.id, idOrSlug)).limit(1);
    if (byId[0] && byId[0].status === 'published') return this.mapTemplate(byId[0]);
    const bySlug = await this.db.select().from(templates).where(eq(templates.slug, idOrSlug)).limit(1);
    if (bySlug[0] && bySlug[0].status === 'published') return this.mapTemplate(bySlug[0]);
    throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  async instantiate(userId: string, templateId: string, productId: string): Promise<InstantiateTemplateResult> {
    const template = await this.getByIdOrSlug(templateId);
    if (template.status !== 'published') {
      throw new AppError('Template not available', 400, 'TEMPLATE_NOT_AVAILABLE');
    }
    const product = await this.products.get(userId, productId);
    const intel = await this.products.getIntelligence(userId, productId);
    const analysis = intel.analysis;
    if (!analysis) throw new AppError('Product analysis missing', 400, 'INVALID_PRODUCT');

    const productName = analysis.productName || product.name;
    const scenes = template.scenes.map((s) => ({
      order: s.order,
      duration: s.durationSeconds,
      type: s.type,
      visualPrompt: s.visualPromptTemplate.replace(/\{\{product\}\}/gi, productName),
      onScreenText: s.textPlaceholder,
    }));

    const styleNotes = [
      `Category: ${template.category}`,
      intel.marketingProfile?.primaryBenefit ? `Benefit: ${intel.marketingProfile.primaryBenefit}` : '',
      analysis.visualStyle ? `Visual style: ${analysis.visualStyle}` : '',
      analysis.brandTone ? `Tone: ${analysis.brandTone}` : '',
    ]
      .filter(Boolean)
      .join('; ');

    log('template_instantiated', { templateId: template.id, productId });

    return {
      templateId: template.id,
      productId,
      analysis,
      intelligence: intel,
      generationConfig: {
        aspectRatio: String(template.aspectRatio),
        duration: template.durationSeconds || scenes.reduce((a, s) => a + s.duration, 0),
        scenes,
        styleNotes,
      },
    };
  }

  async generate(
    userId: string,
    templateId: string,
    productId: string,
    opts?: { aspectRatio?: string; duration?: number },
  ): Promise<GenerateFromTemplateResult> {
    const inst = await this.instantiate(userId, templateId, productId);
    const analysis = inst.analysis;
    const userRequest = [
      `Use template style: ${inst.generationConfig.styleNotes || ''}`,
      `Follow scene structure with ${inst.generationConfig.scenes.length} scenes`,
      inst.generationConfig.styleNotes,
    ].join('\n');

    try {
      const strategy = await this.strategy.generate({
        productAnalysis: analysis,
        userRequest,
        preferredDuration: opts?.duration || inst.generationConfig.duration,
        preferredAspectRatio: (opts?.aspectRatio || inst.generationConfig.aspectRatio) as never,
      });
      const script = await this.script.generate({ productAnalysis: analysis, creativeStrategy: strategy });
      const storyboard = await this.storyboard.generate({
        adScript: script,
        creativeStrategy: strategy,
        aspectRatio: (opts?.aspectRatio || inst.generationConfig.aspectRatio) as never,
      });

      log('template_generation_completed', { templateId, productId });

      return {
        templateId: inst.templateId,
        productId,
        strategy,
        script,
        storyboard,
        generationConfig: inst.generationConfig,
      };
    } catch (err) {
      log('template_generation_failed', { templateId, productId, error: (err as unknown as Error).message });
      throw new AppError(
        `Template generation failed: ${(err as unknown as Error).message}`,
        502,
        'TEMPLATE_GENERATION_FAILED',
      );
    }
  }


  async buildPreviewConfig(
    userId: string,
    templateId: string,
    customization: TemplateCustomization,
  ): Promise<TemplatePreviewConfig> {
    const template = await this.getByIdOrSlug(templateId);
    if (template.status !== 'published') {
      throw new AppError('Template not available', 400, 'TEMPLATE_NOT_AVAILABLE');
    }
    const product = await this.products.get(userId, customization.productId);
    const intel = await this.products.getIntelligence(userId, customization.productId);
    const analysis = intel.analysis;
    const productName = analysis.productName || product.name;

    let brand = { brandName: null as string | null, primaryColor: null as string | null, logoUrl: null as string | null };
    if (customization.brandKitApplied !== false) {
      try {
        const kit = await this.brandKit.get(product.workspaceId);
        brand = {
          brandName: kit.brandName || null,
          primaryColor: kit.primaryColor || null,
          logoUrl: kit.logoUrl || null,
        };
      } catch {
        /* brand kit optional */
      }
    }

    const text = customization.textOverrides || {};
    const media = customization.mediaOverrides || {};
    const headline = text.headline || analysis.sellingPoints?.[0] || productName;
    const subheadline = text.subheadline || analysis.shortDescription || '';
    const cta = text.cta || analysis.callToAction || 'Shop now';
    const brandName = text.brandName || brand.brandName || '';

    const scenes = template.scenes.map((s) => {
      const dur = customization.sceneDurationOverrides?.[s.order] ?? s.durationSeconds;
      let onScreen = text.sceneTexts?.[String(s.order)] || s.textPlaceholder;
      if (s.type === 'hook' && text.headline) onScreen = headline;
      if (s.type === 'cta') onScreen = cta;
      const visualPrompt = s.visualPromptTemplate
        .replace(/\{\{product\}\}/gi, productName)
        .replace(/\{\{brand\}\}/gi, brandName || productName);
      return {
        order: s.order,
        type: s.type,
        title: s.title,
        duration: dur,
        visualPrompt,
        onScreenText: onScreen,
      };
    });

    const duration = scenes.reduce((a, s) => a + s.duration, 0);
    const aspectRatio = customization.aspectRatio || String(template.aspectRatio);

    return {
      templateId: template.id,
      productId: customization.productId,
      productName,
      aspectRatio,
      duration,
      scenes,
      textOverrides: {
        headline,
        subheadline,
        cta,
        brandName,
        sceneTexts: text.sceneTexts,
      },
      mediaOverrides: {
        productImageUrl: media.productImageUrl || product.imageUrl || analysis.imageUrl || undefined,
        logoUrl: media.logoUrl || brand.logoUrl || undefined,
      },
      brand,
      hasRealPreview: template.hasRealPreview,
      previewVideoUrl: template.previewVideoUrl,
      previewImageUrl: (template.metadata as unknown as Record<string, unknown> | null)?.previewImageUrl as string | null ?? null,
      thumbnailUrl: template.thumbnailUrl,
    };
  }

  async customizeAndInstantiate(
    userId: string,
    templateId: string,
    customization: TemplateCustomization,
  ): Promise<InstantiateTemplateResult & { preview: TemplatePreviewConfig }> {
    const preview = await this.buildPreviewConfig(userId, templateId, customization);
    const base = await this.instantiate(userId, templateId, customization.productId);

    // Apply customization overlays onto generation config
    const scenes = preview.scenes.map((s) => ({
      order: s.order,
      duration: s.duration,
      type: s.type,
      visualPrompt: s.visualPrompt,
      onScreenText: s.onScreenText,
    }));

    const styleNotes = [
      base.generationConfig.styleNotes,
      preview.textOverrides.headline ? `Headline: ${preview.textOverrides.headline}` : '',
      preview.textOverrides.cta ? `CTA: ${preview.textOverrides.cta}` : '',
      preview.brand.primaryColor ? `Brand color: ${preview.brand.primaryColor}` : '',
    ]
      .filter(Boolean)
      .join('; ');

    return {
      ...base,
      generationConfig: {
        aspectRatio: preview.aspectRatio,
        duration: preview.duration,
        scenes,
        styleNotes,
      },
      preview,
    };
  }

  async generateWithCustomization(
    userId: string,
    templateId: string,
    customization: TemplateCustomization,
  ): Promise<GenerateFromTemplateResult & { preview: TemplatePreviewConfig }> {
    const customized = await this.customizeAndInstantiate(userId, templateId, customization);
    const analysis = customized.analysis;
    const userRequest = [
      `Template customization applied`,
      customized.generationConfig.styleNotes,
      `Headline: ${customized.preview.textOverrides.headline || ''}`,
      `CTA: ${customized.preview.textOverrides.cta || ''}`,
    ].join('\n');

    try {
      const strategy = await this.strategy.generate({
        productAnalysis: analysis,
        userRequest,
        preferredDuration: customized.generationConfig.duration,
        preferredAspectRatio: customized.generationConfig.aspectRatio as never,
      });
      const script = await this.script.generate({ productAnalysis: analysis, creativeStrategy: strategy });
      const storyboard = await this.storyboard.generate({
        adScript: script,
        creativeStrategy: strategy,
        aspectRatio: customized.generationConfig.aspectRatio as never,
      });
      log('template_custom_generation_completed', {
        templateId,
        productId: customization.productId,
      });
      return {
        templateId: customized.templateId,
        productId: customization.productId,
        strategy,
        script,
        storyboard,
        generationConfig: customized.generationConfig,
        preview: customized.preview,
      };
    } catch (err) {
      throw new AppError(
        `Template generation failed: ${(err as unknown as Error).message}`,
        502,
        'TEMPLATE_GENERATION_FAILED',
      );
    }
  }

  private mapTemplate(row: Record<string, unknown>): LibraryTemplate {
    const meta = (row.metadata as unknown as Record<string, unknown>) || {};
    const scenes = (meta.scenes as unknown as LibraryTemplateSceneDefinition[]) || [];
    const tags = (meta.tags as string[]) || [];
    const supported = (meta.supportedProductTypes as string[]) || [];
    const hasRealPreview = Boolean(meta.hasRealPreview && row.previewVideoUrl);
    return {
      id: String(row.id),
      slug: String(row.slug || row.id),
      name: String(row.name),
      description: (row.description as string) ?? null,
      category: String(row.category),
      subCategory: (row.subCategory as string) ?? null,
      thumbnailUrl: (row.thumbnailUrl as string) ?? null,
      previewVideoUrl: (row.previewVideoUrl as string) ?? null,
      hasRealPreview,
      durationSeconds: (row.durationSeconds as number) ?? null,
      aspectRatio: String(row.aspectRatio || '9:16'),
      creditsCost: Number(row.creditsCost ?? 10),
      status: String(row.status),
      isPremium: Boolean(row.isPremium),
      isFeatured: Boolean(row.isFeatured),
      sortOrder: Number(row.sortOrder ?? 0),
      tags,
      scenes,
      supportedProductTypes: supported,
      metadata: meta,
      createdAt: row.createdAt ? new Date(row.createdAt as unknown as Date).toISOString() : undefined,
      updatedAt: row.updatedAt ? new Date(row.updatedAt as unknown as Date).toISOString() : undefined,
    };
  }
}
