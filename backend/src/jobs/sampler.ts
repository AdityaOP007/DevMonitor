import { config } from '../config/env.js';
import { sampleCpuUsage } from '../services/serverService.js';
import { getProcessSnapshot } from '../services/metricsService.js';
import type { RequestMetricPoint, CpuMetricPoint, ResponseTimeMetricPoint } from '../types/index.js';

// NOTE: These in-memory series ring buffers are stand-in implementations.
// In later phases, these time series will be queried directly from Prometheus via PromQL.

const MAX_POINTS = 60;

const requestSeries: RequestMetricPoint[] = [];
const cpuSeries: CpuMetricPoint[] = [];
const responseTimeSeries: ResponseTimeMetricPoint[] = [];

let lastTotalRequests = 0;
let currentThroughput = 0;
let samplerIntervalId: NodeJS.Timeout | null = null;

function formatTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

export function sampleMetricsPoint(): void {
  const now = new Date();
  const timeStr = formatTimeString(now);

  const snapshot = getProcessSnapshot();
  const cpu = sampleCpuUsage();

  // Compute throughput (req/s) over this sample window
  const deltaRequests = Math.max(0, snapshot.requests - lastTotalRequests);
  currentThroughput = Math.round(deltaRequests / Math.max(1, config.sampleIntervalSeconds));
  lastTotalRequests = snapshot.requests;

  // Push to series buffers
  requestSeries.push({ time: timeStr, requests: snapshot.requests });
  if (requestSeries.length > MAX_POINTS) requestSeries.shift();

  cpuSeries.push({ time: timeStr, cpu });
  if (cpuSeries.length > MAX_POINTS) cpuSeries.shift();

  responseTimeSeries.push({ time: timeStr, responseTime: snapshot.avgResponseTime });
  if (responseTimeSeries.length > MAX_POINTS) responseTimeSeries.shift();
}

export function startSamplerJob(): void {
  // Capture initial baseline point immediately
  sampleMetricsPoint();

  samplerIntervalId = setInterval(() => {
    sampleMetricsPoint();
  }, config.sampleIntervalSeconds * 1000);
}

export function stopSamplerJob(): void {
  if (samplerIntervalId) {
    clearInterval(samplerIntervalId);
    samplerIntervalId = null;
  }
}

export function getRequestSeries(): RequestMetricPoint[] {
  return [...requestSeries];
}

export function getCpuSeries(): CpuMetricPoint[] {
  return [...cpuSeries];
}

export function getResponseTimeSeries(): ResponseTimeMetricPoint[] {
  return [...responseTimeSeries];
}

export function getCurrentThroughput(): number {
  return currentThroughput;
}
