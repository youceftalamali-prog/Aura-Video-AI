import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { ProductsController } from '../controllers/products.controller.js';

export function createProductsRoutes(controller: ProductsController): Router {
  const router = Router();
  const env = getEnv();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: env.AI_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'GENERATION_RATE_LIMITED', message: 'Too many product requests' } },
  });
  router.use(requireAuth);
  router.use(limiter);

  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.delete('/:id', controller.remove);

  router.post('/import/url', controller.importUrl);
  router.post('/import/text', controller.importText);
  router.post('/import/image', controller.importImage);

  router.get('/:id/intelligence', controller.intelligence);
  router.post('/:id/hooks', controller.hooks);
  router.post('/:id/create-video', controller.createVideo);

  return router;
}
