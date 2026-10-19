import type { Request, Response, NextFunction } from 'express';
import { simulationService } from '../services/simulationService.js';

export function simulationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;

  // Essential endpoints that must ALWAYS remain reachable during simulation
  const isExempt =
    path === '/metrics' ||
    path === '/api/health' ||
    path === '/api/test/restore' ||
    path.startsWith('/api/test/');

  // 1. Simulated Down Check
  if (simulationService.isSimulatedDown() && !isExempt) {
    res.status(503).json({ error: 'Backend service is currently simulated down' });
    return;
  }

  // 2. Simulated Error Mode Check (affects normal business endpoints)
  if (simulationService.isErrorMode() && !isExempt) {
    // Return HTTP 500 to produce real error rate & http_errors_total increment
    res.status(500).json({ error: 'Simulated 500 Internal Server Error' });
    return;
  }

  // 3. Simulated Slow Mode Check (adds genuine 850ms latency)
  if (simulationService.isSlowMode() && !isExempt) {
    setTimeout(() => {
      next();
    }, 850);
    return;
  }

  next();
}
