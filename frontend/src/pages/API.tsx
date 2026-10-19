import React, { useState, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { Chart } from '../components/Chart';
import { getApiMetricsOverview, getResponseTimeHistory } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { ApiMetricsOverview, ResponseTimeMetricPoint } from '../types';

export const API: React.FC = () => {
  const [metrics, setMetrics] = useState<ApiMetricsOverview | null>(null);
  const [history, setHistory] = useState<ResponseTimeMetricPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setFetchError(null);
      const [m, h] = await Promise.all([getApiMetricsOverview(), getResponseTimeHistory()]);
      setMetrics(m);
      setHistory(h);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch API metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadData, 15000);

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading API metrics...</p>
      </div>
    );
  }

  if (fetchError && !metrics) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>Error loading API metrics</span>
        </div>
        <p className="text-sm text-rose-700">{fetchError}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const isErrorRateHigh = (metrics?.errorRate ?? 0) > 5;
  const isLatencyHigh = (metrics?.responseTime ?? 0) > 400;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">API Metrics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Application traffic counters, error ratios, and server response times collected by prom-client.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Requests"
          value={metrics?.requests ?? 0}
          infoDescription="Total number of HTTP requests processed by your application."
          infoExample="Every incoming request increases this counter."
          status="normal"
          subtext="Total inbound calls"
        />

        <MetricCard
          label="Errors"
          value={metrics?.errors ?? 0}
          infoDescription="Total number of failed HTTP requests (5xx or 4xx status)."
          infoExample="Failures recorded when endpoints throw an unhandled exception."
          status={isErrorRateHigh ? 'danger' : 'normal'}
          subtext="Failed requests"
        />

        <MetricCard
          label="Error Rate"
          value={metrics?.errorRate ?? 0}
          unit="%"
          infoDescription="Percentage of requests that returned an error."
          infoExample="Calculated as (errors / requests) * 100."
          status={isErrorRateHigh ? 'danger' : (metrics?.errorRate ?? 0) > 1 ? 'warning' : 'healthy'}
          statusLabel={isErrorRateHigh ? 'Critical' : 'Normal'}
          subtext="Target: < 1%"
        />

        <MetricCard
          label="Response Time"
          value={metrics?.responseTime ?? 0}
          unit="ms"
          infoDescription="How long your API takes to respond. Lower is generally better. Example: you ask for your profile and the backend answers in 142 ms."
          infoExample="Average latency measured across all active routes."
          status={isLatencyHigh ? 'danger' : 'normal'}
          statusLabel={isLatencyHigh ? 'High Latency' : undefined}
          subtext="Mean latency"
        />

        <MetricCard
          label="Throughput"
          value={metrics?.throughput ?? 0}
          unit="req/s"
          infoDescription="Number of requests handled per second."
          infoExample="Indicates active request throughput over the last minute."
          status="normal"
          subtext="Current rate"
        />
      </div>

      <div className="space-y-4">
        <Chart
          title="Response Time over time"
          subtitle="Average API latency (milliseconds) recorded across scrape intervals"
          data={history}
          dataKey="responseTime"
          xAxisKey="time"
          unit="ms"
          color="#2563eb"
          height={280}
        />
      </div>
    </div>
  );
};
