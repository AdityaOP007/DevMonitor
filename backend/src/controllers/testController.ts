import type { Request, Response } from 'express';
import http from 'node:http';
import { config } from '../config/env.js';
import { simulationService } from '../services/simulationService.js';
import type { TestActionResponse } from '../types/index.js';

async function sendBatchRequests(total: number, concurrency: number = 10): Promise<number> {
  let completed = 0;
  const healthUrl = `http://127.0.0.1:${config.port}/api/health`;

  const makeSingleRequest = (): Promise<void> => {
    return new Promise((resolve) => {
      const req = http.get(healthUrl, (res) => {
        res.resume();
        completed += 1;
        resolve();
      });
      req.on('error', () => {
        completed += 1;
        resolve();
      });
    });
  };

  const pool: Promise<void>[] = [];
  for (let i = 0; i < total; i++) {
    const p = makeSingleRequest().then(() => {
      pool.splice(pool.indexOf(p), 1);
    });
    pool.push(p);
    if (pool.length >= concurrency) {
      await Promise.race(pool);
    }
  }

  await Promise.all(pool);
  return completed;
}

export async function testLoadHandler(req: Request, res: Response): Promise<void> {
  const count = parseInt(req.body?.count, 10);

  if (isNaN(count) || count < 1 || count > config.testMaxRequests) {
    res.status(400).json({
      error: `Invalid request count. Must be between 1 and ${config.testMaxRequests}.`,
    });
    return;
  }

  const sent = await sendBatchRequests(count, 10);
  const response: TestActionResponse = {
    success: true,
    sent,
    message: `Generated and processed ${sent} live requests`,
  };

  res.json(response);
}

export function testErrorsHandler(_req: Request, res: Response): void {
  simulationService.setErrorMode(true);
  res.json({ success: true, message: 'Simulated high error rate activated' });
}

export function testSlowHandler(_req: Request, res: Response): void {
  simulationService.setSlowMode(true);
  res.json({ success: true, message: 'Simulated slow API latency activated' });
}

export function testCpuHandler(_req: Request, res: Response): void {
  simulationService.triggerCpuWorkload(20);
  res.json({ success: true, message: 'Simulated high CPU workload triggered for 20 seconds' });
}

export function testStopHandler(_req: Request, res: Response): void {
  simulationService.setSimulatedDown(true);
  res.json({ success: true, message: 'Backend service marked as simulated down' });
}

export function testRestoreHandler(_req: Request, res: Response): void {
  simulationService.restoreAll();
  res.json({ success: true, message: 'System restored to normal' });
}
