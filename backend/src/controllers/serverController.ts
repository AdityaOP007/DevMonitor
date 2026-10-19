import type { Request, Response } from 'express';
import { getServerMetrics } from '../services/serverService.js';

export async function getServerHandler(_req: Request, res: Response): Promise<void> {
  const metrics = await getServerMetrics();
  res.json(metrics);
}
