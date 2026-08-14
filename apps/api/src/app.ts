import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { getEnv, APP_CONSTANTS } from '@aura/config';
import { AppError } from '@aura/shared';
import { createContainer } from './container.js';
import { createApiRouter } from './infrastructure/http/routes/index.js';
import { errorHandler, notFoundHandler } from './infrastructure/http/middleware/error.middleware.js';
import { getStorageProvider, LocalStorageProvider } from './infrastructure/storage/index.js';
import { decodeStorageKey } from './infrastructure/storage/local-signing.js';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

function contentTypeForKey(key: string): string {
  const extension = key.toLowerCase().split('.').pop();
  switch (extension) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

export function createApp(): Express {
  const env = getEnv();
  const app = express();
  const container = createContainer();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
        return callback(null, allowedOrigins.includes(origin));
      },
      credentials: true,
    }),
  );

  // PayPal and Stripe webhooks need the raw body for signature verification.
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

  // Local files are served only through short-lived, HMAC-signed URLs. There is
  // intentionally no unauthenticated express.static mount.
  app.get(`${APP_CONSTANTS.API_PREFIX}/storage/:encodedKey`, (req, res, next) => {
    void (async () => {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const encodedKey = typeof req.params.encodedKey === 'string' ? req.params.encodedKey : '';
      const key = decodeStorageKey(encodedKey);
      const provider = env.STORAGE_PROVIDER === 'local' ? getStorageProvider() : null;
      if (!(provider instanceof LocalStorageProvider) || !key || !token || !provider.verifySignedUrl(key, token)) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
        return;
      }

      try {
        const filePath = provider.getFilePath(key);
        const fileStats = await stat(filePath);
        if (!fileStats.isFile()) throw new Error('Not a file');
        res.setHeader('Content-Type', contentTypeForKey(key));
        res.setHeader('Content-Length', String(fileStats.size));
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'private, max-age=60');
        const stream = createReadStream(filePath);
        stream.on('error', next);
        stream.pipe(res);
      } catch {
        next(new AppError('File not found', 404, 'STORAGE_OBJECT_NOT_FOUND'));
      }
    })().catch(next);
  });

  app.use(APP_CONSTANTS.API_PREFIX, createApiRouter(container));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
