import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { StudioController } from '../controllers/studio.controller.js';

export function createStudioRoutes(controller: StudioController): Router {
  const router = Router();
  const env = getEnv();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: env.AI_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'GENERATION_RATE_LIMITED', message: 'Too many requests' } },
  });
  router.use(requireAuth);
  router.use(limiter);

  router.get('/brand-kit', controller.getBrandKit);
  router.put('/brand-kit', controller.updateBrandKit);

  router.get('/templates', controller.listTemplates);
  router.get('/templates/:id', controller.getTemplate);

  router.post('/voice', controller.generateVoice);
  router.post('/captions/from-text', controller.captionsFromText);
  router.post('/captions/from-audio', controller.captionsFromAudio);

  router.get('/music', controller.listMusic);
  router.post('/music/validate', controller.validateMusic);

  router.get('/projects/:id/state', controller.getProjectState);
  router.put('/projects/:id/state', controller.saveProjectState);

  return router;
}
