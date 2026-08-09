import type { UUID, ISODateString } from './common';
import type { PublicUser } from './user';

export interface Session {
  id: UUID;
  userId: UUID;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: ISODateString;
  createdAt: ISODateString;
  revokedAt: ISODateString | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface JwtPayload {
  sub: UUID;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}
