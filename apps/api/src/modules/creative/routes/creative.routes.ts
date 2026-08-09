import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { CreativeController } from '../controllers/creative.controller.js';

export function createCreativeRoutes(controller: CreativeController): Router {
  const router = Router();
  const env = getEnv();

  const limiter = rateLimit({
    windowMs: 60_000,
    max: env.AI_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'GENERATION_RATE_LIMITED', message: 'Too many creative requests' },
    },
  });

  router.use(requireAuth);
  router.use(limiter);

  router.post('/strategy', controller.generateStrategy);
  router.post('/script', controller.generateScript);
  router.post('/storyboard', controller.generateStoryboard);
  router.get('/templates', controller.listTemplates);
  router.get('/templates/:id', controller.getTemplate);
  router.post('/recommend-template', controller.recommendTemplate);

  return router;
}
