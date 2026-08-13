import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getEnv } from '@aura/config';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { AgentController } from '../controllers/agent.controller.js';

export function createAgentRoutes(controller: AgentController): Router {
  const router = Router();
  const env = getEnv();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: env.AI_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many AI requests. Please wait.' } },
  });

  router.use(requireAuth);
  router.use(limiter);

  router.post('/conversations', controller.createConversation);
  router.get('/conversations', controller.listConversations);
  router.get('/conversations/:id', controller.getConversation);
  router.post('/conversations/:id/messages', controller.sendMessage);
  router.post('/conversations/:id/cancel', controller.cancelConversation);

  return router;
}
