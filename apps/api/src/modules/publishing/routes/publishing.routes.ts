import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { PublishingController } from '../controllers/publishing.controller.js';

export function createPublishingRoutes(controller: PublishingController): Router {
  const router = Router();
  const env = getEnv();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: env.PUBLISHING_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'GENERATION_RATE_LIMITED', message: 'Too many publishing requests' } },
  });
  router.use(requireAuth);
  router.use(limiter);

  router.get('/providers', controller.listProviders);
  router.get('/providers/:platform/capabilities', controller.capabilities);

  router.get('/connections', controller.listConnections);
  router.post('/connections/:platform/connect', controller.startConnect);
  router.post('/connections/:platform/callback', controller.completeConnect);
  router.post('/connections/:id/validate', controller.validateConnection);
  router.delete('/connections/:id', controller.disconnect);

  router.post('/validate', controller.validate);
  router.post('/publish', controller.publish);
  router.post('/schedule', controller.schedule);

  router.get('/jobs', controller.listJobs);
  router.get('/jobs/:id', controller.getJob);
  router.post('/jobs/:id/retry', controller.retry);
  router.post('/jobs/:id/cancel', controller.cancel);

  return router;
}
