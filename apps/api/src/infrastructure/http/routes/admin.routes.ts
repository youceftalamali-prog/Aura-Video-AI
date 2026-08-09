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

  return router;
}
