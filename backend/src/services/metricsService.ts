import client from 'prom-client';
import type { SystemErrorItem, ApiMetricsOverview } from '../types/index.js';

export const register = new client.Registry();

// Collect Node.js process and memory default metrics
client.collectDefaultMetrics({ register });

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

// 3. http_request_duration_seconds (Histogram)
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

// In-process snapshot for JSON endpoints (so we don't parse Prometheus text)
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

  httpRequestsTotal.inc({ method, route: routePattern, status_code: statusStr });
  httpRequestDurationSeconds.observe({ method, route: routePattern, status_code: statusStr }, durationSec);

  totalRequests += 1;
  totalDurationMs += durationMs;

  if (statusCode >= 500) {
    httpErrorsTotal.inc({ method, route: routePattern, status_code: statusStr });
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
    let timeAgo = 'just now';
    if (diffSec >= 60 && diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      timeAgo = `${mins} min${mins > 1 ? 's' : ''} ago`;
    } else if (diffSec >= 3600) {
      const hours = Math.floor(diffSec / 3600);
      timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    return {
      id: err.id,
      status: err.status,
      path: err.path,
      timeAgo,
    };
  });
}

export function getProcessSnapshot(): { requests: number; errors: number; avgResponseTime: number } {
  return {
    requests: totalRequests,
    errors: totalErrors,
    avgResponseTime: totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0,
  };
}

// Reset stats for testing / restore
export function resetMetricsSnapshot(): void {
  // We keep Prometheus counters monotonically increasing per Prometheus standards,
  // but reset the error burst state if needed.
}
