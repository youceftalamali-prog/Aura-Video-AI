import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { workspaceSettings } from '../../../db/schema.js';
import type { AiStrategy, WorkspaceSettings } from '@aura/types';

export interface WorkspaceSettingsRecord {
  workspaceId: string;
  defaultAiModel: string | null;
  aiStrategy: AiStrategy | null;
  updatedAt: string | null;
}

export interface WorkspaceSettingsRepository {
  getByWorkspaceId(workspaceId: string): Promise<WorkspaceSettingsRecord | null>;
  create(workspaceId: string, seed?: Partial<WorkspaceSettings>): Promise<WorkspaceSettingsRecord>;
  upsert(workspaceId: string, patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettingsRecord>;
}

interface WorkspaceSettingsRow {
  workspaceId: string;
  defaultAiModel: string | null;
  aiStrategy: string;
  updatedAt: Date | null;
}

function mapRow(row: WorkspaceSettingsRow): WorkspaceSettingsRecord {
  return {
    workspaceId: row.workspaceId,
    defaultAiModel: row.defaultAiModel,
    aiStrategy: row.aiStrategy as AiStrategy,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export class DbWorkspaceSettingsRepository implements WorkspaceSettingsRepository {
  constructor(private readonly db: Database) {}

  async getByWorkspaceId(workspaceId: string): Promise<WorkspaceSettingsRecord | null> {
    const rows = await this.db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspaceId))
      .limit(1);
    return rows[0] ? mapRow(rows[0] as unknown as WorkspaceSettingsRow) : null;
  }

  async create(workspaceId: string, seed?: Partial<WorkspaceSettings>): Promise<WorkspaceSettingsRecord> {
    const rows = await this.db
      .insert(workspaceSettings)
      .values({
        workspaceId,
        defaultAiModel: seed?.defaultAiModel ?? null,
        aiStrategy: seed?.aiStrategy ?? null,
      })
      .returning();
    return mapRow(rows[0] as unknown as WorkspaceSettingsRow);
  }

  async upsert(workspaceId: string, patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettingsRecord> {
    const existing = await this.getByWorkspaceId(workspaceId);
    const values = {
      defaultAiModel: patch.defaultAiModel !== undefined ? patch.defaultAiModel : existing?.defaultAiModel ?? null,
      aiStrategy: patch.aiStrategy !== undefined ? patch.aiStrategy : existing?.aiStrategy ?? null,
      updatedAt: new Date(),
    };
    const rows = await this.db
      .insert(workspaceSettings)
      .values({ workspaceId, ...values })
      .onConflictDoUpdate({
        target: workspaceSettings.workspaceId,
        set: { ...values },
      })
      .returning();
    return mapRow(rows[0] as unknown as WorkspaceSettingsRow);
  }
}

export class InMemoryWorkspaceSettingsRepository implements WorkspaceSettingsRepository {
  private store = new Map<string, WorkspaceSettingsRecord>();

  seed(record: WorkspaceSettingsRecord): void {
    this.store.set(record.workspaceId, { ...record });
  }

  async getByWorkspaceId(workspaceId: string): Promise<WorkspaceSettingsRecord | null> {
    const record = this.store.get(workspaceId);
    return record ? { ...record } : null;
  }

  async create(workspaceId: string, seed?: Partial<WorkspaceSettings>): Promise<WorkspaceSettingsRecord> {
    const record: WorkspaceSettingsRecord = {
      workspaceId,
      defaultAiModel: seed?.defaultAiModel ?? null,
      aiStrategy: seed?.aiStrategy ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(workspaceId, { ...record });
    return { ...record };
  }

  async upsert(workspaceId: string, patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettingsRecord> {
    const existing = this.store.get(workspaceId) ?? { workspaceId, defaultAiModel: null, aiStrategy: null, updatedAt: null };
    const merged: WorkspaceSettingsRecord = {
      workspaceId,
      defaultAiModel: patch.defaultAiModel !== undefined ? patch.defaultAiModel : existing.defaultAiModel,
      aiStrategy: patch.aiStrategy !== undefined ? patch.aiStrategy : existing.aiStrategy,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(workspaceId, { ...merged });
    return { ...merged };
  }
}
