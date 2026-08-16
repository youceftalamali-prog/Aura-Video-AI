import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { aiProviderConfigs } from '../../../db/schema.js';

export interface ProviderConfigRow {
  id: string;
  workspaceId: string | null;
  providerId: string;
  enabled: boolean;
  baseUrl: string | null;
  encryptedApiKey: string | null;
  defaultModelId: string | null;
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderConfigUpsert {
  workspaceId: string | null;
  providerId: string;
  enabled: boolean;
  baseUrl: string | null;
  encryptedApiKey: string | null;
  defaultModelId: string | null;
  capabilities: string[];
}

export interface ProviderConfigPatch {
  enabled?: boolean;
  baseUrl?: string | null;
  encryptedApiKey?: string | null;
  defaultModelId?: string | null;
  capabilities?: string[];
}

export interface ProviderConfigRepository {
  /** list(undefined) = all scopes; list(null) = system scope only; list(id) = one workspace. */
  list(workspaceId?: string | null): Promise<ProviderConfigRow[]>;
  findById(id: string): Promise<ProviderConfigRow | null>;
  findByScope(workspaceId: string | null, providerId: string): Promise<ProviderConfigRow | null>;
  create(input: ProviderConfigUpsert): Promise<ProviderConfigRow>;
  update(id: string, patch: ProviderConfigPatch): Promise<ProviderConfigRow | null>;
  delete(id: string): Promise<boolean>;
}

type DbRow = typeof aiProviderConfigs.$inferSelect;

function toRow(row: DbRow): ProviderConfigRow {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    providerId: row.providerId,
    enabled: row.enabled,
    baseUrl: row.baseUrl,
    encryptedApiKey: row.encryptedApiKey,
    defaultModelId: row.defaultModelId,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map(String) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DbProviderConfigRepository implements ProviderConfigRepository {
  constructor(private readonly db: Database) {}

  async list(workspaceId?: string | null): Promise<ProviderConfigRow[]> {
    const rows = await this.db
      .select()
      .from(aiProviderConfigs)
      .where(workspaceId === undefined ? undefined : workspaceId === null ? isNull(aiProviderConfigs.workspaceId) : eq(aiProviderConfigs.workspaceId, workspaceId))
      .orderBy(aiProviderConfigs.providerId);
    return rows.map(toRow);
  }

  async findById(id: string): Promise<ProviderConfigRow | null> {
    const rows = await this.db.select().from(aiProviderConfigs).where(eq(aiProviderConfigs.id, id)).limit(1);
    return rows[0] ? toRow(rows[0]!) : null;
  }

  async findByScope(workspaceId: string | null, providerId: string): Promise<ProviderConfigRow | null> {
    const rows = await this.db
      .select()
      .from(aiProviderConfigs)
      .where(
        and(
          workspaceId === null ? isNull(aiProviderConfigs.workspaceId) : eq(aiProviderConfigs.workspaceId, workspaceId),
          eq(aiProviderConfigs.providerId, providerId),
        ),
      )
      .limit(1);
    return rows[0] ? toRow(rows[0]!) : null;
  }

  async create(input: ProviderConfigUpsert): Promise<ProviderConfigRow> {
    const rows = await this.db
      .insert(aiProviderConfigs)
      .values({
        workspaceId: input.workspaceId,
        providerId: input.providerId,
        enabled: input.enabled,
        baseUrl: input.baseUrl,
        encryptedApiKey: input.encryptedApiKey,
        defaultModelId: input.defaultModelId,
        capabilities: input.capabilities,
      })
      .returning();
    return toRow(rows[0]!);
  }

  async update(id: string, patch: ProviderConfigPatch): Promise<ProviderConfigRow | null> {
    const rows = await this.db
      .update(aiProviderConfigs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(aiProviderConfigs.id, id))
      .returning();
    return rows[0] ? toRow(rows[0]!) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.delete(aiProviderConfigs).where(eq(aiProviderConfigs.id, id)).returning({ id: aiProviderConfigs.id });
    return rows.length > 0;
  }
}

export class InMemoryProviderConfigRepository implements ProviderConfigRepository {
  private rows = new Map<string, ProviderConfigRow>();
  private scopeIndex = new Map<string, string>();

  constructor(seed: ProviderConfigRow[] = []) {
    for (const row of seed) {
      this.rows.set(row.id, row);
      this.scopeIndex.set(scopeKey(row.workspaceId, row.providerId), row.id);
    }
  }

  async list(workspaceId?: string | null): Promise<ProviderConfigRow[]> {
    const rows = [...this.rows.values()];
    if (workspaceId === undefined) return rows;
    if (workspaceId === null) return rows.filter((r) => r.workspaceId === null);
    return rows.filter((r) => r.workspaceId === workspaceId);
  }

  async findById(id: string): Promise<ProviderConfigRow | null> {
    return this.rows.get(id) ?? null;
  }

  async findByScope(workspaceId: string | null, providerId: string): Promise<ProviderConfigRow | null> {
    const id = this.scopeIndex.get(scopeKey(workspaceId, providerId));
    return id ? this.rows.get(id) ?? null : null;
  }

  async create(input: ProviderConfigUpsert): Promise<ProviderConfigRow> {
    const now = new Date();
    const row: ProviderConfigRow = {
      id: `id-${Math.random().toString(36).slice(2, 10)}`,
      workspaceId: input.workspaceId,
      providerId: input.providerId,
      enabled: input.enabled,
      baseUrl: input.baseUrl,
      encryptedApiKey: input.encryptedApiKey,
      defaultModelId: input.defaultModelId,
      capabilities: input.capabilities,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    this.scopeIndex.set(scopeKey(input.workspaceId, input.providerId), row.id);
    return row;
  }

  async update(id: string, patch: ProviderConfigPatch): Promise<ProviderConfigRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    const updated = { ...row, ...patch, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return false;
    this.rows.delete(id);
    this.scopeIndex.delete(scopeKey(row.workspaceId, row.providerId));
    return true;
  }
}

function scopeKey(workspaceId: string | null, providerId: string): string {
  return `${workspaceId ?? '__system__'}:${providerId}`;
}
