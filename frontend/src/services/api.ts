import type {
  AlertConfig,
  AlertItem,
  AlertReceiverResult,
  ApiMetricsOverview,
  CpuMetricPoint,
  DatabaseStats,
  DashboardMetrics,
  HealthResponse,
  RequestMetricPoint,
  ResponseTimeMetricPoint,
  ServerMetrics,
  ServiceItem,
  SystemErrorItem,
  UrlCheckResult,
} from '../types';
import { mockDataService } from './mock';
import { normalizeReceiverPayload, summarize } from '../utils/alertReceiver';

export const isMockMode = (): boolean => {
  const envVal = import.meta.env.VITE_USE_MOCK;
  if (envVal === undefined || envVal === null || envVal === '') {
    return true; // default true as per brief
  }
  return envVal === 'true' || envVal === true;
};

// --- Real Endpoints Provided by Backend ---

export async function getHealth(): Promise<HealthResponse> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getHealth());
  }
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function getServerMetrics(): Promise<ServerMetrics> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getServer());
  }
  const res = await fetch('/api/server');
  if (!res.ok) throw new Error(`Failed to fetch server metrics: ${res.statusText}`);
  return res.json();
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getDashboard());
  }
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error(`Failed to fetch dashboard metrics: ${res.statusText}`);
  return res.json();
}

// --- Extended Endpoints Backed by Mock with Backend TODOs ---

// TODO(backend): GET /api/metrics/requests-series -> Array<{ time: string, requests: number }>
export async function getRequestHistory(): Promise<RequestMetricPoint[]> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getRequestHistory());
  }
  const res = await fetch('/api/metrics/requests-series');
  if (!res.ok) throw new Error('Failed to fetch requests history');
  return res.json();
}

// TODO(backend): GET /api/metrics/cpu-series -> Array<{ time: string, cpu: number }>
export async function getCpuHistory(): Promise<CpuMetricPoint[]> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getCpuHistory());
  }
  const res = await fetch('/api/metrics/cpu-series');
  if (!res.ok) throw new Error('Failed to fetch CPU history');
  return res.json();
}

// TODO(backend): GET /api/metrics/response-time-series -> Array<{ time: string, responseTime: number }>
export async function getResponseTimeHistory(): Promise<ResponseTimeMetricPoint[]> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getResponseTimeHistory());
  }
  const res = await fetch('/api/metrics/response-time-series');
  if (!res.ok) throw new Error('Failed to fetch response time history');
  return res.json();
}

// TODO(backend): GET /api/errors/recent -> Array<SystemErrorItem>
export async function getRecentErrors(): Promise<SystemErrorItem[]> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getRecentErrors());
  }
  const res = await fetch('/api/errors/recent');
  if (!res.ok) throw new Error('Failed to fetch recent errors');
  return res.json();
}

// TODO(backend): GET /api/services -> Array<ServiceItem>
export async function getServices(): Promise<ServiceItem[]> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getServices());
  }
  const res = await fetch('/api/services');
  if (!res.ok) throw new Error('Failed to fetch services status');
  return res.json();
}

// TODO(backend): GET /api/database/stats -> DatabaseStats
export async function getDatabaseStats(): Promise<DatabaseStats> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getDatabaseStats());
  }
  const res = await fetch('/api/database/stats');
  if (!res.ok) throw new Error('Failed to fetch database stats');
  return res.json();
}

// TODO(backend): GET /api/alerts -> Array<AlertItem>
export async function getAlerts(): Promise<AlertItem[]> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getAlerts());
  }
  const res = await fetch('/api/alerts');
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

// TODO(backend): GET /api/alerts/config -> AlertConfig
export async function getAlertConfig(): Promise<AlertConfig> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getAlertConfig());
  }
  const res = await fetch('/api/alerts/config');
  if (!res.ok) throw new Error('Failed to fetch alert configuration');
  return res.json();
}

// TODO(backend): POST /api/alerts/config -> AlertConfig
export async function saveAlertConfig(config: AlertConfig): Promise<AlertConfig> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.saveAlertConfig(config));
  }
  const res = await fetch('/api/alerts/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save alert configuration');
  return res.json();
}

// TODO(backend): GET /api/metrics/overview -> ApiMetricsOverview
export async function getApiMetricsOverview(): Promise<ApiMetricsOverview> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getApiMetricsOverview());
  }
  const res = await fetch('/api/metrics/overview');
  if (!res.ok) throw new Error('Failed to fetch API metrics overview');
  return res.json();
}

// TODO(backend): POST /api/monitor/check-url { url } -> UrlCheckResult
export async function checkUrl(url: string): Promise<UrlCheckResult> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.checkUrl(url));
  }
  const res = await fetch('/api/monitor/check-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error('Failed to check URL');
  return res.json();
}

// --- Test Actions for Playground and Simulator ---

export async function simulateLoad(count: number): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) {
    mockDataService.simulateLoad(count);
    return Promise.resolve({ success: true, message: `Generated ${count} test requests` });
  }
  const res = await fetch('/api/test/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });
  if (!res.ok) throw new Error('Failed to trigger test load');
  return res.json();
}

export async function simulateErrors(): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) {
    mockDataService.simulateErrors();
    return Promise.resolve({ success: true, message: 'Simulated high error rate' });
  }
  const res = await fetch('/api/test/errors', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger test errors');
  return res.json();
}

export async function simulateSlow(): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) {
    mockDataService.simulateSlow();
    return Promise.resolve({ success: true, message: 'Simulated slow API latency' });
  }
  const res = await fetch('/api/test/slow', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger slow API');
  return res.json();
}

export async function simulateCpu(): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) {
    mockDataService.simulateCpu();
    return Promise.resolve({ success: true, message: 'Simulated high CPU workload' });
  }
  const res = await fetch('/api/test/cpu', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger high CPU');
  return res.json();
}

export async function simulateStop(): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) {
    mockDataService.simulateStop();
    return Promise.resolve({ success: true, message: 'Backend service stopped' });
  }
  const res = await fetch('/api/test/stop', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to stop backend');
  return res.json();
}

export async function simulateRestore(): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) {
    mockDataService.restoreSystem();
    return Promise.resolve({ success: true, message: 'System restored to normal' });
  }
  const res = await fetch('/api/test/restore', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to restore system');
  return res.json();
}

export async function getAlertReceiverAlerts(): Promise<AlertReceiverResult> {
  if (isMockMode()) {
    return Promise.resolve(mockDataService.getAlertReceiverAlerts());
  }

  const defaultUnreachable: AlertReceiverResult = {
    reachable: false,
    alerts: [],
    summary: {
      firingNow: 0,
      resolved: 0,
      total: 0,
    },
    checkedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('/receiver/alerts', {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return defaultUnreachable;
    }

    const json: unknown = await res.json();
    const alerts = normalizeReceiverPayload(json);
    const summary = summarize(alerts);

    return {
      reachable: true,
      alerts,
      summary,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return defaultUnreachable;
  }
}

