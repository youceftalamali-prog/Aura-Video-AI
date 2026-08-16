import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getEnv } from '@aura/config';
import { AppError, AuthenticationError } from '@aura/shared';
import type { GoogleProfile } from '@aura/types';

export const GOOGLE_OAUTH_STATE_COOKIE = 'aura_google_oauth_state';
const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

type GoogleTokenInfo = {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string | number;
};

/**
 * Server-side Google OAuth code exchange and identity verification.
 *
 * The API never accepts an identity profile supplied by the browser. It only
 * accepts a one-time authorization code, verifies the state cookie, exchanges
 * the code with Google, and validates the returned identity against our client
 * id and Google's issuer.
 */
export class GoogleOAuthService {
  createAuthorizationUrl(): { url: string; stateCookie: string; maxAgeMs: number } {
    const env = this.requireConfiguration();
    const state = `${Date.now().toString(36)}.${randomBytes(32).toString('base64url')}`;
    const signature = this.signState(state, env.JWT_SECRET);
    const stateCookie = `${state}.${signature}`;
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });

    return {
      url: `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`,
      stateCookie,
      maxAgeMs: STATE_MAX_AGE_MS,
    };
  }

  verifyState(state: string, stateCookie: string | undefined): boolean {
    const env = this.requireConfiguration();
    if (!state || !stateCookie) return false;

    const separator = stateCookie.lastIndexOf('.');
    if (separator <= 0 || separator === stateCookie.length - 1) return false;
    const cookieState = stateCookie.slice(0, separator);
    const actualSignature = stateCookie.slice(separator + 1);
    if (cookieState !== state) return false;

    const timestamp = Number.parseInt(state.split('.', 1)[0] ?? '', 36);
    const age = Date.now() - timestamp;
    if (!Number.isFinite(timestamp) || age < -60_000 || age > STATE_MAX_AGE_MS) {
      return false;
    }

    const expectedSignature = this.signState(state, env.JWT_SECRET);
    const actual = Buffer.from(actualSignature);
    const expected = Buffer.from(expectedSignature);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  async exchangeAuthorizationCode(code: string): Promise<GoogleProfile> {
    const env = this.requireConfiguration();
    if (!code || code.length > 4096) {
      throw new AuthenticationError('Invalid Google authorization code');
    }

    try {
      const tokenResponse = await this.fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.GOOGLE_CALLBACK_URL,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenResponse.ok) {
        throw new AuthenticationError('Google authorization failed');
      }

      const tokenPayload = (await tokenResponse.json()) as { id_token?: unknown };
      const idToken = typeof tokenPayload.id_token === 'string' ? tokenPayload.id_token : '';
      if (!idToken) {
        throw new AuthenticationError('Google authorization failed');
      }

      const verificationUrl = new URL(GOOGLE_TOKENINFO_ENDPOINT);
      verificationUrl.searchParams.set('id_token', idToken);
      const verificationResponse = await this.fetchWithTimeout(verificationUrl, { method: 'GET' });
      if (!verificationResponse.ok) {
        throw new AuthenticationError('Google identity verification failed');
      }

      const info = (await verificationResponse.json()) as GoogleTokenInfo;
      const issuerValid = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
      const audienceValid = info.aud === env.GOOGLE_CLIENT_ID;
      const expiresAt = Number(info.exp);
      const emailVerified = info.email_verified === true || info.email_verified === 'true';
      if (!issuerValid || !audienceValid || !info.sub || !info.email || !emailVerified) {
        throw new AuthenticationError('Google identity verification failed');
      }
      if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new AuthenticationError('Google identity verification failed');
      }

      const email = info.email.trim().toLowerCase();
      const fallbackName = email.split('@')[0] || 'Aura user';
      const name = String(info.name || fallbackName).trim().slice(0, 100) || fallbackName;
      let picture: string | undefined;
      if (typeof info.picture === 'string') {
        try {
          const pictureUrl = new URL(info.picture);
          if (pictureUrl.protocol === 'https:') picture = pictureUrl.toString();
        } catch {
          picture = undefined;
        }
      }

      return { id: info.sub, email, name, picture };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AuthenticationError('Google authentication is temporarily unavailable');
    }
  }

  private requireConfiguration() {
    const env = getEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
      throw new AppError('Google OAuth is not configured', 503, 'GOOGLE_OAUTH_NOT_CONFIGURED');
    }
    return env;
  }

  private signState(state: string, secret: string): string {
    return createHmac('sha256', secret).update(state).digest('base64url');
  }

  private async fetchWithTimeout(input: string | URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
