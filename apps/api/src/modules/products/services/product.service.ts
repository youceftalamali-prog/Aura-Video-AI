import { randomUUID } from 'node:crypto';
import type {
  ProductImportResult,
  ProductIntelligence,
  ProductRecord,
  ImportTextInput,
  ImportImageInput,
  CreateVideoFromProductInput,
  CreateVideoFromProductResult,
  GeneratedHook,
  ProductAnalysis,
  RoutingStrategy,
} from '@aura/types';
import { NotFoundError } from '@aura/shared';
import type { ProductRepository } from './product.repository.js';
import type { ProductIntelligenceRepository } from './product-intelligence.repository.js';
import type { UrlImportService } from './url-import.service.js';
import type { ProductIntelligenceService } from './product-intelligence.service.js';
import type { ProductAnalysisService } from '../../ai/services/product-analysis.service.js';
import type { CreativeStrategyService } from '../../creative/services/creative-strategy.service.js';
import type { AdScriptService } from '../../creative/services/ad-script.service.js';
import type { StoryboardService } from '../../creative/services/storyboard.service.js';
import type { TemplateService } from '../../creative/services/template.service.js';
import { getEnv } from '@aura/config';
import type { CreditLedgerService } from '../../video/services/credit-ledger.service.js';

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', event, ts: new Date().toISOString(), ...payload }));
}

export class ProductService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly urlImport: UrlImportService,
    private readonly analysis: ProductAnalysisService,
    private readonly intelligence: ProductIntelligenceService,
    private readonly strategy: CreativeStrategyService,
    private readonly script: AdScriptService,
    private readonly storyboard: StoryboardService,
    private readonly templates: TemplateService,
    private readonly credits: CreditLedgerService | null,
    private readonly intelligenceRepo: ProductIntelligenceRepository | null = null,
  ) {}

  async list(userId: string): Promise<ProductRecord[]> {
    return this.repo.listForUser(userId);
  }

  async get(userId: string, id: string): Promise<ProductRecord> {
    const p = await this.repo.findByIdForUser(id, userId);
    if (!p) throw new NotFoundError('Product');
    return p;
  }

  async delete(userId: string, id: string): Promise<void> {
    const ok = await this.repo.delete(id, userId);
    if (!ok) throw new NotFoundError('Product');
  }

  async importUrl(userId: string, workspaceId: string, url: string, strategy?: RoutingStrategy): Promise<ProductImportResult> {
    log('import_started', { source: 'url', userId });
    const operationKey = randomUUID();
    await this.maybeCharge(workspaceId, userId, operationKey);
    try {
      const extracted = await this.urlImport.extract(url);
      const analysis = await this.analysis.analyzeFromText({
        name: extracted.name || 'Untitled product',
        description: extracted.description || extracted.rawFacts.description || extracted.name || 'Product',
        metadata: { sourceUrl: url, extracted },
        strategy,
      });
      analysis.sourceType = 'url';
      analysis.sourceUrl = url;
      analysis.imageUrl = extracted.images[0] ?? null;

      const intel = await this.intelligence.build(analysis, extracted, strategy);
      const product = await this.repo.create({
        workspaceId,
        userId,
        name: analysis.productName,
        description: analysis.longDescription || analysis.shortDescription,
        imageUrl: extracted.images[0] ?? null,
        price: extracted.price,
        currency: extracted.currency,
        externalSource: extracted.sourcePlatform,
        metadata: { intelligence: intel, extracted, analysis },
      });
      await this.intelligenceRepo?.saveReady(product.id, intel, extracted);
      log('import_completed', { productId: product.id, source: 'url' });
      return { product, intelligence: intel, extracted };
    } catch (err) {
      await this.maybeRefund(workspaceId, userId, operationKey);
      throw err;
    }
  }

  async importText(userId: string, workspaceId: string, input: ImportTextInput): Promise<ProductImportResult> {
    log('import_started', { source: 'text', userId });
    const operationKey = randomUUID();
    await this.maybeCharge(workspaceId, userId, operationKey);
    try {
      const analysis = await this.analysis.analyzeFromText({
        name: input.name,
        description: input.description,
        metadata: { brand: input.brand, price: input.price },
        strategy: input.strategy,
      });
      analysis.sourceType = 'text';
      const intel = await this.intelligence.build(analysis, null, input.strategy);
      const product = await this.repo.create({
        workspaceId,
        userId,
        name: analysis.productName,
        description: analysis.longDescription || input.description,
        price: input.price ?? null,
        currency: input.currency ?? null,
        externalSource: 'text',
        metadata: { intelligence: intel, analysis },
      });
      await this.intelligenceRepo?.saveReady(product.id, intel, null);
      return { product, intelligence: intel, extracted: null };
    } catch (err) {
      await this.maybeRefund(workspaceId, userId, operationKey);
      throw err;
    }
  }

  async importImage(userId: string, workspaceId: string, input: ImportImageInput): Promise<ProductImportResult> {
    log('import_started', { source: 'image', userId });
    const operationKey = randomUUID();
    await this.maybeCharge(workspaceId, userId, operationKey);
    try {
      const analysis = await this.analysis.analyzeFromImage({
        imageUrl: input.imageUrl,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        name: input.name,
        description: input.description,
        strategy: input.strategy,
      });
      analysis.sourceType = 'image';
      analysis.imageUrl = input.imageUrl ?? analysis.imageUrl;
      const intel = await this.intelligence.build(analysis, null, input.strategy);
      const product = await this.repo.create({
        workspaceId,
        userId,
        name: analysis.productName,
        description: analysis.longDescription || analysis.shortDescription,
        imageUrl: input.imageUrl ?? null,
        externalSource: 'image',
        metadata: { intelligence: intel, analysis },
      });
      await this.intelligenceRepo?.saveReady(product.id, intel, null);
      return { product, intelligence: intel, extracted: null };
    } catch (err) {
      await this.maybeRefund(workspaceId, userId, operationKey);
      throw err;
    }
  }

  async getIntelligence(userId: string, productId: string): Promise<ProductIntelligence> {
    const product = await this.get(userId, productId);
    const stored = await this.intelligenceRepo?.getByProductId(productId);
    if (stored?.status === 'ready' && stored.intelligence) {
      return stored.intelligence;
    }

    const meta = product.metadata || {};
    if (meta.intelligence) return meta.intelligence as unknown as ProductIntelligence;
    return this.refreshIntelligence(userId, productId);
  }

  async refreshIntelligence(
    userId: string,
    productId: string,
    strategy?: RoutingStrategy,
  ): Promise<ProductIntelligence> {
    const product = await this.get(userId, productId);
    const meta = product.metadata || {};
    try {
      const extracted = (meta.extracted as unknown as import('@aura/types').ExtractedProductData) || null;
      const analysis =
        (meta.analysis as unknown as ProductAnalysis) ||
        (await this.analysis.analyzeFromText({
          name: product.name,
          description: product.description || product.name,
          strategy,
        }));
      const intel = await this.intelligence.build(analysis, extracted, strategy);
      await this.repo.updateMetadata(productId, { ...meta, intelligence: intel, analysis });
      await this.intelligenceRepo?.saveReady(productId, intel, extracted);
      return intel;
    } catch (err) {
      await this.intelligenceRepo?.markFailed(productId, err instanceof Error ? err.name : 'PRODUCT_INTELLIGENCE_FAILED');
      throw err;
    }
  }

  async generateHooks(userId: string, productId: string, strategy?: RoutingStrategy): Promise<GeneratedHook[]> {
    const intel = await this.getIntelligence(userId, productId);
    return this.intelligence.generateHooks(intel.analysis, intel, strategy);
  }

  async createVideoWorkflow(
    userId: string,
    input: CreateVideoFromProductInput,
  ): Promise<CreateVideoFromProductResult> {
    const product = await this.get(userId, input.productId);
    const intel = await this.getIntelligence(userId, product.id);
    const analysis = intel.analysis;

    const angle =
      intel.marketingAngles.find((a) => a.type === input.angleType) ||
      intel.marketingAngles.find((a) => a.recommended) ||
      intel.marketingAngles[0] ||
      null;

    const userRequest = [
      angle ? `Marketing angle: ${angle.title} — ${angle.description}` : '',
      input.hookText ? `Use hook: ${input.hookText}` : '',
      input.platform ? `Platform: ${input.platform}` : '',
      input.tone ? `Tone: ${input.tone}` : '',
      input.duration ? `Duration: ${input.duration}s` : '',
    ]
      .filter(Boolean)
      .join('\n');

    log('video_workflow_started', { productId: product.id, userId });

    const strategy = await this.strategy.generate({
      productAnalysis: analysis,
      userRequest: userRequest || undefined,
      preferredDuration: input.duration,
      preferredAspectRatio: input.aspectRatio,
    });

    const script = await this.script.generate({
      productAnalysis: analysis,
      creativeStrategy: strategy,
    });

    const storyboard = await this.storyboard.generate({
      adScript: script,
      creativeStrategy: strategy,
      aspectRatio: input.aspectRatio || strategy.suggestedAspectRatio,
    });

    const allTemplates = await this.templates.listActive();
    const templateRecommendations = this.templates.recommend(analysis, strategy, allTemplates, 5);

    log('storyboard_generated', { productId: product.id });

    return {
      productId: product.id,
      analysis,
      intelligence: intel,
      strategy,
      script,
      storyboard,
      templateRecommendations,
      selectedHook: input.hookText ?? intel.contentRecommendations.hooks[0] ?? null,
      selectedAngle: angle,
    };
  }

  private async maybeCharge(workspaceId: string, userId: string, operationKey: string): Promise<void> {
    const env = getEnv();
    if (!env.PRODUCT_ANALYSIS_ENABLED_BILLING || !this.credits) return;
    const amount = env.PRODUCT_ANALYSIS_CREDITS;
    if (amount <= 0) return;
    await this.credits.deduct(workspaceId, amount, {
      userId,
      description: 'Product analysis charge',
      referenceType: 'product_analysis',
      referenceId: operationKey,
      idempotencyKey: `product:analysis:charge:${operationKey}`,
    });
  }

  private async maybeRefund(workspaceId: string, userId: string, operationKey: string): Promise<void> {
    const env = getEnv();
    if (!env.PRODUCT_ANALYSIS_ENABLED_BILLING || !this.credits) return;
    const amount = env.PRODUCT_ANALYSIS_CREDITS;
    if (amount <= 0) return;
    await this.credits.refund(workspaceId, amount, {
      userId,
      description: 'Refund for failed product analysis',
      referenceType: 'product_analysis_refund',
      referenceId: operationKey,
      idempotencyKey: `product:analysis:refund:${operationKey}`,
    });
  }
}
