import type { Request, Response } from 'express';
import { isDbConnected } from '../db/pool.js';
import { simulationService } from '../services/simulationService.js';
import { hasActiveCriticalAlert } from '../services/alertService.js';
import type { HealthResponse, SystemHealthStatus } from '../types/index.js';

export async function getHealthHandler(_req: Request, res: Response): Promise<void> {
  const uptime = Math.floor(process.uptime());

  if (simulationService.isSimulatedDown()) {
    const payload: HealthResponse = {
      status: 'down',
      service: 'devmonitor-api',
      uptime: 0,
    };
    res.status(503).json(payload);
    return;
  }

  const dbAlive = isDbConnected();
  const criticalAlert = await hasActiveCriticalAlert();

  let status: SystemHealthStatus = 'healthy';
  if (!dbAlive || criticalAlert) {
    status = 'degraded';
  }

  const payload: HealthResponse = {
    status,
    service: 'devmonitor-api',
    uptime,
  };

  res.status(200).json(payload);
}
