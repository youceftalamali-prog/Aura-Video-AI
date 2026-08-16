import jwt from 'jsonwebtoken';
import { getEnv } from '@aura/config';
import type { JwtPayload } from '@aura/types';
import { AuthenticationError } from '@aura/shared';

const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

export function signAccessToken(payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>): string {
  const env = getEnv();
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'aura-video-ai',
    audience: 'aura-video-ai-client',
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>): string {
  const env = getEnv();
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'aura-video-ai',
    audience: 'aura-video-ai-client',
  } as jwt.SignOptions);
}

export function verifyToken(token: string, expectedType: 'access' | 'refresh'): JwtPayload {
  const env = getEnv();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: 'aura-video-ai',
      audience: 'aura-video-ai-client',
    }) as unknown as JwtPayload;
    if (decoded.type !== expectedType) {
      throw new AuthenticationError('Invalid token type');
    }
    return decoded;
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
}

export function getAccessTokenExpirySeconds(): number {
  const env = getEnv();
  const match = env.JWT_ACCESS_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const value = parseInt(match[1]!, 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 900;
  }
}
