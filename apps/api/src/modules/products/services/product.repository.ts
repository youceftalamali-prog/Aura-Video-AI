import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { products } from '../../../db/schema.js';
import type { ProductRecord } from '@aura/types';

export class ProductRepository {
  constructor(private readonly db: Database) {}

  async create(data: {
    workspaceId: string;
    userId: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    price?: string | null;
    currency?: string | null;
    externalId?: string | null;
    externalSource?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<ProductRecord> {
    const rows = await this.db
      .insert(products)
      .values({
        workspaceId: data.workspaceId,
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
        price: data.price ?? null,
        currency: data.currency ?? null,
        externalId: data.externalId ?? null,
        externalSource: data.externalSource ?? null,
        metadata: data.metadata ?? null,
      })
      .returning();
    return this.map(rows[0]!);
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const rows = await this.db.select().from(products).where(eq(products.id, id)).limit(1);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<ProductRecord | null> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .limit(1);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async listForUser(userId: string, limit = 50): Promise<ProductRecord[]> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.userId, userId))
      .orderBy(desc(products.createdAt))
      .limit(limit);
    return rows.map((r) => this.map(r));
  }

  async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<void> {
    await this.db
      .update(products)
      .set({ metadata, updatedAt: new Date() })
      .where(eq(products.id, id));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning();
    return rows.length > 0;
  }

  private map(row: Record<string, unknown>): ProductRecord {
    return {
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      userId: String(row.userId),
      name: String(row.name),
      description: (row.description as string) ?? null,
      imageUrl: (row.imageUrl as string) ?? null,
      imageAssetId: (row.imageAssetId as string) ?? null,
      price: row.price != null ? String(row.price) : null,
      currency: (row.currency as string) ?? null,
      externalId: (row.externalId as string) ?? null,
      externalSource: (row.externalSource as string) ?? null,
      metadata: (row.metadata as unknown as Record<string, unknown>) ?? null,
      createdAt: new Date(row.createdAt as unknown as Date).toISOString(),
      updatedAt: new Date(row.updatedAt as unknown as Date).toISOString(),
    };
  }
}
