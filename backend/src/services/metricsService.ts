import client from 'prom-client';
import { simulationService } from './simulationService.js';
import { rawPool, isDbConnected } from '../db/pool.js';
import type { QueryResultRow } from 'pg';
import type { SystemErrorItem, ApiMetricsOverview } from '../types/index.js';

export const register = new client.Registry();

// Enable Node.js process and memory default metrics without renaming custom metrics
client.collectDefaultMetrics({ register });

// --- Application Metrics (Docs Phase 11) ---

// 1. http_requests_total (Counter)
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

// 2. http_errors_total (Counter) - status >= 500 only
export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP requests resulting in 5xx server errors',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

// 3. http_request_duration_seconds (Histogram, 5ms to 5s)
export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// 4. http_active_requests (Gauge)
export const httpActiveRequests = new client.Gauge({
  name: 'http_active_requests',
  help: 'Number of currently active in-flight HTTP requests',
  registers: [register],
});

// --- Database & Infrastructure Metrics (Docs Phase 14) ---

// 5. devmonitor_db_up (Gauge)
export const devmonitorDbUp = new client.Gauge({
  name: 'devmonitor_db_up',
  help: 'Database reachability status (1 = reachable, 0 = unreachable)',
  registers: [register],
  async collect() {
    try {
      const isAlive = await probeDatabaseWithTimeout(1500);
      this.set(isAlive ? 1 : 0);
    } catch {
      this.set(0);
    }
  },
});

// 6. devmonitor_db_connections (Gauge)
export const devmonitorDbConnections = new client.Gauge({
  name: 'devmonitor_db_connections',
  help: 'Number of active PostgreSQL client connections',
  registers: [register],
  async collect() {
    try {
      if (!isDbConnected()) return;
      const res = await queryWithTimeout<{ count: string }>(
        'SELECT COUNT(*) as count FROM pg_stat_activity WHERE state IS NOT NULL',
        1500
      );
      if (res && res.rows[0]) {
        this.set(parseInt(res.rows[0].count, 10));
      }
    } catch {
      // Leave unchanged on DB failure to avoid false reporting
    }
  },
});

// 7. devmonitor_db_queries_total (Counter)
export const devmonitorDbQueriesTotal = new client.Counter({
  name: 'devmonitor_db_queries_total',
  help: 'Total number of SQL queries executed through the application pool wrapper',
  registers: [register],
});

// 8. devmonitor_db_query_duration_seconds (Histogram, 1ms to 1s)
export const devmonitorDbQueryDurationSeconds = new client.Histogram({
  name: 'devmonitor_db_query_duration_seconds',
  help: 'Duration of SQL queries executed through the pool wrapper in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// 9. devmonitor_db_size_bytes (Gauge)
export const devmonitorDbSizeBytes = new client.Gauge({
  name: 'devmonitor_db_size_bytes',
  help: 'PostgreSQL database disk usage size in bytes',
  registers: [register],
  async collect() {
    try {
      if (!isDbConnected()) return;
      const res = await queryWithTimeout<{ size_bytes: string }>(
        'SELECT pg_database_size(current_database()) as size_bytes',
        1500
      );
      if (res && res.rows[0]) {
        this.set(Number(res.rows[0].size_bytes));
      }
    } catch {
      // Leave unchanged on DB failure
    }
  },
});

// 10. devmonitor_service_up (Gauge) - labels: service
export const devmonitorServiceUp = new client.Gauge({
  name: 'devmonitor_service_up',
  help: 'Reachability status of monitored services (1 = up/healthy/collecting/connected, 0 = down)',
  labelNames: ['service'] as const,
  registers: [register],
});

// 11. devmonitor_simulation_active (Gauge) - labels: mode (errors|slow|cpu|down)
export const devmonitorSimulationActive = new client.Gauge({
  name: 'devmonitor_simulation_active',
  help: 'Active state of DevMonitor failure simulator modes (1 = active, 0 = inactive)',
  labelNames: ['mode'] as const,
  registers: [register],
  collect() {
    this.set({ mode: 'errors' }, simulationService.isErrorMode() ? 1 : 0);
    this.set({ mode: 'slow' }, simulationService.isSlowMode() ? 1 : 0);
    this.set({ mode: 'cpu' }, simulationService.isCpuWorkerActive() ? 1 : 0);
    this.set({ mode: 'down' }, simulationService.isSimulatedDown() ? 1 : 0);
  },
});

(['errors', 'slow', 'cpu', 'down'] as const).forEach((m) => devmonitorSimulationActive.set({ mode: m }, 0));

// Helper for bounded timeout queries to ensure /metrics never hangs on slow/dead DB
async function queryWithTimeout<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  timeoutMs: number = 2000
): Promise<{ rows: T[] } | null> {
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error('DB query timed out')), timeoutMs)
  );

  return Promise.race([rawPool.query<T>(sql), timeoutPromise]);
}

async function probeDatabaseWithTimeout(timeoutMs: number = 2000): Promise<boolean> {
  try {
    const res = await queryWithTimeout('SELECT 1', timeoutMs);
    return res !== null;
  } catch {
    return false;
  }
}

// --- In-process snapshot for frontend JSON endpoints ---
interface RawErrorRecord {
  id: string;
  status: number;
  path: string;
  timestamp: number;
}

let totalRequests = 0;
let totalErrors = 0;
let totalDurationMs = 0;
const recentErrors: RawErrorRecord[] = [];
const MAX_RECENT_ERRORS = 50;

export function recordRequestMetrics(
  method: string,
  routePattern: string,
  statusCode: number,
  durationMs: number,
  path: string
): void {
  const durationSec = durationMs / 1000;
  const statusStr = String(statusCode);
  const normalizedMethod = method.toUpperCase();

  httpRequestsTotal.inc({ method: normalizedMethod, route: routePattern, status_code: statusStr });
  httpRequestDurationSeconds.observe(
    { method: normalizedMethod, route: routePattern, status_code: statusStr },
    durationSec
  );

  totalRequests += 1;
  totalDurationMs += durationMs;

  if (statusCode >= 500) {
    httpErrorsTotal.inc({ method: normalizedMethod, route: routePattern, status_code: statusStr });
    totalErrors += 1;

    recentErrors.unshift({
      id: `err-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: statusCode,
      path,
      timestamp: Date.now(),
    });

    if (recentErrors.length > MAX_RECENT_ERRORS) {
      recentErrors.pop();
    }
  }
}

export function getMetricsOverview(throughputLastWindow: number = 0): ApiMetricsOverview {
  const avgResponseTime = totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0;
  const errorRate = totalRequests > 0 ? Number(((totalErrors / totalRequests) * 100).toFixed(1)) : 0;

  return {
    requests: totalRequests,
    errors: totalErrors,
    errorRate,
    responseTime: avgResponseTime,
    throughput: throughputLastWindow,
  };
}

export function getRecentErrorsList(): SystemErrorItem[] {
  const now = Date.now();
  return recentErrors.map((err) => {
    const diffSec = Math.floor((now - err.timestamp) / 1000);
    const mins = Math.floor(diffSec / 60);
    const hours = Math.floor(diffSec / 3600);
    const timeAgo = hours >= 1 ? `${hours} hour${hours > 1 ? 's' : ''} ago` : mins >= 1 ? `${mins} min${mins > 1 ? 's' : ''} ago` : 'just now';
    return { id: err.id, status: err.status, path: err.path, timeAgo };
  });
}

export function getProcessSnapshot(): { requests: number; errors: number; avgResponseTime: number } {
  return {
    requests: totalRequests,
    errors: totalErrors,
    avgResponseTime: totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0,
  };
}
