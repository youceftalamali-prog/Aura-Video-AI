import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { settings } from '../../db/schema.js';

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  async get(key: string): Promise<unknown | null> {
    const rows = await this.db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  }

  async set(key: string, value: unknown, description?: string): Promise<void> {
    await this.db
      .insert(settings)
      .values({
        key,
        value,
        description: description ?? null,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value,
          description: description ?? null,
          updatedAt: new Date(),
        },
      });
  }

  async list(): Promise<{ key: string; value: unknown; description: string | null }[]> {
    const rows = await this.db.select().from(settings);
    return rows.map((r) => ({
      key: r.key,
      value: r.value,
      description: r.description,
    }));
  }
}
