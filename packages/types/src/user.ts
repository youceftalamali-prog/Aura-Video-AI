import type { UUID, ISODateString, Timestamps } from './common';

export type UserRole = 'user' | 'admin' | 'superadmin';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface User extends Timestamps {
  id: UUID;
  email: string;
  passwordHash: string | null;
  fullName: string;
  preferredLanguage?: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: ISODateString | null;
  googleId: string | null;
  lastLoginAt: ISODateString | null;
}

export interface PublicUser {
  id: UUID;
  email: string;
  fullName: string;
  preferredLanguage?: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  fullName: string;
  preferredLanguage?: string;
  googleId?: string;
  avatarUrl?: string;
}

export interface UpdateUserInput {
  fullName?: string;
  avatarUrl?: string | null;
  status?: UserStatus;
}
