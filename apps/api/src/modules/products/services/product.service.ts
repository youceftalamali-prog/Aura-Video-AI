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
import { AppError, NotFoundError } from '@aura/shared';
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
    await this.maybeCharge(workspaceId, amount, {
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
