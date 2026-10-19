import type { Request, Response } from 'express';
import { getAlerts, getAlertConfig, saveAlertConfig } from '../services/alertService.js';
import type { AlertConfig } from '../types/index.js';

export async function getAlertsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const alerts = await getAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(503).json({ error: 'Database service is currently unavailable' });
  }
}

export async function getAlertConfigHandler(_req: Request, res: Response): Promise<void> {
  try {
    const config = await getAlertConfig();
    res.json(config);
  } catch (error) {
    res.status(503).json({ error: 'Database service is currently unavailable' });
  }
}

export async function saveAlertConfigHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as Partial<AlertConfig>;

  if (
    typeof body.cpuThreshold !== 'number' ||
    typeof body.memoryThreshold !== 'number' ||
    typeof body.errorRateThreshold !== 'number' ||
    typeof body.responseTimeThreshold !== 'number' ||
    typeof body.durationMinutes !== 'number'
  ) {
    res.status(400).json({
      error: 'Missing or invalid fields. cpuThreshold, memoryThreshold, errorRateThreshold, responseTimeThreshold and durationMinutes must be numbers.',
    });
    return;
  }

  try {
    const saved = await saveAlertConfig(body as AlertConfig);
    res.json(saved);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('Invalid alert configuration')) {
      res.status(400).json({ error: message });
    } else {
      res.status(503).json({ error: 'Database service is currently unavailable' });
    }
  }
}
