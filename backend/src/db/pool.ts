import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

export const rawPool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 2000,
  max: 10,
});

// Real query tracking wrapper
let totalQueryCount = 0;
let totalQueryDurationMs = 0;
let isConnected = false;

rawPool.on('connect', () => {
  isConnected = true;
});

rawPool.on('error', (err) => {
  console.error('[DB Pool Error]', err.message);
  isConnected = false;
});

/**
 * Execute a parameterized query while tracking metrics (count and average duration).
 */
export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<R>> {
  const start = performance.now();
  try {
    const res = await rawPool.query<R>(text, params);
    const duration = performance.now() - start;
    totalQueryCount += 1;
    totalQueryDurationMs += duration;
    isConnected = true;
    return res;
  } catch (error) {
    const duration = performance.now() - start;
    totalQueryCount += 1;
    totalQueryDurationMs += duration;
    isConnected = false;
    throw error;
  }
}

export function getTrackedQueryStats(): { queryCount: number; avgDurationMs: number } {
  return {
    queryCount: totalQueryCount,
    avgDurationMs: totalQueryCount > 0 ? Math.round(totalQueryDurationMs / totalQueryCount) : 0,
  };
}

export async function isDatabaseAlive(): Promise<boolean> {
  try {
    await rawPool.query('SELECT 1');
    isConnected = true;
    return true;
  } catch {
    isConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

export async function closePool(): Promise<void> {
  await rawPool.end();
}
