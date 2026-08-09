import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { BillingController } from '../controllers/billing.controller.js';

export function createBillingRoutes(controller: BillingController): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  });

  // PayPal webhook — no auth (signature verified in service)
  router.post('/paypal/webhook', controller.paypalWebhook);
  // Legacy path alias
  router.post('/stripe/webhook', controller.paypalWebhook);

  router.use(requireAuth);
  router.use(limiter);

  router.get('/overview', controller.overview);
  router.get('/balance', controller.balance);
  router.post('/estimate', controller.estimate);
  router.post('/top-up', controller.topUp);
  router.get('/workspace', controller.getWorkspace);
  router.patch('/workspace', controller.updateWorkspace);

  router.post('/checkout/subscription', controller.checkoutSubscription);
  router.post('/checkout/credits', controller.checkoutCredits);
  router.post('/portal', controller.portal);
  router.get('/subscription', controller.getSubscription);
  router.post('/subscription/cancel', controller.cancelSubscription);

  return router;
}
