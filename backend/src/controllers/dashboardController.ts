import type { Request, Response } from 'express';
import { getProcessSnapshot } from '../services/metricsService.js';
import { getDashboardUptimePercent } from '../jobs/healthCheckJob.js';
import type { DashboardMetrics } from '../types/index.js';

export function getDashboardHandler(_req: Request, res: Response): void {
  const snapshot = getProcessSnapshot();
  const uptime = getDashboardUptimePercent();

  const payload: DashboardMetrics = {
    requests: snapshot.requests,
    errors: snapshot.errors,
    responseTime: snapshot.avgResponseTime,
    uptime,
  };

  res.json(payload);
}
