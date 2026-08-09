import { getDb } from '../../db/client.js';
import { ProjectRepository } from '../../domain/repositories/project.repository.js';
import { AssetRepository } from '../../domain/repositories/asset.repository.js';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository.js';
import { LibraryService } from './services/library.service.js';
import { LibraryController } from './controllers/library.controller.js';
import { createLibraryRoutes } from './routes/library.routes.js';

export function createLibraryModule() {
  const db = getDb();
  const service = new LibraryService(
    new ProjectRepository(db),
    new AssetRepository(db),
    new WorkspaceRepository(db),
  );
  const controller = new LibraryController(service);
  const routes = createLibraryRoutes(controller);
  return { routes, controller, service };
}
