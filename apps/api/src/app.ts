import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { getEnv, APP_CONSTANTS } from '@aura/config';
import { createContainer } from './container.js';
import { createApiRouter } from './infrastructure/http/routes/index.js';
import { errorHandler, notFoundHandler } from './infrastructure/http/middleware/error.middleware.js';
import path from 'node:path';

export function createApp(): Express {
  const env = getEnv();
  const app = express();
  const container = createContainer();

  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );

  // PayPal (and legacy stripe path) webhooks need RAW body for signature verification
  const webhookRaw = express.raw({ type: 'application/json' });
  const attachRaw: express.RequestHandler = (req, _res, next) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = req.body as unknown as Buffer;
    next();
  };
  app.use(`${APP_CONSTANTS.API_PREFIX}/billing/paypal/webhook`, webhookRaw, attachRaw);
  app.use(`${APP_CONSTANTS.API_PREFIX}/billing/stripe/webhook`, webhookRaw, attachRaw);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
      },
    }),
  );

  if (env.STORAGE_PROVIDER === 'local') {
    app.use(
      '/storage',
      express.static(path.resolve(env.LOCAL_STORAGE_PATH), {
        index: false,
        dotfiles: 'deny',
        fallthrough: false,
      }),
    ); // Local-only; prefer R2 signed URLs in production
  }

  app.use(APP_CONSTANTS.API_PREFIX, createApiRouter(container));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
