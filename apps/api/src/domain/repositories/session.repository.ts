import { eq, and, isNull, gt } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { sessions } from '../../db/schema.js';
import type { Session } from '@aura/types';
import { verifyTokenHash } from '../../infrastructure/auth/password.js';

export class SessionRepository {
  constructor(private readonly db: Database) {}

  async create(data: {
    userId: string;
    refreshTokenHash: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
  }): Promise<Session> {
    const rows = await this.db
      .insert(sessions)
      .values({
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
        expiresAt: data.expiresAt,
      })
      .returning();
    return rows[0] as unknown as Session;
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return (rows[0] as unknown as Session | undefined) ?? null;
  }

  async findValidByUserId(userId: string): Promise<Session[]> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)),
      );
    return rows as unknown as Session[];
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async findByRefreshToken(token: string): Promise<Session | null> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
    for (const r of rows) {
      // refresh token hashes are bcrypt hashes; compare
      // eslint-disable-next-line no-await-in-loop
      const ok = await verifyTokenHash(token, String((r as any).refreshTokenHash));
      if (ok) return r as unknown as Session;
    }
    return null;
  }
}
