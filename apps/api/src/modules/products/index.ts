import { getDb } from '../../db/client.js';
import { getAIProvider, getUrlMetadataExtractor } from '../ai/providers/index.js';
import { getAIGateway } from '../ai/gateway/index.js';
import { ProductAnalysisService } from '../ai/services/product-analysis.service.js';
import { CreativeStrategyService } from '../creative/services/creative-strategy.service.js';
import { AdScriptService } from '../creative/services/ad-script.service.js';
import { StoryboardService } from '../creative/services/storyboard.service.js';
import { TemplateService } from '../creative/services/template.service.js';
import { CreditLedgerService } from '../video/services/credit-ledger.service.js';
import { ProductRepository } from './services/product.repository.js';
import { ProductIntelligenceRepository, DbProductIntelligenceRepository } from './services/product-intelligence.repository.js';
import { UrlImportService } from './services/url-import.service.js';
import { ProductIntelligenceService } from './services/product-intelligence.service.js';
import { ProductService } from './services/product.service.js';
import { ProductsController } from './controllers/products.controller.js';
import { createProductsRoutes } from './routes/products.routes.js';

export function createProductsModule() {
  const db = getDb();
  const ai = getAIProvider();
  const urlExtractor = getUrlMetadataExtractor();
  const analysis = new ProductAnalysisService(getAIGateway(), urlExtractor);
  const intelligence = new ProductIntelligenceService(ai);
  const strategy = new CreativeStrategyService(ai);
  const script = new AdScriptService(ai);
  const storyboard = new StoryboardService(ai);
  const templates = new TemplateService(db);
  const credits = new CreditLedgerService(db);
  const repo = new ProductRepository(db);
  const intelligenceRepo: ProductIntelligenceRepository = new DbProductIntelligenceRepository(db);
  const urlImport = new UrlImportService();
  const service = new ProductService(
    repo,
    urlImport,
    analysis,
    intelligence,
    strategy,
    script,
    storyboard,
    templates,
    credits,
    intelligenceRepo,
  );
  const controller = new ProductsController(service, db);
  const routes = createProductsRoutes(controller);
  return { routes, controller, service };
}
