import { getEnv } from '@aura/config';
import { AuthenticationError, ConflictError, NotFoundError } from '@aura/shared';
import type { AuthResponse, LoginInput, PublicUser, RegisterInput, GoogleProfile } from '@aura/types';
import { UserRepository } from '../repositories/user.repository.js';
import { SessionRepository } from '../repositories/session.repository.js';
import { WorkspaceRepository } from '../repositories/workspace.repository.js';
import { CreditRepository } from '../repositories/credit.repository.js';
import { hashPassword, verifyPassword, hashToken } from '../../infrastructure/auth/password.js';
import { signAccessToken, signRefreshToken, verifyToken, getAccessTokenExpirySeconds } from '../../infrastructure/auth/jwt.js';

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly creditRepo: CreditRepository,
  ) {}

  async register(input: RegisterInput, meta: { userAgent?: string; ipAddress?: string } = {}): Promise<AuthResponse> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('Email already registered');
    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepo.create({ email: input.email, fullName: input.fullName, passwordHash });
    const workspace = await this.workspaceRepo.create(user.id, { name: `${input.fullName}'s Workspace`, isPersonal: true });
    await this.creditRepo.create(workspace.id, getEnv().DEFAULT_CREDITS);
    const tokens = await this.createSession(user.id, user.email, user.role, meta);
    return { user: this.userRepo.toPublic(user), tokens };
  }

  async login(input: LoginInput, meta: { userAgent?: string; ipAddress?: string } = {}): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user || !user.passwordHash) throw new AuthenticationError('Invalid email or password');
    if (user.status !== 'active') throw new AuthenticationError('Account is not active');
    if (!(await verifyPassword(input.password, user.passwordHash))) throw new AuthenticationError('Invalid email or password');
    await this.userRepo.updateLastLogin(user.id);
    const tokens = await this.createSession(user.id, user.email, user.role, meta);
    return { user: this.userRepo.toPublic(user), tokens };
  }

  async loginWithGoogle(profile: GoogleProfile, meta: { userAgent?: string; ipAddress?: string } = {}): Promise<AuthResponse> {
    let user = await this.userRepo.findByGoogleId(profile.id);
    if (!user) {
      const existingByEmail = await this.userRepo.findByEmail(profile.email);
      if (existingByEmail) {
        if (existingByEmail.googleId && existingByEmail.googleId !== profile.id) {
          throw new AuthenticationError('This email is linked to a different Google account');
        }
        user = await this.userRepo.updateGoogleId(existingByEmail.id, profile.id);
      }
    }

    if (!user) {
      user = await this.userRepo.create({
        email: profile.email,
        fullName: profile.name,
        googleId: profile.id,
        avatarUrl: profile.picture,
        emailVerifiedAt: new Date(),
      });
      const workspace = await this.workspaceRepo.create(user.id, { name: `${profile.name}'s Workspace`, isPersonal: true });
      await this.creditRepo.create(workspace.id, getEnv().DEFAULT_CREDITS);
    }

    if (user.status !== 'active') throw new AuthenticationError('Account is not active');
    await this.userRepo.updateLastLogin(user.id);
    const tokens = await this.createSession(user.id, user.email, user.role, meta);
    return { user: this.userRepo.toPublic(user), tokens };
  }

  async refresh(refreshToken: string, meta: { userAgent?: string; ipAddress?: string } = {}): Promise<AuthResponse> {
    const payload = verifyToken(refreshToken, 'refresh');
    const user = await this.userRepo.findById(payload.sub);
    if (!user || user.status !== 'active') throw new AuthenticationError('Invalid session');
    const session = await this.sessionRepo.findByRefreshToken(refreshToken);
    if (!session || session.userId !== user.id) throw new AuthenticationError('Invalid session');
    await this.sessionRepo.revoke(session.id);
    const tokens = await this.createSession(user.id, user.email, user.role, meta);
    return { user: this.userRepo.toPublic(user), tokens };
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) await this.sessionRepo.revoke(sessionId);
    else await this.sessionRepo.revokeAllForUser(userId);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');
    return this.userRepo.toPublic(user);
  }

  private async createSession(userId: string, email: string, role: string, meta: { userAgent?: string; ipAddress?: string }) {
    const accessToken = signAccessToken({ sub: userId, email, role });
    const refreshToken = signRefreshToken({ sub: userId, email, role });
    const refreshTokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationMs(getEnv().JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000));
    await this.sessionRepo.create({ userId, refreshTokenHash, userAgent: meta.userAgent, ipAddress: meta.ipAddress, expiresAt });
    return { accessToken, refreshToken, expiresIn: getAccessTokenExpirySeconds() };
  }

  async updatePreferredLanguage(userId: string, preferredLanguage: string) {
    return this.userRepo.updatePreferredLanguage(userId, preferredLanguage);
  }
}

function parseDurationMs(value: string, fallback: number): number {
  const match = /^(\d+)([smhdw])$/.exec(value.trim());
  if (!match) return fallback;
  const amount = Number(match[1]);
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[match[2] as 's' | 'm' | 'h' | 'd' | 'w'];
  return amount * multiplier;
}
