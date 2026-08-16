import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { users } from '../../db/schema.js';
import type { CreateUserInput, PublicUser, User, UpdateUserInput } from '@aura/types';

export class UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return (rows[0] as unknown as User | undefined) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return (rows[0] as unknown as User | undefined) ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return (rows[0] as unknown as User | undefined) ?? null;
  }

  async create(input: CreateUserInput & { passwordHash?: string | null; emailVerifiedAt?: Date | null }): Promise<User> {
    const rows = await this.db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash ?? null,
        fullName: input.fullName,
        googleId: input.googleId ?? null,
        avatarUrl: input.avatarUrl ?? null,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        role: 'user',
        status: 'active',
      })
      .returning();
    return rows[0] as unknown as User;
  }

  async update(id: string, input: UpdateUserInput): Promise<User | null> {
    const rows = await this.db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return (rows[0] as unknown as User | undefined) ?? null;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
  }

  async updateGoogleId(userId: string, googleId: string): Promise<User | null> {
    const rows = await this.db
      .update(users)
      .set({ googleId, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return (rows[0] as unknown as User | undefined) ?? null;
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      preferredLanguage: (user as { preferredLanguage?: string }).preferredLanguage || 'en',
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  async list(limit = 50, offset = 0): Promise<{ users: User[]; total: number }> {
    const rows = await this.db.select().from(users).limit(limit).offset(offset);
    const countResult = await this.db.select({ count: sql<number>`count(*)::int` }).from(users);
    return { users: rows as unknown as User[], total: countResult[0]?.count ?? 0 };
  }

  async updatePreferredLanguage(userId: string, preferredLanguage: string) {
    const [row] = await this.db
      .update(users)
      .set({ preferredLanguage, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return row ? this.toPublic(row as unknown as User) : null;
  }
}
