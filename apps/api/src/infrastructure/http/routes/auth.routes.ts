import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/logout', requireAuth, controller.logout);
  router.post('/refresh', controller.refresh);
  router.get('/me', requireAuth, controller.me);
  router.patch('/me/language', requireAuth, controller.updateLanguage);
  router.get('/google/authorize', controller.googleAuthorize);
  router.get('/google/callback', controller.googleCallback);
  router.post('/google/callback', controller.googleCallback);

  return router;
}
