import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port: number;
  databaseUrl: string;
  corsOrigin: string;
  enableTestEndpoints: boolean;
  sampleIntervalSeconds: number;
  healthCheckIntervalSeconds: number;
  testMaxRequests: number;
  dbPoolMax: number;
  dbIdleTimeoutMs: number;
  dbConnectionTimeoutMs: number;
  backendHealthUrl: string;
  frontendUrl: string;
  prometheusUrl: string;
  grafanaUrl: string;
}

function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('FATAL: DATABASE_URL environment variable is required but missing.');
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const enableTestEndpoints = process.env.ENABLE_TEST_ENDPOINTS !== 'false';
  const sampleIntervalSeconds = parseInt(process.env.SAMPLE_INTERVAL_SECONDS || '15', 10);
  const healthCheckIntervalSeconds = parseInt(process.env.HEALTH_CHECK_INTERVAL_SECONDS || '30', 10);
  const testMaxRequests = parseInt(process.env.TEST_MAX_REQUESTS || '1000', 10);

  const dbPoolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
  const dbIdleTimeoutMs = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10);
  const dbConnectionTimeoutMs = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10);

  const backendHealthUrl = process.env.BACKEND_HEALTH_URL || `http://localhost:${port}/api/health`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090/-/healthy';
  const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3000/api/health';

  return {
    port,
    databaseUrl,
    corsOrigin,
    enableTestEndpoints,
    sampleIntervalSeconds,
    healthCheckIntervalSeconds,
    testMaxRequests,
    dbPoolMax,
    dbIdleTimeoutMs,
    dbConnectionTimeoutMs,
    backendHealthUrl,
    frontendUrl,
    prometheusUrl,
    grafanaUrl,
  };
}

export const config = loadConfig();
