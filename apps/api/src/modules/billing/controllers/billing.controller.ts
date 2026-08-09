import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { BillingService } from '../services/billing.service.js';
import type { PayPalBillingService } from '../services/paypal-billing.service.js';
import type { PayPalWebhookService } from '../services/paypal-webhook.service.js';
import {
  estimateBodySchema,
  topUpBodySchema,
  workspaceUpdateSchema,
  subscriptionCheckoutSchema,
  creditsCheckoutSchema,
} from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';

export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly paypalBilling: PayPalBillingService,
    private readonly paypalWebhookService: PayPalWebhookService,
  ) {}

  overview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.billing.getOverview(req.user!.sub);
      res.json({
        success: true,
        data: {
          ...data,
          plans: this.paypalBilling.listPlans(),
          creditPackages: this.paypalBilling.listCreditPackages(),
          clientId: this.paypalBilling.getClientId(),
          provider: 'paypal',
        },
      } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  balance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.billing.getBalance(req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  estimate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = estimateBodySchema.parse(req.body);
      const data = await this.billing.estimate(req.user!.sub, body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  topUp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = topUpBodySchema.parse(req.body);
      const pkg = body.amount >= 1500 ? 'large' : body.amount >= 400 ? 'medium' : 'small';
      const data = await this.paypalBilling.createCreditCheckout(req.user!.sub, pkg as 'small' | 'medium' | 'large');
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  getWorkspace = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.billing.getWorkspace(req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  updateWorkspace = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = workspaceUpdateSchema.parse(req.body);
      const data = await this.billing.updateWorkspaceName(req.user!.sub, body.name);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  checkoutSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = subscriptionCheckoutSchema.parse(req.body);
      const data = await this.paypalBilling.createSubscriptionCheckout(req.user!.sub, body.plan);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  checkoutCredits = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = creditsCheckoutSchema.parse(req.body);
      const data = await this.paypalBilling.createCreditCheckout(req.user!.sub, body.package);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  portal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.paypalBilling.createPortalSession(req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  getSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.paypalBilling.getSubscriptionStatus(req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  cancelSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.paypalBilling.cancelSubscription(req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  paypalWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = (req as unknown as Request & { rawBody?: Buffer }).rawBody ?? req.body;
      if (!Buffer.isBuffer(raw) && typeof raw !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'PAYPAL_WEBHOOK_INVALID', message: 'Raw body required' },
        });
        return;
      }
      const data = await this.paypalWebhookService.handleRaw(
        Buffer.isBuffer(raw) ? raw : Buffer.from(raw),
        req.headers as unknown as Record<string, string | string[] | undefined>,
      );
      res.json(data);
    } catch (e) { next(e); }
  };
}
