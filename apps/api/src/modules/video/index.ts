import { getDb } from '../../db/client.js';
import { getMediaProvider } from './providers/index.js';
import { VideoJobRepository } from './services/video-job.repository.js';
import { VideoGenerationService } from './services/video-generation.service.js';
import { VideoController } from './controllers/video.controller.js';
import { createVideoRoutes } from './routes/video.routes.js';

export function createVideoModule() {
  const db = getDb();
  const media = getMediaProvider();
  const jobs = new VideoJobRepository(db);
  const service = new VideoGenerationService(db, jobs, media);
  const controller = new VideoController(service);
  const routes = createVideoRoutes(controller);

  return { routes, controller, service, jobs };
}
