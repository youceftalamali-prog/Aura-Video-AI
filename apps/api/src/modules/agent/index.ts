import { getDb } from '../../db/client.js';
import { getAIProvider, getUrlMetadataExtractor } from '../ai/providers/index.js';
import { getAIGateway } from '../ai/gateway/index.js';
import { ProductAnalysisService } from '../ai/services/product-analysis.service.js';
import { BillingService } from '../billing/services/billing.service.js';
import { CreativeStrategyService } from '../creative/services/creative-strategy.service.js';
import { AdScriptService } from '../creative/services/ad-script.service.js';
import { StoryboardService } from '../creative/services/storyboard.service.js';
import { TemplateService } from '../creative/services/template.service.js';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository.js';
import { SettingsRepository } from '../../domain/repositories/settings.repository.js';
import { CreditRepository } from '../../domain/repositories/credit.repository.js';
import { ProjectRepository } from '../../domain/repositories/project.repository.js';
import { AssetRepository } from '../../domain/repositories/asset.repository.js';
import { LibraryService } from '../library/services/library.service.js';
import { ProductRepository } from '../products/services/product.repository.js';
import { UrlImportService } from '../products/services/url-import.service.js';
import { ProductIntelligenceService } from '../products/services/product-intelligence.service.js';
import { ProductService } from '../products/services/product.service.js';
import { VideoGenerationService } from '../video/services/video-generation.service.js';
import { VideoJobRepository } from '../video/services/video-job.repository.js';
import { CreditLedgerService } from '../video/services/credit-ledger.service.js';
import { getMediaProvider } from '../video/providers/index.js';
import { AgentController } from './controllers/agent.controller.js';
import { createAgentRoutes } from './routes/agent.routes.js';
import { DbAgentConversationRepository } from './repositories/agent-conversation.repository.js';
import { AgentOrchestratorService } from './services/agent-orchestrator.service.js';
import { createCustomerToolRegistry } from './tools/index.js';

export function createAgentModule() {
  const db = getDb();
  const gateway = getAIGateway();
  const ai = getAIProvider();
  const workspaces = new WorkspaceRepository(db);

  const analysis = new ProductAnalysisService(gateway, getUrlMetadataExtractor());
  const products = new ProductService(
    new ProductRepository(db),
    new UrlImportService(),
    analysis,
    new ProductIntelligenceService(ai),
    new CreativeStrategyService(ai),
    new AdScriptService(ai),
    new StoryboardService(ai),
    new TemplateService(db),
    new CreditLedgerService(db),
  );

  const strategy = new CreativeStrategyService(ai);
  const script = new AdScriptService(ai);
  const storyboard = new StoryboardService(ai);
  const templates = new TemplateService(db);

  const video = new VideoGenerationService(db, new VideoJobRepository(db), getMediaProvider());
  const billing = new BillingService(db, workspaces, new CreditRepository(db));
  const settingsRepo = new SettingsRepository(db);
  const library = new LibraryService(new ProjectRepository(db), new AssetRepository(db), workspaces);

  const conversations = new DbAgentConversationRepository(db);
  const registry = createCustomerToolRegistry({
    products,
    analysis,
    strategy,
    script,
    storyboard,
    templates,
    video,
    library,
    billing,
    settingsRepo,
  });
  const orchestrator = new AgentOrchestratorService(gateway, registry, conversations);
  const controller = new AgentController(orchestrator, conversations, workspaces);
  const routes = createAgentRoutes(controller);

  return { routes, controller, orchestrator, registry, conversations };
}

export { AgentOrchestratorService } from './services/agent-orchestrator.service.js';
export { AgentToolRegistry } from './tools/index.js';
export { DbAgentConversationRepository, InMemoryAgentConversationRepository } from './repositories/agent-conversation.repository.js';
export type { AgentConversationRepository } from './repositories/agent-conversation.repository.js';
export { deterministicHash, canonicalStringify } from './services/tool-call-hash.js';
export { AgentController } from './controllers/agent.controller.js';
