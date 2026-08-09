import { getAIProvider, getUrlMetadataExtractor } from './providers/index.js';
import { ProductAnalysisService } from './services/product-analysis.service.js';
import { AIAssistantService } from './services/assistant.service.js';
import { AIController } from './controllers/ai.controller.js';
import { createAIRoutes } from './routes/ai.routes.js';

export function createAIModule() {
  const aiProvider = getAIProvider();
  const urlExtractor = getUrlMetadataExtractor();
  const productAnalysis = new ProductAnalysisService(aiProvider, urlExtractor);
  const assistant = new AIAssistantService(aiProvider);
  const controller = new AIController(productAnalysis, assistant);
  const routes = createAIRoutes(controller);

  return {
    routes,
    controller,
    productAnalysis,
    assistant,
  };
}

export type { IAIProvider } from './interfaces/ai-provider.interface.js';
export type { IUrlMetadataExtractor } from './interfaces/url-extractor.interface.js';
export { ProductAnalysisService } from './services/product-analysis.service.js';
export { AIAssistantService } from './services/assistant.service.js';
