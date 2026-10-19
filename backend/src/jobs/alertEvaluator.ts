import { config } from '../config/env.js';
import { query } from '../db/pool.js';
import { sampleCpuUsage } from '../services/serverService.js';
import { getProcessSnapshot } from '../services/metricsService.js';
import { getAlertConfig } from '../services/alertService.js';

interface ViolationCounter {
  consecutiveSeconds: number;
  activeIncidentId: number | null;
}

const ruleCounters = {
  cpu: { consecutiveSeconds: 0, activeIncidentId: null } as ViolationCounter,
  errorRate: { consecutiveSeconds: 0, activeIncidentId: null } as ViolationCounter,
  responseTime: { consecutiveSeconds: 0, activeIncidentId: null } as ViolationCounter,
};

let evaluatorIntervalId: NodeJS.Timeout | null = null;

async function checkAndManageIncident(
  key: keyof typeof ruleCounters,
  isViolating: boolean,
  targetDurationSeconds: number,
  severity: 'warning' | 'critical',
  title: string,
  createMessage: () => string
): Promise<void> {
  const counter = ruleCounters[key];

  if (isViolating) {
    counter.consecutiveSeconds += config.sampleIntervalSeconds;

    if (counter.consecutiveSeconds >= targetDurationSeconds && counter.activeIncidentId === null) {
      try {
        const msg = createMessage();
        // Check if an active incident with this title is already present in DB
        const existing = await query<{ id: number }>(
          'SELECT id FROM incidents WHERE title = $1 AND active = true',
          [title],
          { internal: true }
        );

        if (existing.rows.length > 0) {
          counter.activeIncidentId = existing.rows[0].id;
        } else {
          const res = await query<{ id: number }>(
            `INSERT INTO incidents (severity, title, message, active, created_at)
             VALUES ($1, $2, $3, true, NOW()) RETURNING id`,
            [severity, title, msg],
            { internal: true }
          );
          counter.activeIncidentId = res.rows[0].id;
          console.log(`[AlertEvaluator] Opened incident ${counter.activeIncidentId}: ${title}`);
        }
      } catch (err) {
        console.error('[AlertEvaluator Error] Failed to open incident:', err);
      }
    }
  } else {
    counter.consecutiveSeconds = 0;
    try {
      await query(
        'UPDATE incidents SET active = false, resolved_at = NOW() WHERE title = $1 AND active = true',
        [title],
        { internal: true }
      );
      if (counter.activeIncidentId !== null) {
        console.log(`[AlertEvaluator] Resolved incident ${counter.activeIncidentId}: ${title}`);
        counter.activeIncidentId = null;
      }
    } catch (err) {
      console.error('[AlertEvaluator Error] Failed to resolve incident:', err);
    }
  }
}

export async function evaluateAlertRules(): Promise<void> {
  try {
    const alertCfg = await getAlertConfig({ internal: true });
    const targetDurationSec = Math.max(15, alertCfg.durationMinutes * 60);

    const currentCpu = sampleCpuUsage();
    await checkAndManageIncident(
      'cpu',
      currentCpu >= alertCfg.cpuThreshold,
      targetDurationSec,
      'warning',
      'HIGH CPU USAGE',
      () => `HIGH CPU USAGE, CPU ${currentCpu}%, Duration ${alertCfg.durationMinutes} minutes`
    );

    const snapshot = getProcessSnapshot();
    const currentErrorRate =
      snapshot.requests > 0 ? Number(((snapshot.errors / snapshot.requests) * 100).toFixed(1)) : 0;

    await checkAndManageIncident(
      'errorRate',
      currentErrorRate >= alertCfg.errorRateThreshold,
      targetDurationSec,
      'critical',
      'HIGH ERROR RATE',
      () =>
        `ALERT: Error rate has exceeded the configured threshold (${currentErrorRate}%). Prometheus detected the error rate. Recommended action: check backend application logs.`
    );

    await checkAndManageIncident(
      'responseTime',
      snapshot.avgResponseTime >= alertCfg.responseTimeThreshold,
      targetDurationSec,
      'warning',
      'HIGH RESPONSE TIME',
      () =>
        `HIGH RESPONSE TIME, average latency ${snapshot.avgResponseTime}ms exceeded ${alertCfg.responseTimeThreshold}ms threshold.`
    );
  } catch (err) {
    // Silent fail if DB is temporarily offline
  }
}

export function startAlertEvaluatorJob(): void {
  evaluatorIntervalId = setInterval(() => {
    evaluateAlertRules();
  }, config.sampleIntervalSeconds * 1000);
}

export function stopAlertEvaluatorJob(): void {
  if (evaluatorIntervalId) {
    clearInterval(evaluatorIntervalId);
    evaluatorIntervalId = null;
  }
}
