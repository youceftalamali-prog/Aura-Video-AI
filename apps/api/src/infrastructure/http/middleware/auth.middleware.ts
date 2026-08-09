import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from '@aura/shared';
import { verifyToken } from '../../auth/jwt.js';
import type { JwtPayload } from '@aura/types';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }
    const token = header.slice(7);
    const payload = verifyToken(token, 'access');
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AuthenticationError();
    }
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      throw new AuthorizationError('Admin access required');
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      req.user = verifyToken(token, 'access');
    }
    next();
  } catch {
    next();
  }
}
