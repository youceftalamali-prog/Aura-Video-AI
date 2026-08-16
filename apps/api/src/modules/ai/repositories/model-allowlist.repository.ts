import { sql } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';

export interface ModelAllowlistRow {
  providerId: string;
  modelId: string;
}

export interface ModelAllowlistRepository {
  list(providerId?: string): Promise<ModelAllowlistRow[]>;
  replace(providerId: string, modelIds: string[]): Promise<void>;
}

export class DbModelAllowlistRepository implements ModelAllowlistRepository {
  constructor(private readonly db: Database) {}

  async list(providerId?: string): Promise<ModelAllowlistRow[]> {
    const result = providerId
      ? await this.db.execute(sql`
          SELECT provider_id AS "providerId", model_id AS "modelId"
          FROM ai_model_allowlist
          WHERE provider_id = ${providerId} AND enabled = TRUE
          ORDER BY model_id
        `)
      : await this.db.execute(sql`
          SELECT provider_id AS "providerId", model_id AS "modelId"
          FROM ai_model_allowlist
          WHERE enabled = TRUE
          ORDER BY provider_id, model_id
        `);
    return readRows(result).map((row) => ({
      providerId: String(row.providerId),
      modelId: String(row.modelId),
    }));
  }

  async replace(providerId: string, modelIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        DELETE FROM ai_model_allowlist
        WHERE provider_id = ${providerId}
      `);
      for (const modelId of modelIds) {
        await tx.execute(sql`
          INSERT INTO ai_model_allowlist (provider_id, model_id, enabled, created_at, updated_at)
          VALUES (${providerId}, ${modelId}, TRUE, NOW(), NOW())
          ON CONFLICT (provider_id, model_id) DO UPDATE
          SET enabled = TRUE, updated_at = NOW()
        `);
      }
    });
  }
}

function readRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
  }
  return [];
}
