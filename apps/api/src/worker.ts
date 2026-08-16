import 'dotenv/config';
import { loadEnv } from '@aura/config';
import { closeDb } from './db/client.js';
import { closeRedis } from './infrastructure/redis/client.js';
import { createVideoModule } from './modules/video/index.js';

async function bootstrap(): Promise<void> {
  loadEnv();
  const { worker } = createVideoModule();
  await worker.start();
  console.log('[Aura Video Worker] started');

  const shutdown = async (signal: string) => {
    console.log(`[Aura Video Worker] received ${signal}, shutting down...`);
    await worker.stop();
    await closeDb();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch(async (error) => {
  console.error('[Aura Video Worker] failed to start:', error);
  await closeDb().catch(() => undefined);
  await closeRedis().catch(() => undefined);
  process.exit(1);
});
