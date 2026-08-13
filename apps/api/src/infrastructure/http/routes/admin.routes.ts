import { Router } from 'express';
import type { AdminController } from '../controllers/admin.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

export function createAdminRoutes(controller: AdminController): Router {
  const router = Router();

  router.use(requireAuth, requireAdmin);

  router.get('/users', controller.listUsers);
  router.get('/plans', controller.listPlans);
  router.get('/settings', controller.listSettings);
  router.put('/settings/:key', controller.updateSetting);

  router.get('/ai-providers', controller.listAiProviders);
  router.post('/ai-providers', controller.createAiProvider);
  router.patch('/ai-providers/:id', controller.updateAiProvider);
  router.delete('/ai-providers/:id', controller.deleteAiProvider);
  router.post('/ai-providers/:id/test', controller.testAiProvider);

  router.get('/ai/models', controller.listAiModels);
  router.post('/ai/models/refresh', controller.refreshAiModels);

  router.get('/feature-flags', controller.listFeatureFlags);
  router.put('/feature-flags/:key', controller.updateFeatureFlag);
  router.delete('/feature-flags/:key', controller.deleteFeatureFlag);

  router.get('/system/health', controller.getSystemHealth);

  return router;
}
