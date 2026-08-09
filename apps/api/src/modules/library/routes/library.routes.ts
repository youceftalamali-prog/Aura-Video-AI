import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { LibraryController } from '../controllers/library.controller.js';

export function createLibraryRoutes(controller: LibraryController): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  });
  router.use(requireAuth);
  router.use(limiter);

  router.get('/projects', controller.listProjects);
  router.post('/projects', controller.createProject);
  router.get('/projects/:id', controller.getProject);
  router.patch('/projects/:id', controller.updateProject);
  router.delete('/projects/:id', controller.deleteProject);

  router.get('/assets', controller.listAssets);
  router.get('/assets/:id', controller.getAsset);
  router.get('/assets/:id/export', controller.exportAsset);

  return router;
}
