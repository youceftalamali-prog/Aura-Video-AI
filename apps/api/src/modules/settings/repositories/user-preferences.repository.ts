import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { userPreferences } from '../../../db/schema.js';
import type {
  AiStrategy,
  AppearancePreference,
  AspectRatioPreference,
  NotificationPreferences,
  ResolutionPreference,
  UserPreferences,
} from '@aura/types';
import { DEFAULT_NOTIFICATIONS, DEFAULT_PREFERENCES } from '../services/defaults.js';

export interface UserPreferencesRecord extends UserPreferences {
  userId: string;
  updatedAt: string | null;
}

export interface UserPreferencesRepository {
  getByUserId(userId: string): Promise<UserPreferencesRecord | null>;
  create(userId: string, seed?: Partial<UserPreferences>): Promise<UserPreferencesRecord>;
  upsert(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferencesRecord>;
}

interface UserPreferencesRow {
  userId: string;
  language: string;
  appearance: string;
  defaultAiModel: string | null;
  aiStrategy: string;
  defaultVideoDuration: number | null;
  defaultAspectRatio: string | null;
  defaultResolution: string | null;
  defaultVideoLanguage: string | null;
  notifications: NotificationPreferences;
  updatedAt: Date | null;
}

function mapRow(row: UserPreferencesRow): UserPreferencesRecord {
  return {
    userId: row.userId,
    language: row.language,
    appearance: row.appearance as AppearancePreference,
    defaultAiModel: row.defaultAiModel,
    aiStrategy: row.aiStrategy as AiStrategy,
    defaultVideoDuration: row.defaultVideoDuration,
    defaultAspectRatio: row.defaultAspectRatio as AspectRatioPreference | null,
    defaultResolution: row.defaultResolution as ResolutionPreference | null,
    defaultVideoLanguage: row.defaultVideoLanguage,
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(row.notifications ?? {}) },
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export class DbUserPreferencesRepository implements UserPreferencesRepository {
  constructor(private readonly db: Database) {}

  async getByUserId(userId: string): Promise<UserPreferencesRecord | null> {
    const rows = await this.db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return rows[0] ? mapRow(rows[0] as unknown as UserPreferencesRow) : null;
  }

  async create(userId: string, seed?: Partial<UserPreferences>): Promise<UserPreferencesRecord> {
    const rows = await this.db
      .insert(userPreferences)
      .values({
        userId,
        language: seed?.language ?? DEFAULT_PREFERENCES.language,
        appearance: seed?.appearance ?? DEFAULT_PREFERENCES.appearance,
        defaultAiModel: seed?.defaultAiModel ?? DEFAULT_PREFERENCES.defaultAiModel,
        aiStrategy: seed?.aiStrategy ?? DEFAULT_PREFERENCES.aiStrategy,
        defaultVideoDuration: seed?.defaultVideoDuration ?? DEFAULT_PREFERENCES.defaultVideoDuration,
        defaultAspectRatio: seed?.defaultAspectRatio ?? DEFAULT_PREFERENCES.defaultAspectRatio,
        defaultResolution: seed?.defaultResolution ?? DEFAULT_PREFERENCES.defaultResolution,
        defaultVideoLanguage: seed?.defaultVideoLanguage ?? DEFAULT_PREFERENCES.defaultVideoLanguage,
        notifications: { ...DEFAULT_NOTIFICATIONS, ...(seed?.notifications ?? {}) },
      })
      .returning();
    return mapRow(rows[0] as unknown as UserPreferencesRow);
  }

  async upsert(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferencesRecord> {
    const existing = await this.getByUserId(userId);
    const values = {
      language: patch.language !== undefined ? patch.language : existing?.language ?? null,
      appearance: patch.appearance !== undefined ? patch.appearance : existing?.appearance ?? null,
      defaultAiModel: patch.defaultAiModel !== undefined ? patch.defaultAiModel : existing?.defaultAiModel ?? null,
      aiStrategy: patch.aiStrategy !== undefined ? patch.aiStrategy : existing?.aiStrategy ?? null,
      defaultVideoDuration:
        patch.defaultVideoDuration !== undefined ? patch.defaultVideoDuration : existing?.defaultVideoDuration ?? null,
      defaultAspectRatio:
        patch.defaultAspectRatio !== undefined ? patch.defaultAspectRatio : existing?.defaultAspectRatio ?? null,
      defaultResolution:
        patch.defaultResolution !== undefined ? patch.defaultResolution : existing?.defaultResolution ?? null,
      defaultVideoLanguage:
        patch.defaultVideoLanguage !== undefined ? patch.defaultVideoLanguage : existing?.defaultVideoLanguage ?? null,
      notifications: { ...DEFAULT_NOTIFICATIONS, ...(existing?.notifications ?? {}), ...(patch.notifications ?? {}) },
      updatedAt: new Date(),
    };
    const rows = await this.db
      .insert(userPreferences)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...values },
      })
      .returning();
    return mapRow(rows[0] as unknown as UserPreferencesRow);
  }
}

export class InMemoryUserPreferencesRepository implements UserPreferencesRepository {
  private store = new Map<string, UserPreferencesRecord>();

  seed(record: UserPreferencesRecord): void {
    this.store.set(record.userId, { ...record });
  }

  async getByUserId(userId: string): Promise<UserPreferencesRecord | null> {
    const record = this.store.get(userId);
    return record ? { ...record } : null;
  }

  async create(userId: string, seed?: Partial<UserPreferences>): Promise<UserPreferencesRecord> {
    const record: UserPreferencesRecord = {
      userId,
      language: seed?.language ?? DEFAULT_PREFERENCES.language,
      appearance: seed?.appearance ?? DEFAULT_PREFERENCES.appearance,
      defaultAiModel: seed?.defaultAiModel ?? DEFAULT_PREFERENCES.defaultAiModel,
      aiStrategy: seed?.aiStrategy ?? DEFAULT_PREFERENCES.aiStrategy,
      defaultVideoDuration: seed?.defaultVideoDuration ?? DEFAULT_PREFERENCES.defaultVideoDuration,
      defaultAspectRatio: seed?.defaultAspectRatio ?? DEFAULT_PREFERENCES.defaultAspectRatio,
      defaultResolution: seed?.defaultResolution ?? DEFAULT_PREFERENCES.defaultResolution,
      defaultVideoLanguage: seed?.defaultVideoLanguage ?? DEFAULT_PREFERENCES.defaultVideoLanguage,
      notifications: { ...DEFAULT_NOTIFICATIONS, ...(seed?.notifications ?? {}) },
      updatedAt: new Date().toISOString(),
    };
    this.store.set(userId, { ...record });
    return { ...record };
  }

  async upsert(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferencesRecord> {
    const existing = this.store.get(userId) ?? {
      userId,
      ...DEFAULT_PREFERENCES,
      updatedAt: null,
    };
    const merged: UserPreferencesRecord = {
      userId,
      language: patch.language !== undefined ? patch.language : existing.language,
      appearance: patch.appearance !== undefined ? patch.appearance : existing.appearance,
      defaultAiModel: patch.defaultAiModel !== undefined ? patch.defaultAiModel : existing.defaultAiModel,
      aiStrategy: patch.aiStrategy !== undefined ? patch.aiStrategy : existing.aiStrategy,
      defaultVideoDuration:
        patch.defaultVideoDuration !== undefined ? patch.defaultVideoDuration : existing.defaultVideoDuration,
      defaultAspectRatio: patch.defaultAspectRatio !== undefined ? patch.defaultAspectRatio : existing.defaultAspectRatio,
      defaultResolution: patch.defaultResolution !== undefined ? patch.defaultResolution : existing.defaultResolution,
      defaultVideoLanguage:
        patch.defaultVideoLanguage !== undefined ? patch.defaultVideoLanguage : existing.defaultVideoLanguage,
      notifications: { ...DEFAULT_NOTIFICATIONS, ...existing.notifications, ...(patch.notifications ?? {}) },
      updatedAt: new Date().toISOString(),
    };
    this.store.set(userId, { ...merged });
    return { ...merged };
  }
}
