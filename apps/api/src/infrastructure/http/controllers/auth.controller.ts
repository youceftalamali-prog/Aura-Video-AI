import type { Response, NextFunction } from 'express';
import { googleOAuthCallbackSchema, registerSchema, loginSchema } from '@aura/shared';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { AuthService } from '../../../domain/services/auth.service.js';
import type { ApiResponse, AuthResponse, PublicUser } from '@aura/types';
import { GoogleOAuthService, GOOGLE_OAUTH_STATE_COOKIE } from '../../auth/google-oauth.service.js';

const GOOGLE_OAUTH_COOKIE_PATH = '/api/v1/auth/google';

/**
 * Reads a single named cookie from a raw `Cookie` header.
 *
 * The application registers no cookie-parsing middleware, so no request handler
 * ever receives an ambient cookie jar. This helper is deliberately narrow: it is
 * used only by the Google OAuth callback to read the short-lived OAuth state
 * cookie. It matches the cookie name exactly, so a similarly named cookie such
 * as `<name>_BACKUP` can never be substituted, and it never logs, returns, or
 * otherwise exposes the value it reads.
 *
 * Exported only so the deterministic security tests can exercise it directly.
 */
export function readCookie(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = pair.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    const rawValue = pair.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  register = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await this.authService.register(input, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) { next(err); }
  };

  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = loginSchema.parse(req.body);
      const result = await this.authService.login(input, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) { next(err); }
  };

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user) await this.authService.logout(req.user.sub);
      res.status(200).json({ success: true } satisfies ApiResponse);
    } catch (err) { next(err); }
  };

  refresh = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
      if (!refreshToken) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' } });
        return;
      }
      const result = await this.authService.refresh(refreshToken, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) { next(err); }
  };

  updateLanguage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const language = String((req.body as { language?: string }).language || 'en').toLowerCase();
      const allowed = new Set(['en', 'fr', 'ar']);
      if (!allowed.has(language)) {
        res.status(400).json({ error: { code: 'LANGUAGE_NOT_SUPPORTED', message: 'Language not supported' } });
        return;
      }
      const user = await this.authService.updatePreferredLanguage(userId, language);
      res.json({ user });
    } catch (err) { next(err); }
  };

  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.authService.me(req.user!.sub);
      res.status(200).json({ success: true, data: user } satisfies ApiResponse<PublicUser>);
    } catch (err) { next(err); }
  };

  googleAuthorize = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = this.googleOAuth.createAuthorizationUrl();
      res.cookie(GOOGLE_OAUTH_STATE_COOKIE, request.stateCookie, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: GOOGLE_OAUTH_COOKIE_PATH,
        maxAge: request.maxAgeMs,
      });
      res.status(200).json({ success: true, data: { authorizationUrl: request.url } } satisfies ApiResponse);
    } catch (err) { next(err); }
  };

  googleCallback = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = googleOAuthCallbackSchema.parse(req.query);
      // Read only the OAuth state cookie, straight from the request headers. No
      // cookie middleware is registered, so nothing else in the pipeline sees it.
      const stateCookie = readCookie(req.headers.cookie, GOOGLE_OAUTH_STATE_COOKIE);
      if (!this.googleOAuth.verifyState(input.state, stateCookie)) {
        this.clearGoogleCookie(res);
        res.status(400).json({ success: false, error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid OAuth state' } });
        return;
      }

      const profile = await this.googleOAuth.exchangeAuthorizationCode(input.code);
      const result = await this.authService.loginWithGoogle(profile, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      this.clearGoogleCookie(res);
      res.status(200).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) {
      this.clearGoogleCookie(res);
      next(err);
    }
  };

  private clearGoogleCookie(res: Response): void {
    res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: GOOGLE_OAUTH_COOKIE_PATH,
    });
  }
}
