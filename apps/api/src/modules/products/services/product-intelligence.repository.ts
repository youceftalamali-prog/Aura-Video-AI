import { sql } from 'drizzle-orm';
import type { ProductIntelligence, ExtractedProductData } from '@aura/types';
import type { Database } from '../../../db/client.js';

export type ProductIntelligenceStatus = 'ready' | 'failed';

export interface ProductIntelligenceRecord {
  productId: string;
  version: number;
  status: ProductIntelligenceStatus;
  intelligence: ProductIntelligence | null;
  extracted: ExtractedProductData | null;
  errorCode: string | null;
  updatedAt: string;
}

export interface ProductIntelligenceRepository {
  getByProductId(productId: string): Promise<ProductIntelligenceRecord | null>;
  saveReady(productId: string, intelligence: ProductIntelligence, extracted?: ExtractedProductData | null): Promise<ProductIntelligenceRecord>;
  markFailed(productId: string, errorCode: string): Promise<void>;
}

export class DbProductIntelligenceRepository implements ProductIntelligenceRepository {
  constructor(private readonly db: Database) {}

  async getByProductId(productId: string): Promise<ProductIntelligenceRecord | null> {
    const result = await this.db.execute(sql`
      SELECT
        product_id AS "productId",
        version,
        status,
        intelligence,
        extracted,
        error_code AS "errorCode",
        updated_at AS "updatedAt"
      FROM product_intelligence
      WHERE product_id = ${productId}
      LIMIT 1
    `);
    const row = readRows(result)[0];
    return row ? mapRow(row) : null;
  }

  async saveReady(
    productId: string,
    intelligence: ProductIntelligence,
    extracted?: ExtractedProductData | null,
  ): Promise<ProductIntelligenceRecord> {
    await this.db.execute(sql`
      INSERT INTO product_intelligence (
        product_id,
        version,
        status,
        intelligence,
        extracted,
        error_code,
        created_at,
        updated_at
      )
      VALUES (
        ${productId},
        1,
        'ready',
        ${JSON.stringify(intelligence)}::jsonb,
        ${extracted ? JSON.stringify(extracted) : null}::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT (product_id) DO UPDATE SET
        version = product_intelligence.version + 1,
        status = 'ready',
        intelligence = EXCLUDED.intelligence,
        extracted = EXCLUDED.extracted,
        error_code = NULL,
        updated_at = NOW()
    `);
    const saved = await this.getByProductId(productId);
    if (!saved) throw new Error('Product intelligence was not persisted');
    return saved;
  }

  async markFailed(productId: string, errorCode: string): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO product_intelligence (
        product_id,
        version,
        status,
        intelligence,
        extracted,
        error_code,
        created_at,
        updated_at
      )
      VALUES (${productId}, 1, 'failed', NULL, NULL, ${errorCode}, NOW(), NOW())
      ON CONFLICT (product_id) DO UPDATE SET
        version = product_intelligence.version + 1,
        status = 'failed',
        intelligence = NULL,
        error_code = ${errorCode},
        updated_at = NOW()
    `);
  }
}

function mapRow(row: Record<string, unknown>): ProductIntelligenceRecord {
  return {
    productId: String(row.productId),
    version: Number(row.version),
    status: row.status === 'failed' ? 'failed' : 'ready',
    intelligence: parseJson<ProductIntelligence>(row.intelligence),
    extracted: parseJson<ExtractedProductData>(row.extracted),
    errorCode: row.errorCode == null ? null : String(row.errorCode),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

function parseJson<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function readRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
  }
  return [];
}
