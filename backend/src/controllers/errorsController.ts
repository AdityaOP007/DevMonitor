import type { Request, Response } from 'express';
import { getRecentErrorsList } from '../services/metricsService.js';

export function getRecentErrorsHandler(_req: Request, res: Response): void {
  const errors = getRecentErrorsList();
  res.json(errors);
}
