import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export function testGuard(_req: Request, res: Response, next: NextFunction): void {
  if (!config.enableTestEndpoints) {
    res.status(404).json({ error: 'Test endpoints are disabled' });
    return;
  }
  next();
}
