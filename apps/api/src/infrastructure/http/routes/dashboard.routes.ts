import { Router } from 'express';
import type { DashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function createDashboardRoutes(controller: DashboardController): Router {
  const router = Router();
  router.get('/', requireAuth, controller.getStats);
  return router;
}
