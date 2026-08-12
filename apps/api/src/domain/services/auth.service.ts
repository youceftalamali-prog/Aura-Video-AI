import { getEnv } from '@aura/config';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from '@aura/shared';
import type {
  AuthResponse,
  LoginInput,
  PublicUser,
  RegisterInput,
  GoogleProfile,
} from '@aura/types';
import { UserRepository } from '../repositories/user.repository.js';
import { SessionRepository } from '../repositories/session.repository.js';
import { WorkspaceRepository } from '../repositories/workspace.repository.js';
import { CreditRepository } from '../repositories/credit.repository.js';
import { hashPassword, verifyPassword, hashToken } from '../../infrastructure/auth/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  getAccessTokenExpirySeconds,
} from '../../infrastructure/auth/jwt.js';

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly creditRepo: CreditRepository,
  ) {}

  async register(
    input: RegisterInput,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResponse> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepo.create({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
    });

    const workspace = await this.workspaceRepo.create(user.id, {
      name: `${input.fullName}'s Workspace`,
      isPersonal: true,
    });

    const env = getEnv();
    await this.creditRepo.create(workspace.id, env.DEFAULT_CREDITS);

    const tokens = await this.createSession(user.id, user.email, user.role, meta);

    return {
      user: this.userRepo.toPublic(user),
      tokens,
    };
  }

  async login(
    input: LoginInput,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user || !user.passwordHash) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Account is not active');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new AuthenticationError('Invalid email or password');
    }

    await this.userRepo.updateLastLogin(user.id);
    const tokens = await this.createSession(user.id, user.email, user.role, meta);

    return {
      user: this.userRepo.toPublic(user),
      tokens,
    };
  }

  async loginWithGoogle(
    profile: GoogleProfile,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResponse> {
    let user = await this.userRepo.findByGoogleId(profile.id);

    if (!user) {
      const existingByEmail = await this.userRepo.findByEmail(profile.email);
      if (existingByEmail) {
        user = await this.userRepo.update(existingByEmail.id, {
          // link google
        });
        // update googleId separately if needed - for simplicity create new or update
        user = await this.userRepo.findById(existingByEmail.id);
        if (user && !user.googleId) {
          // In real code we'd have an updateGoogleId method
        }
      }
    }

    if (!user) {
      user = await this.userRepo.create({
        email: profile.email,
        fullName: profile.name,
        googleId: profile.id,
        avatarUrl: profile.picture,
      });

      const workspace = await this.workspaceRepo.create(user.id, {
        name: `${profile.name}'s Workspace`,
        isPersonal: true,
      });
      const env = getEnv();
      await this.creditRepo.create(workspace.id, env.DEFAULT_CREDITS);
    }

    if (user!.status !== 'active') {
      throw new AuthenticationError('Account is not active');
    }

    await this.userRepo.updateLastLogin(user!.id);
    const tokens = await this.createSession(user!.id, user!.email, user!.role, meta);

    return {
      user: this.userRepo.toPublic(user!),
      tokens,
    };
  }

  async refresh(
    refreshToken: string,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResponse> {
    const payload = verifyToken(refreshToken, 'refresh');
    const user = await this.userRepo.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new AuthenticationError('Invalid session');
    }

    // Ensure the refresh token corresponds to a valid session record and is not revoked/expired.
    const session = await this.sessionRepo.findByRefreshToken(refreshToken);
    if (!session || session.userId !== user.id) {
      throw new AuthenticationError('Invalid session');
    }

    // Revoke the old session and rotate to a new one
    await this.sessionRepo.revoke(session.id);
    const tokens = await this.createSession(user.id, user.email, user.role, meta);

    return {
      user: this.userRepo.toPublic(user),
      tokens,
    };
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.sessionRepo.revoke(sessionId);
    } else {
      await this.sessionRepo.revokeAllForUser(userId);
    }
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    return this.userRepo.toPublic(user);
  }

  private async createSession(
    userId: string,
    email: string,
    role: string,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const accessToken = signAccessToken({ sub: userId, email, role });
    const refreshToken = signRefreshToken({ sub: userId, email, role });
    const refreshTokenHash = await hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionRepo.create({
      userId,
      refreshTokenHash,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenExpirySeconds(),
    };
  }

  async updatePreferredLanguage(userId: string, preferredLanguage: string) {
    return this.userRepo.updatePreferredLanguage(userId, preferredLanguage);
  }
}
