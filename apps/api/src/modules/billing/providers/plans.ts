import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';

/** Stable plan UUIDs stored in subscriptions.plan_id */
export const PLAN_IDS = {
  starter: '00000000-0000-4000-8000-000000000001',
  pro: '00000000-0000-4000-8000-000000000002',
  business: '00000000-0000-4000-8000-000000000003',
} as const;

export type PlanKey = keyof typeof PLAN_IDS;
export type CreditPackageKey = 'small' | 'medium' | 'large';

export const CREDIT_PACKAGES: Record<CreditPackageKey, { credits: number; label: string }> = {
  small: { credits: 100, label: 'Small' },
  medium: { credits: 500, label: 'Medium' },
  large: { credits: 2000, label: 'Large' },
};

export const PLAN_META: Record<PlanKey, { name: string; includedCredits: number }> = {
  starter: { name: 'Starter', includedCredits: 200 },
  pro: { name: 'Pro', includedCredits: 1000 },
  business: { name: 'Business', includedCredits: 5000 },
};

export function isPayPalConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

export function requirePayPalConfig(): void {
  if (!isPayPalConfigured()) {
    throw new AppError(
      'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
      503,
      'BILLING_PROVIDER_NOT_CONFIGURED',
    );
  }
}

export function paypalPlanId(plan: PlanKey): string {
  const env = getEnv();
  const map: Record<PlanKey, string> = {
    starter: env.PAYPAL_STARTER_PLAN_ID,
    pro: env.PAYPAL_PRO_PLAN_ID,
    business: env.PAYPAL_BUSINESS_PLAN_ID,
  };
  const id = map[plan];
  if (!id) {
    throw new AppError(`PayPal plan ID not configured for ${plan}`, 503, 'BILLING_PROVIDER_NOT_CONFIGURED');
  }
  return id;
}

export function creditPackageValue(pkg: CreditPackageKey): { value: string; currency: string; credits: number } {
  const env = getEnv();
  const map: Record<CreditPackageKey, string> = {
    small: env.PAYPAL_CREDITS_SMALL_VALUE,
    medium: env.PAYPAL_CREDITS_MEDIUM_VALUE,
    large: env.PAYPAL_CREDITS_LARGE_VALUE,
  };
  const value = map[pkg];
  const amount = Number(value);
  if (!value || !Number.isFinite(amount) || amount <= 0) {
    throw new AppError(
      `Invalid or missing PayPal credit pack amount for ${pkg}`,
      503,
      'BILLING_PROVIDER_NOT_CONFIGURED',
    );
  }
  // Normalize to 2 decimal places string for PayPal
  const normalized = amount.toFixed(2);
  return {
    value: normalized,
    currency: (env.PAYPAL_CURRENCY || 'USD').toUpperCase(),
    credits: CREDIT_PACKAGES[pkg].credits,
  };
}

/** @deprecated Stripe is dormant — kept for dormant Stripe services only */
export function requireStripeConfig(): void {
  throw new AppError(
    'Stripe is not the active billing provider. Use PayPal configuration.',
    503,
    'BILLING_PROVIDER_NOT_CONFIGURED',
  );
}

export function isStripeConfigured(): boolean {
  return false;
}

export function priceIdForPlan(_plan: PlanKey): string {
  throw new AppError('Stripe is dormant', 503, 'BILLING_PROVIDER_NOT_CONFIGURED');
}
export function priceIdForCredits(_pkg: CreditPackageKey): string {
  throw new AppError('Stripe is dormant', 503, 'BILLING_PROVIDER_NOT_CONFIGURED');
}
