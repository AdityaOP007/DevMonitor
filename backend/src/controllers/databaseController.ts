import type { Request, Response } from 'express';
import { getDatabaseStats } from '../services/databaseService.js';

export async function getDatabaseStatsHandler(_req: Request, res: Response): Promise<void> {
  const stats = await getDatabaseStats();
  res.json(stats);
}
