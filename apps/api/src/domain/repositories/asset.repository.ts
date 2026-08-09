import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { assets } from '../../db/schema.js';
import type { Asset } from '@aura/types';

export class AssetRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Asset | null> {
    const rows = await this.db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return (rows[0] as unknown as Asset | undefined) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Asset | null> {
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .limit(1);
    return (rows[0] as unknown as Asset | undefined) ?? null;
  }

  async listByUser(userId: string, type?: string, limit = 50): Promise<Asset[]> {
    const conditions = [eq(assets.userId, userId)];
    if (type) conditions.push(eq(assets.type, type));
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(...conditions))
      .orderBy(desc(assets.createdAt))
      .limit(limit);
    return rows as unknown as Asset[];
  }

  async listByWorkspace(workspaceId: string, type?: string, limit = 50): Promise<Asset[]> {
    const conditions = [eq(assets.workspaceId, workspaceId)];
    if (type) conditions.push(eq(assets.type, type));
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(...conditions))
      .orderBy(desc(assets.createdAt))
      .limit(limit);
    return rows as unknown as Asset[];
  }
}
