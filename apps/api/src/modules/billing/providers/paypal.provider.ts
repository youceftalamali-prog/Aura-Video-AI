import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import { isPayPalConfigured, requirePayPalConfig } from './plans.js';

type TokenCache = { accessToken: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

function baseUrl(): string {
  const env = getEnv();
  return env.PAYPAL_ENVIRONMENT === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export async function getPayPalAccessToken(): Promise<string> {
  requirePayPalConfig();
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }
  const env = getEnv();
  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new AppError('Failed to authenticate with PayPal', 502, 'PAYPAL_AUTH_FAILED');
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function paypalRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof json === 'object' && json && 'message' in json
        ? String((json as { message: string }).message)
        : `PayPal API error ${res.status}`;
    throw new AppError(msg, 502, 'PAYPAL_REQUEST_FAILED');
  }
  return json as T;
}

/** Verify webhook signature via PayPal API */
export async function verifyPayPalWebhook(
  headers: Record<string, string | string[] | undefined>,
  body: string,
): Promise<boolean> {
  requirePayPalConfig();
  const env = getEnv();
  if (!env.PAYPAL_WEBHOOK_ID) {
    throw new AppError('PAYPAL_WEBHOOK_ID is not configured', 503, 'BILLING_PROVIDER_NOT_CONFIGURED');
  }
  const transmissionId = String(headers['paypal-transmission-id'] || '');
  const transmissionTime = String(headers['paypal-transmission-time'] || '');
  const certUrl = String(headers['paypal-cert-url'] || '');
  const authAlgo = String(headers['paypal-auth-algo'] || '');
  const transmissionSig = String(headers['paypal-transmission-sig'] || '');
  if (!transmissionId || !transmissionSig) {
    throw new AppError('Invalid PayPal webhook headers', 400, 'PAYPAL_WEBHOOK_INVALID');
  }
  const result = await paypalRequest<{ verification_status: string }>('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: JSON.parse(body),
  });
  return result.verification_status === 'SUCCESS';
}

export { isPayPalConfigured, baseUrl };
