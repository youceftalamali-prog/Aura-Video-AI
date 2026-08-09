import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { VideoController } from '../controllers/video.controller.js';

export function createVideoRoutes(controller: VideoController): Router {
  const router = Router();
  const env = getEnv();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: env.VIDEO_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'GENERATION_RATE_LIMITED', message: 'Too many video generation requests' } },
  });
  router.use(requireAuth);
  router.use(limiter);
  router.post('/generate', controller.generate);
  router.post('/estimate', controller.estimate);
  router.get('/jobs/:jobId', controller.getJob);
  router.post('/jobs/:jobId/cancel', controller.cancel);
  return router;
}
