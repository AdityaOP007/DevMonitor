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

  return {
    port,
    databaseUrl,
    corsOrigin,
    enableTestEndpoints,
    sampleIntervalSeconds,
    healthCheckIntervalSeconds,
    testMaxRequests,
  };
}

export const config = loadConfig();
