import { config } from '../config/env.js';
import { query } from '../db/pool.js';
import { sampleCpuUsage } from '../services/serverService.js';
import { getProcessSnapshot } from '../services/metricsService.js';
import { getAlertConfig } from '../services/alertService.js';
import os from 'node:os';

// NOTE: This in-process evaluator is a simple stand-in.
// In later phases, threshold alerting moves to Prometheus alert rules and Alertmanager.

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

    // Check if threshold has been exceeded continuously for configured duration
    if (counter.consecutiveSeconds >= targetDurationSeconds && counter.activeIncidentId === null) {
      try {
        const msg = createMessage();
        const res = await query<{ id: number }>(
          `INSERT INTO incidents (severity, title, message, active, created_at)
           VALUES ($1, $2, $3, true, NOW()) RETURNING id`,
          [severity, title, msg]
        );
        counter.activeIncidentId = res.rows[0].id;
        console.log(`[AlertEvaluator] Opened incident ${counter.activeIncidentId}: ${title}`);
      } catch (err) {
        console.error('[AlertEvaluator Error] Failed to open incident:', err);
      }
    }
  } else {
    // Condition resolved
    counter.consecutiveSeconds = 0;
    if (counter.activeIncidentId !== null) {
      try {
        await query(
          'UPDATE incidents SET active = false, resolved_at = NOW() WHERE id = $1',
          [counter.activeIncidentId]
        );
        console.log(`[AlertEvaluator] Resolved incident ${counter.activeIncidentId}: ${title}`);
      } catch (err) {
        console.error('[AlertEvaluator Error] Failed to resolve incident:', err);
      }
      counter.activeIncidentId = null;
    }
  }
}

export async function evaluateAlertRules(): Promise<void> {
  try {
    const alertCfg = await getAlertConfig();
    const targetDurationSec = Math.max(15, alertCfg.durationMinutes * 60);

    // 1. Evaluate CPU Usage
    const currentCpu = sampleCpuUsage();
    await checkAndManageIncident(
      'cpu',
      currentCpu >= alertCfg.cpuThreshold,
      targetDurationSec,
      'warning',
      'HIGH CPU USAGE',
      () => `HIGH CPU USAGE, CPU ${currentCpu}%, Duration ${alertCfg.durationMinutes} minutes`
    );

    // 2. Evaluate Error Rate
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

    // 3. Evaluate Response Time
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
