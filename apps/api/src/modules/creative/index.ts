import { getDb } from '../../db/client.js';
import { getAIProvider } from '../ai/providers/index.js';
import { CreativeStrategyService } from './services/creative-strategy.service.js';
import { AdScriptService } from './services/ad-script.service.js';
import { StoryboardService } from './services/storyboard.service.js';
import { TemplateService } from './services/template.service.js';
import { CreativeController } from './controllers/creative.controller.js';
import { createCreativeRoutes } from './routes/creative.routes.js';

export function createCreativeModule() {
  const db = getDb();
  const ai = getAIProvider();
  const strategyService = new CreativeStrategyService(ai);
  const scriptService = new AdScriptService(ai);
  const storyboardService = new StoryboardService(ai);
  const templateService = new TemplateService(db);
  const controller = new CreativeController(
    strategyService,
    scriptService,
    storyboardService,
    templateService,
  );
  const routes = createCreativeRoutes(controller);

  return {
    routes,
    controller,
    strategyService,
    scriptService,
    storyboardService,
    templateService,
  };
}
