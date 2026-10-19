import type { Request, Response } from 'express';
import { register } from '../services/metricsService.js';

export async function getPrometheusMetricsHandler(_req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.send(metrics);
}
