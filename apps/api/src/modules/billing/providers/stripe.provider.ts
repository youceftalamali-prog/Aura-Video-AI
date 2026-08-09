/** DORMANT — Phase 12 active provider is PayPal. This file is not wired. */
import Stripe from 'stripe';
import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import { isStripeConfigured, requireStripeConfig } from './plans.js';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  requireStripeConfig();
  if (!stripeClient) {
    stripeClient = new Stripe(getEnv().STRIPE_SECRET_KEY, {
      // Use account default API version from SDK
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeClient;
}

export function constructWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
  requireStripeConfig();
  const secret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError('Stripe webhook secret not configured', 503, 'BILLING_PROVIDER_NOT_CONFIGURED');
  }
  try {
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new AppError('Invalid Stripe webhook signature', 400, 'STRIPE_WEBHOOK_INVALID');
  }
}

export { isStripeConfigured };
