import type { Request, Response } from 'express';
import { register } from '../services/metricsService.js';

export async function getPrometheusMetricsHandler(_req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', register.contentType);
  const rawMetrics = await register.metrics();
  // Ensure no uninitialized or zero-sample NaN values appear in the Prometheus output
  const metrics = rawMetrics.replace(/(\s+)NaN(\s+|$)/gi, '$10$2');
  res.send(metrics);
}
