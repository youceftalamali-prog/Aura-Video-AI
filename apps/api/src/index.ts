import 'dotenv/config';
import { loadEnv } from '@aura/config';
import { createApp } from './app.js';
import { closeDb } from './db/client.js';
import { closeRedis } from './infrastructure/redis/client.js';

async function bootstrap() {
  const env = loadEnv();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[Aura API] listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[Aura API] received ${signal}, shutting down...`);
    server.close(async () => {
      await closeDb();
      await closeRedis();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
