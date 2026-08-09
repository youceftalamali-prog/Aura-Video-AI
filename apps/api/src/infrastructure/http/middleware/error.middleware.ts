import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@aura/shared';
import { getEnv } from '@aura/config';
import type { ApiResponse } from '@aura/types';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const env = getEnv();
  const isAppError = err instanceof AppError;

  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'An unexpected error occurred';

  if (!isAppError || statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  const body: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(isAppError && err.details ? { details: err.details } : {}),
      ...(env.NODE_ENV === 'development' && !isAppError ? { details: { stack: err.stack } } : {}),
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
