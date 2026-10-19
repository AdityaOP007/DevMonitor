export type SystemHealthStatus = 'healthy' | 'degraded' | 'down';

export type ServiceStatus = 'Healthy' | 'Collecting' | 'Connected' | 'Down';

export interface HealthResponse {
  status: SystemHealthStatus;
  service: string;
  uptime: number;
}

export interface ServerMetrics {
  cpu: number;
  memory: number;
  disk: number;
  uptime?: number;
}

export interface DashboardMetrics {
  requests: number;
  errors: number;
  responseTime: number;
  uptime: number;
}

export interface RequestMetricPoint {
  time: string;
  requests: number;
}

export interface CpuMetricPoint {
  time: string;
  cpu: number;
}

export interface ResponseTimeMetricPoint {
  time: string;
  responseTime: number;
}

export interface SystemErrorItem {
  id: string;
  status: number;
  path: string;
  timeAgo: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  status: ServiceStatus;
  role: string;
}

export interface DatabaseStats {
  connections: number;
  queries: number;
  queryDuration: number;
  databaseSize: string;
}

export interface AlertItem {
  id: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  active: boolean;
}

export interface AlertConfig {
  cpuThreshold: number;
  memoryThreshold: number;
  errorRateThreshold: number;
  responseTimeThreshold: number;
  durationMinutes: number;
}

export interface UrlCheckResult {
  url: string;
  status: 'UP' | 'DOWN';
  availability: number;
  responseTime: number;
  statusCode: number;
  ssl: 'Valid' | 'Invalid';
  uptime: string;
}

export interface ApiMetricsOverview {
  requests: number;
  errors: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
}

export interface TestActionResponse {
  success: boolean;
  message: string;
  sent?: number;
}
