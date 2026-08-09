import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import type { DashboardController } from '../controllers/dashboard.controller.js';
import type { AdminController } from '../controllers/admin.controller.js';
import type { HealthController } from '../controllers/health.controller.js';
import { createAuthRoutes } from './auth.routes.js';
import { createDashboardRoutes } from './dashboard.routes.js';
import { createAdminRoutes } from './admin.routes.js';
import { createAIModule } from '../../../modules/ai/index.js';
import { createCreativeModule } from '../../../modules/creative/index.js';
import { createVideoModule } from '../../../modules/video/index.js';
import { createStudioModule } from '../../../modules/studio/index.js';
import { createProductsModule } from '../../../modules/products/index.js';
import { createPublishingModule } from '../../../modules/publishing/index.js';
import { createTemplatesModule } from '../../../modules/templates/index.js';
import { createLibraryModule } from '../../../modules/library/index.js';
import { createBillingModule } from '../../../modules/billing/index.js';

export function createApiRouter(deps: {
  authController: AuthController;
  dashboardController: DashboardController;
  adminController: AdminController;
  healthController: HealthController;
}): Router {
  const router = Router();
  const aiModule = createAIModule();
  const creativeModule = createCreativeModule();
  const videoModule = createVideoModule();
  const studioModule = createStudioModule();
  const productsModule = createProductsModule();
  const publishingModule = createPublishingModule();
  const templatesModule = createTemplatesModule();
  const libraryModule = createLibraryModule();
  const billingModule = createBillingModule();

  router.get('/health', deps.healthController.check);
  router.use('/auth', createAuthRoutes(deps.authController));
  router.use('/dashboard', createDashboardRoutes(deps.dashboardController));
  router.use('/admin', createAdminRoutes(deps.adminController));
  router.use('/ai', aiModule.routes);
  router.use('/creative', creativeModule.routes);
  router.use('/video', videoModule.routes);
  router.use('/studio', studioModule.routes);
  router.use('/products', productsModule.routes);
  router.use('/publishing', publishingModule.routes);
  router.use('/templates', templatesModule.routes);
  router.use('/library', libraryModule.routes);
  router.use('/billing', billingModule.routes);

  return router;
}
