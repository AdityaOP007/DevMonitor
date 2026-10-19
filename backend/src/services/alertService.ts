import { query, type QueryOptions } from '../db/pool.js';
import type { AlertItem, AlertConfig } from '../types/index.js';

interface RawIncidentRow {
  id: number;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  active: boolean;
  created_at: Date;
}

interface RawConfigRow {
  cpu_threshold: string | number;
  memory_threshold: string | number;
  error_rate_threshold: string | number;
  response_time_threshold: string | number;
  duration_minutes: number;
}

export async function getAlerts(): Promise<AlertItem[]> {
  const res = await query<RawIncidentRow>(
    'SELECT id, severity, title, message, active, created_at FROM incidents ORDER BY id DESC'
  );

  const now = Date.now();
  return res.rows.map((row) => {
    const diffSec = Math.floor((now - new Date(row.created_at).getTime()) / 1000);
    const mins = Math.floor(diffSec / 60);
    const hours = Math.floor(diffSec / 3600);
    const timestamp = hours >= 1 ? `${hours} hour${hours > 1 ? 's' : ''} ago` : mins >= 1 ? `${mins} min${mins > 1 ? 's' : ''} ago` : 'just now';

    return {
      id: String(row.id),
      severity: row.severity,
      title: row.title,
      message: row.message,
      timestamp,
      active: row.active,
    };
  });
}

export async function getAlertConfig(options?: QueryOptions): Promise<AlertConfig> {
  const res = await query<RawConfigRow>(
    'SELECT cpu_threshold, memory_threshold, error_rate_threshold, response_time_threshold, duration_minutes FROM alert_config WHERE id = 1',
    [],
    options
  );

  if (res.rows.length === 0) {
    return {
      cpuThreshold: 80,
      memoryThreshold: 85,
      errorRateThreshold: 5,
      responseTimeThreshold: 300,
      durationMinutes: 5,
    };
  }

  const row = res.rows[0];
  return {
    cpuThreshold: Number(row.cpu_threshold),
    memoryThreshold: Number(row.memory_threshold),
    errorRateThreshold: Number(row.error_rate_threshold),
    responseTimeThreshold: Number(row.response_time_threshold),
    durationMinutes: Number(row.duration_minutes),
  };
}

export async function saveAlertConfig(config: AlertConfig): Promise<AlertConfig> {
  if (
    typeof config.cpuThreshold !== 'number' ||
    config.cpuThreshold < 0 ||
    config.cpuThreshold > 100 ||
    typeof config.memoryThreshold !== 'number' ||
    config.memoryThreshold < 0 ||
    config.memoryThreshold > 100 ||
    typeof config.errorRateThreshold !== 'number' ||
    config.errorRateThreshold < 0 ||
    config.errorRateThreshold > 100 ||
    typeof config.responseTimeThreshold !== 'number' ||
    config.responseTimeThreshold <= 0 ||
    typeof config.durationMinutes !== 'number' ||
    config.durationMinutes < 1
  ) {
    throw new Error('Invalid alert configuration thresholds or duration.');
  }

  await query(
    `INSERT INTO alert_config (id, cpu_threshold, memory_threshold, error_rate_threshold, response_time_threshold, duration_minutes)
     VALUES (1, $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       cpu_threshold = EXCLUDED.cpu_threshold,
       memory_threshold = EXCLUDED.memory_threshold,
       error_rate_threshold = EXCLUDED.error_rate_threshold,
       response_time_threshold = EXCLUDED.response_time_threshold,
       duration_minutes = EXCLUDED.duration_minutes`,
    [
      config.cpuThreshold,
      config.memoryThreshold,
      config.errorRateThreshold,
      config.responseTimeThreshold,
      Math.round(config.durationMinutes),
    ]
  );

  return config;
}

export async function hasActiveCriticalAlert(): Promise<boolean> {
  try {
    const res = await query(
      "SELECT COUNT(*) as count FROM incidents WHERE active = true AND severity = 'critical'",
      [],
      { internal: true }
    );
    return parseInt(res.rows[0].count, 10) > 0;
  } catch {
    return false;
  }
}
