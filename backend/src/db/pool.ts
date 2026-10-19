import pg from 'pg';
import { config } from '../config/env.js';
import {
  devmonitorDbQueriesTotal,
  devmonitorDbQueryDurationSeconds,
} from '../services/metricsService.js';

const { Pool } = pg;

export interface QueryOptions {
  internal?: boolean;
}

export const rawPool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: config.dbIdleTimeoutMs,
  connectionTimeoutMillis: config.dbConnectionTimeoutMs,
  statement_timeout: 10000,
});

let totalQueryCount = 0;
let totalQueryDurationMs = 0;
let isConnected = false;

rawPool.on('connect', () => {
  isConnected = true;
});

// Guard against idle client errors crashing the Node process
rawPool.on('error', (err) => {
  console.error('[DB Pool Idle Error]', err.message);
  isConnected = false;
});

/**
 * Executes a parameterized query. User-facing queries are tracked in metrics,
 * while internal queries (health checks, sampler, metrics collection) are not.
 */
export async function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
  options?: QueryOptions
): Promise<pg.QueryResult<R>> {
  const start = performance.now();
  try {
    const res = await rawPool.query<R>(text, params);
    const duration = performance.now() - start;
    isConnected = true;

    if (!options?.internal) {
      totalQueryCount += 1;
      totalQueryDurationMs += duration;
      devmonitorDbQueriesTotal.inc();
      devmonitorDbQueryDurationSeconds.observe(duration / 1000);
    }

    return res;
  } catch (error) {
    const duration = performance.now() - start;
    isConnected = false;

    if (!options?.internal) {
      totalQueryCount += 1;
      totalQueryDurationMs += duration;
      devmonitorDbQueriesTotal.inc();
      devmonitorDbQueryDurationSeconds.observe(duration / 1000);
    }

    throw error;
  }
}

/**
 * Execute multiple database operations within a managed transaction.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await rawPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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

/**
 * Background retry check to establish initial connection without blocking HTTP server boot.
 */
export function startBackgroundConnectionCheck(maxAttempts: number = 10, delayMs: number = 2000): void {
  let attempt = 0;

  const probe = async () => {
    attempt += 1;
    try {
      await rawPool.query('SELECT 1');
      isConnected = true;
      console.log(`[DB Pool] Connection check (attempt ${attempt}/${maxAttempts}) connected successfully.`);
    } catch (err: unknown) {
      isConnected = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[DB Pool] Connection check (attempt ${attempt}/${maxAttempts}) failed: ${msg}`);
      if (attempt < maxAttempts) {
        setTimeout(probe, delayMs);
      }
    }
  };

  probe();
}

export async function closePool(): Promise<void> {
  await rawPool.end();
}
