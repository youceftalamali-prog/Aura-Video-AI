import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { AIController } from '../controllers/ai.controller.js';

export function createAIRoutes(controller: AIController): Router {
  const router = Router();
  const env = getEnv();

  const aiLimiter = rateLimit({
    windowMs: 60_000,
    max: env.AI_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many AI requests. Please wait.' },
    },
  });

  router.use(requireAuth);
  router.use(aiLimiter);

  router.get('/models', controller.listModels);
  router.post('/analyze-product-text', controller.analyzeProductText);
  router.post('/analyze-product-url', controller.analyzeProductUrl);
  router.post('/analyze-product-image', controller.analyzeProductImage);
  router.post('/assistant', controller.assistant);

  return router;
}
