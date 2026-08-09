import { getDb } from '../../db/client.js';
import { PublishingService } from './services/publishing.service.js';
import { PublishingController } from './controllers/publishing.controller.js';
import { createPublishingRoutes } from './routes/publishing.routes.js';

export function createPublishingModule() {
  const db = getDb();
  const service = new PublishingService(db);
  const controller = new PublishingController(service, db);
  const routes = createPublishingRoutes(controller);
  return { routes, controller, service };
}
