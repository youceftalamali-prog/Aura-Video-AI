import { getDb } from '../../db/client.js';
import { getAIProvider, getUrlMetadataExtractor } from '../ai/providers/index.js';
import { getAIGateway } from '../ai/gateway/index.js';
import { ProductAnalysisService } from '../ai/services/product-analysis.service.js';
import { ProductRepository } from '../products/services/product.repository.js';
import { UrlImportService } from '../products/services/url-import.service.js';
import { ProductIntelligenceService } from '../products/services/product-intelligence.service.js';
import { ProductService } from '../products/services/product.service.js';
import { CreativeStrategyService } from '../creative/services/creative-strategy.service.js';
import { AdScriptService } from '../creative/services/ad-script.service.js';
import { StoryboardService } from '../creative/services/storyboard.service.js';
import { TemplateService } from '../creative/services/template.service.js';
import { CreditLedgerService } from '../video/services/credit-ledger.service.js';
import { BrandKitService } from '../studio/services/brand-kit.service.js';
import { TemplateLibraryService } from './services/template-library.service.js';
import { TemplatesController } from './controllers/templates.controller.js';
import { createTemplatesRoutes } from './routes/templates.routes.js';

export function createTemplatesModule() {
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
  const productService = new ProductService(
    new ProductRepository(db),
    new UrlImportService(),
    analysis,
    intelligence,
    strategy,
    script,
    storyboard,
    templates,
    credits,
  );
  const brandKit = new BrandKitService(db);
  const library = new TemplateLibraryService(db, productService, strategy, script, storyboard, brandKit);
  const controller = new TemplatesController(library);
  const routes = createTemplatesRoutes(controller);
  return { routes, controller, library };
}
