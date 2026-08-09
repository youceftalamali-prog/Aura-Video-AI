import type { Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '@aura/shared';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { AuthService } from '../../../domain/services/auth.service.js';
import type { ApiResponse, AuthResponse, PublicUser } from '@aura/types';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await this.authService.register(input, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) {
      next(err);
    }
  };

  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = loginSchema.parse(req.body);
      const result = await this.authService.login(input, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user) {
        await this.authService.logout(req.user.sub);
      }
      res.status(200).json({ success: true } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' },
        });
        return;
      }
      const result = await this.authService.refresh(refreshToken, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) {
      next(err);
    }
  };


  updateLanguage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as { userId?: string; id?: string; sub?: string }).userId || (req.user as { id?: string }).id || (req.user as { sub?: string }).sub!;
      const language = String((req.body as { language?: string }).language || 'en').toLowerCase();
      const allowed = new Set(['en', 'fr', 'ar']);
      if (!allowed.has(language)) {
        res.status(400).json({ error: { code: 'LANGUAGE_NOT_SUPPORTED', message: 'Language not supported' } });
        return;
      }
      const user = await this.authService.updatePreferredLanguage(userId, language);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.authService.me(req.user!.sub);
      res.status(200).json({ success: true, data: user } satisfies ApiResponse<PublicUser>);
    } catch (err) {
      next(err);
    }
  };

  googleCallback = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Google OAuth callback would be handled by passport or manual token exchange.
      // Phase 1 foundation exposes the endpoint shape; full OAuth flow requires
      // GOOGLE_CLIENT_ID/SECRET and redirect handling in production.
      const profile = req.body as {
        id: string;
        email: string;
        name: string;
        picture?: string;
      };
      if (!profile?.id || !profile?.email) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid Google profile' },
        });
        return;
      }
      const result = await this.authService.loginWithGoogle(profile, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.status(200).json({ success: true, data: result } satisfies ApiResponse<AuthResponse>);
    } catch (err) {
      next(err);
    }
  };
}
