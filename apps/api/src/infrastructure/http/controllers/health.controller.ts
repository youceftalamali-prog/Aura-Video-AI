import type { Request, Response } from 'express';
import { getEnv } from '@aura/config';
import { getDb } from '../../../db/client.js';
import { checkRedisHealth } from '../../redis/client.js';
import { sql } from 'drizzle-orm';
import type { ApiResponse, HealthCheck } from '@aura/types';

export class HealthController {
  check = async (_req: Request, res: Response): Promise<void> => {
    const env = getEnv();
    let database: 'up' | 'down' = 'down';
    let redis: 'up' | 'down' = 'down';
    const storage: 'up' | 'down' = 'up';

    try {
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      database = 'up';
    } catch {
      database = 'down';
    }

    try {
      const ok = await checkRedisHealth();
      redis = ok ? 'up' : 'down';
    } catch {
      redis = 'down';
    }

    const status: HealthCheck['status'] =
      database === 'up' && redis === 'up' ? 'ok' : database === 'down' ? 'error' : 'degraded';

    const body: HealthCheck = {
      status,
      version: env.APP_VERSION,
      timestamp: new Date().toISOString(),
      services: { database, redis, storage },
    };

    res.status(status === 'error' ? 503 : 200).json({
      success: true,
      data: body,
    } satisfies ApiResponse<HealthCheck>);
  };
}
