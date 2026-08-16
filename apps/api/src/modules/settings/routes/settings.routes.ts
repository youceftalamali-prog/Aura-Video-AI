import { Router } from 'express';
import type { SettingsController } from '../controllers/settings.controller.js';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';

export function createSettingsRoutes(controller: SettingsController): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/user', controller.getMySettings);
  router.patch('/user', controller.updateMySettings);
  router.get('/workspace', controller.getWorkspaceSettings);
  router.patch('/workspace', controller.updateWorkspaceSettings);

  return router;
}