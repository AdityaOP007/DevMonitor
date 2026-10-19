import { query, getTrackedQueryStats } from '../db/pool.js';
import type { DatabaseStats } from '../types/index.js';

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const tracked = getTrackedQueryStats();

  let connections = 0;
  let databaseSize = '0 MB';

  try {
    // 1. Get real active connections count from pg_stat_activity
    const connRes = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM pg_stat_activity WHERE state IS NOT NULL'
    );
    connections = parseInt(connRes.rows[0]?.count || '1', 10);

    // 2. Get real database size on disk via PostgreSQL pg_size_pretty
    const sizeRes = await query<{ size: string }>(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
    );
    databaseSize = sizeRes.rows[0]?.size || '1.2 MB';
  } catch (err) {
    console.warn('[DatabaseService Warning] Falling back on database stats:', (err as Error).message);
    connections = 0;
    databaseSize = '0 MB';
  }

  return {
    connections,
    queries: tracked.queryCount,
    queryDuration: tracked.avgDurationMs,
    databaseSize,
  };
}
