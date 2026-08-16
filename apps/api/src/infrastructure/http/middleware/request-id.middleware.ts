import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * Attach a bounded request id to every response. A caller-supplied id is
 * accepted only when it is safe to put in logs and response headers; otherwise
 * a fresh UUID is generated. This keeps tracing useful without allowing
 * header/log injection through x-request-id.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const candidate = req.header('x-request-id');
  const requestId = candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
