import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@aura/shared';
import { getEnv } from '@aura/config';
import type { ApiResponse } from '@aura/types';

function isZodError(err: Error): err is Error & { issues: Array<{ path: (string | number)[]; message: string }> } {
  return err?.constructor?.name === 'ZodError' && Array.isArray((err as { issues?: unknown }).issues);
}

const SAFE_ERROR_CODES = new Set([
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMIT_EXCEEDED',
  'URL_REDIRECT_BLOCKED',
  'PRODUCT_URL_NOT_HTML',
  'PRODUCT_URL_TIMEOUT',
  'PRODUCT_URL_TOO_LARGE',
  'URL_NOT_HTML',
  'URL_FETCH_TIMEOUT',
  'URL_REDIRECT_BLOCKED',
  'REMOTE_RESPONSE_TOO_LARGE',
]);

function publicMessage(code: string, message: string): string {
  if (SAFE_ERROR_CODES.has(code)) return message;
  if (/PROVIDER|STORAGE|DATABASE|FETCH|INTERNAL|TOKEN|SECRET|OAUTH|PAYPAL|STRIPE|ENCRYPT/i.test(code)) {
    return 'The request could not be completed';
  }
  return message;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isAppError = err instanceof AppError;
  let statusCode = isAppError ? err.statusCode : 500;
  let code = isAppError ? err.code : 'INTERNAL_ERROR';
  let message = isAppError ? publicMessage(code, err.message) : 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  if (isZodError(err)) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request payload';
    details = {
      issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    };
  }

  if (!isAppError || statusCode >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'http_error',
      code,
      statusCode,
      message: err.message,
      stack: err.stack,
      ts: new Date().toISOString(),
    }));
  }

  // Never return provider responses, storage errors, stacks, or arbitrary AppError
  // details to clients. Validation paths are intentionally the only public details.
  const body: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  res.status(statusCode).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  } satisfies ApiResponse);
}
