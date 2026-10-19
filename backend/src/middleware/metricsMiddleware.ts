import type { Request, Response, NextFunction } from 'express';
import {
  httpActiveRequests,
  recordRequestMetrics,
} from '../services/metricsService.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Do not record metrics for the Prometheus scrape endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  httpActiveRequests.inc();
  const startTime = performance.now();

  res.on('finish', () => {
    httpActiveRequests.dec();
    const durationMs = performance.now() - startTime;

    // Use route pattern (e.g. /api/users/:id) or 'unmatched' for 404s
    let routePattern = 'unmatched';
    if (req.route && req.route.path) {
      routePattern = (req.baseUrl || '') + req.route.path;
    } else if (res.statusCode === 404) {
      routePattern = 'unmatched';
    } else {
      routePattern = req.baseUrl || req.path || 'unknown';
    }

    recordRequestMetrics(req.method, routePattern, res.statusCode, durationMs, req.originalUrl || req.url);
  });

  next();
}
