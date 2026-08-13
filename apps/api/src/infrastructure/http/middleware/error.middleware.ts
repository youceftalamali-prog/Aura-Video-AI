import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@aura/shared';
import { getEnv } from '@aura/config';
import type { ApiResponse } from '@aura/types';

function isZodError(err: Error): err is Error & { issues: Array<{ path: (string | number)[]; message: string }> } {
  return err?.constructor?.name === 'ZodError' && Array.isArray((err as { issues?: unknown }).issues);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const env = getEnv();
  const isAppError = err instanceof AppError;

  let statusCode = isAppError ? err.statusCode : 500;
  let code = isAppError ? err.code : 'INTERNAL_ERROR';
  let message = isAppError ? err.message : 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  if (isZodError(err)) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request payload';
    details = {
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  } else if (isAppError && err.details) {
    details = err.details;
  }

  if (!isAppError && statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  const body: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(env.NODE_ENV === 'development' && statusCode === 500 ? { details: { stack: err.stack } } : {}),
    },
  };

  res.status(statusCode).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  } satisfies ApiResponse);
}
