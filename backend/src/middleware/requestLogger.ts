import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();

  res.on('finish', () => {
    // Only log non-metrics requests to keep terminal clean
    if (req.path !== '/metrics') {
      const durationMs = (performance.now() - start).toFixed(1);
      console.log(`[HTTP] ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${durationMs}ms)`);
    }
  });

  next();
}
