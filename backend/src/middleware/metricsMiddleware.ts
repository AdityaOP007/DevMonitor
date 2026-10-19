import type { Request, Response, NextFunction } from 'express';
import {
  httpActiveRequests,
  recordRequestMetrics,
} from '../services/metricsService.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Do not record metrics for the Prometheus scrape endpoint itself
  if (req.path === '/metrics' || req.baseUrl === '/metrics' || req.originalUrl.startsWith('/metrics')) {
    return next();
  }

  httpActiveRequests.inc();
  const startTime = performance.now();

  res.on('finish', () => {
    httpActiveRequests.dec();
    const durationMs = performance.now() - startTime;

    // Determine clean route pattern to prevent label explosion
    let routePattern = 'unmatched';

    if (res.statusCode === 404) {
      routePattern = 'unmatched';
    } else if (req.route && req.route.path) {
      const subPath = req.route.path === '/' ? '' : req.route.path;
      routePattern = (req.baseUrl || '') + subPath;
      if (!routePattern) routePattern = '/';
      // Normalize trailing slash
      if (routePattern.length > 1 && routePattern.endsWith('/')) {
        routePattern = routePattern.slice(0, -1);
      }
    } else {
      routePattern = 'unmatched';
    }

    const method = req.method.toUpperCase();
    recordRequestMetrics(method, routePattern, res.statusCode, durationMs, req.originalUrl || req.url);
  });

  next();
}
