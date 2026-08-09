import { Redis } from 'ioredis';
import { getEnv } from '@aura/config';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const env = getEnv();
    redis = new Redis(env.REDIS_URL, {
      keyPrefix: env.REDIS_PREFIX,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const r = getRedis();
    const pong = await r.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
