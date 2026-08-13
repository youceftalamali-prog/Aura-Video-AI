import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  REDIS_URL: z.string().min(1),
  REDIS_PREFIX: z.string().default('aura:'),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().url().optional().default('http://localhost:3001/api/v1/auth/google/callback'),

  WEB_URL: z.string().url().default('http://localhost:5173'),
  ADMIN_URL: z.string().url().default('http://localhost:5174'),
  API_URL: z.string().url().default('http://localhost:3001'),

  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'),

  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().default('aura-assets'),
  R2_PUBLIC_URL: z.string().optional().default(''),
  R2_ENDPOINT: z.string().optional().default(''),

  STORAGE_PROVIDER: z.enum(['r2', 's3', 'local']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./storage'),

  APP_NAME: z.string().default('Aura Video AI'),
  APP_VERSION: z.string().default('0.1.0'),
  SUPPORT_EMAIL: z.string().email().default('support@auravideo.ai'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  DEFAULT_CREDITS: z.coerce.number().default(50),

  // AI Provider
  AI_PROVIDER: z.enum(['openai', 'openai_compatible']).default('openai'),
  AI_API_KEY: z.string().optional().default(''),
  AI_BASE_URL: z.string().optional().default('https://api.openai.com/v1'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_VISION_MODEL: z.string().default('gpt-4o-mini'),
  AI_MAX_TOKENS: z.coerce.number().default(4096),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
  AI_TIMEOUT_MS: z.coerce.number().default(60000),
  AI_RATE_LIMIT_MAX: z.coerce.number().default(20),

  // OpenRouter provider (Phase B, additive; excluded when no key is set)
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_BASE_URL: z.string().url().optional().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().optional().default(''),
  OPENROUTER_CATALOG_TTL_MS: z.coerce.number().optional().default(3600000),

  // Media / Video generation providers
  MEDIA_PROVIDER: z
    .enum(['openai', 'fal', 'runway', 'kling', 'veo', 'google', 'none'])
    .default('none'), // only 'openai' is implemented; others → VIDEO_PROVIDER_NOT_IMPLEMENTED; 'none' → DISABLED
  MEDIA_API_KEY: z.string().optional().default(''),
  MEDIA_BASE_URL: z.string().optional().default(''),
  MEDIA_TIMEOUT_MS: z.coerce.number().default(120000),
  MEDIA_VIDEO_MODEL: z.string().default('sora-2'),

  TTS_PROVIDER: z.enum(['openai', 'none']).default('openai'),
  TTS_API_KEY: z.string().optional().default(''),
  TTS_BASE_URL: z.string().optional().default(''),
  TTS_MODEL: z.string().default('tts-1'),
  TTS_DEFAULT_VOICE: z.string().default('alloy'),

  PRODUCT_ANALYSIS_CREDITS: z.coerce.number().default(0),
  PRODUCT_ANALYSIS_ENABLED_BILLING: z.coerce.boolean().default(false),

  TOKEN_ENCRYPTION_KEY: z.string().optional().default(''),
  YOUTUBE_CLIENT_ID: z.string().optional().default(''),
  YOUTUBE_CLIENT_SECRET: z.string().optional().default(''),
  YOUTUBE_REDIRECT_URI: z.string().optional().default(''),
  META_CLIENT_ID: z.string().optional().default(''),
  META_CLIENT_SECRET: z.string().optional().default(''),
  META_REDIRECT_URI: z.string().optional().default(''),
  TIKTOK_CLIENT_KEY: z.string().optional().default(''),
  TIKTOK_CLIENT_SECRET: z.string().optional().default(''),
  TIKTOK_REDIRECT_URI: z.string().optional().default(''),
  PUBLISHING_RATE_LIMIT_MAX: z.coerce.number().default(30),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_PRICE_STARTER: z.string().optional().default(''),
  STRIPE_PRICE_PRO: z.string().optional().default(''),
  STRIPE_PRICE_BUSINESS: z.string().optional().default(''),
  STRIPE_PRICE_CREDITS_SMALL: z.string().optional().default(''),
  STRIPE_PRICE_CREDITS_MEDIUM: z.string().optional().default(''),
  STRIPE_PRICE_CREDITS_LARGE: z.string().optional().default(''),
  STRIPE_SUCCESS_URL: z.string().optional().default('http://localhost:5173/billing/success'),
  STRIPE_CANCEL_URL: z.string().optional().default('http://localhost:5173/billing/cancel'),
  BILLING_PROVIDER_API_KEY: z.string().optional().default(''),

  // PayPal (Phase 12 active provider)
  PAYPAL_CLIENT_ID: z.string().optional().default(''),
  PAYPAL_CLIENT_SECRET: z.string().optional().default(''),
  PAYPAL_ENVIRONMENT: z.enum(['sandbox', 'live']).optional().default('sandbox'),
  PAYPAL_WEBHOOK_ID: z.string().optional().default(''),
  PAYPAL_STARTER_PLAN_ID: z.string().optional().default(''),
  PAYPAL_PRO_PLAN_ID: z.string().optional().default(''),
  PAYPAL_BUSINESS_PLAN_ID: z.string().optional().default(''),
  PAYPAL_CURRENCY: z.string().optional().default('USD'),
  PAYPAL_CREDITS_SMALL_VALUE: z.string().optional().default('9.99'),
  PAYPAL_CREDITS_MEDIUM_VALUE: z.string().optional().default('39.99'),
  PAYPAL_CREDITS_LARGE_VALUE: z.string().optional().default('99.99'),
  PAYPAL_SUCCESS_URL: z.string().optional().default('http://localhost:5173/billing/success'),
  PAYPAL_CANCEL_URL: z.string().optional().default('http://localhost:5173/billing/cancel'),




  VIDEO_MAX_DURATION: z.coerce.number().default(60),
  VIDEO_MAX_SCENES: z.coerce.number().default(20),
  VIDEO_RATE_LIMIT_MAX: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    const messages = Object.entries(formatted)
      .map(([key, errs]) => `  ${key}: ${(errs ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${messages}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
