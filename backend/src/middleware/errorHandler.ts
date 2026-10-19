import type { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
  status?: number;
  statusCode?: number;
}

export function errorHandler(
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  console.error('[Internal Error Handler]', err.message, err.stack);

  // Never leak SQL queries or sensitive internal stack traces to clients
  const clientMessage =
    statusCode >= 500 ? 'Internal server error' : err.message || 'An error occurred';

  res.status(statusCode).json({ error: clientMessage });
}
