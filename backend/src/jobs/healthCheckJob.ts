import http from 'node:http';
import https from 'node:https';
import { config } from '../config/env.js';
import { query, isDatabaseAlive } from '../db/pool.js';
import { devmonitorServiceUp } from '../services/metricsService.js';
import type { ServiceStatus } from '../types/index.js';

let intervalId: NodeJS.Timeout | null = null;
let totalRuns = 0;
let passedRuns = 0;

export function getDashboardUptimePercent(): number {
  if (totalRuns === 0) return 100;
  return Number(((passedRuns / totalRuns) * 100).toFixed(1));
}

function probeUrl(urlStr: string, timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.get(urlStr, { timeout: timeoutMs }, (res) => {
        resolve((res.statusCode ?? 500) < 400);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.on('error', () => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

export async function runHealthCheckCycle(): Promise<void> {
  totalRuns += 1;
  let cyclePassed = true;

  try {
    // 1. Check Database
    const dbAlive = await isDatabaseAlive();
    devmonitorServiceUp.set({ service: 'Database' }, dbAlive ? 1 : 0);

    if (!dbAlive) {
      cyclePassed = false;
      await query("UPDATE services SET status = 'Down' WHERE name = 'Database'").catch(() => {});
    } else {
      await query("UPDATE services SET status = 'Healthy' WHERE name = 'Database'").catch(() => {});
    }

    // 2. Check HTTP Services (Backend API, Prometheus, Grafana)
    const result = await query<{ id: number; name: string; url: string | null }>(
      'SELECT id, name, url FROM services WHERE url IS NOT NULL'
    );

    for (const s of result.rows) {
      if (!s.url) continue;

      const reachable = await probeUrl(s.url);
      let newStatus: ServiceStatus = 'Down';

      if (reachable) {
        if (s.name === 'Prometheus') {
          newStatus = 'Collecting';
        } else if (s.name === 'Grafana') {
          newStatus = 'Connected';
        } else {
          newStatus = 'Healthy';
        }
        devmonitorServiceUp.set({ service: s.name }, 1);
      } else {
        cyclePassed = false;
        newStatus = 'Down';
        devmonitorServiceUp.set({ service: s.name }, 0);
      }

      await query('UPDATE services SET status = $1 WHERE id = $2', [newStatus, s.id]);
    }
  } catch (error) {
    cyclePassed = false;
    console.error('[HealthCheckJob Error]', error);
  }

  if (cyclePassed) {
    passedRuns += 1;
  }
}

export function startHealthCheckJob(): void {
  // Initialize default service up series
  devmonitorServiceUp.set({ service: 'Backend API' }, 1);
  devmonitorServiceUp.set({ service: 'Database' }, 0);
  devmonitorServiceUp.set({ service: 'Prometheus' }, 0);
  devmonitorServiceUp.set({ service: 'Grafana' }, 0);

  // Run once shortly after boot, then every interval
  setTimeout(() => {
    runHealthCheckCycle();
  }, 2000);

  intervalId = setInterval(() => {
    runHealthCheckCycle();
  }, config.healthCheckIntervalSeconds * 1000);
}

export function stopHealthCheckJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
