import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { TemplatesController } from '../controllers/templates.controller.js';

export function createTemplatesRoutes(controller: TemplatesController): Router {
  const router = Router();
  const env = getEnv();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: env.AI_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'GENERATION_RATE_LIMITED', message: 'Too many template requests' } },
  });
  router.use(requireAuth);
  router.use(limiter);

  router.get('/categories', controller.listCategories);
  router.get('/categories/:category', controller.byCategory);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/:id/instantiate', controller.instantiate);
  router.post('/:id/preview', controller.preview);
  router.post('/:id/customize', controller.customize);
  router.post('/:id/generate', controller.generate);
  router.post('/:id/generate-custom', controller.generateCustom);

  return router;
}
