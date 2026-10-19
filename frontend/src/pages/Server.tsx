import React, { useState, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { Chart } from '../components/Chart';
import { getServerMetrics, getCpuHistory } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { ServerMetrics, CpuMetricPoint } from '../types';

export const Server: React.FC = () => {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<CpuMetricPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setFetchError(null);
      const [m, h] = await Promise.all([getServerMetrics(), getCpuHistory()]);
      setMetrics(m);
      setCpuHistory(h);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch server metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadData, 15000);

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading server metrics...</p>
      </div>
    );
  }

  if (fetchError && !metrics) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>Error loading server metrics</span>
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

  const formatUptime = (seconds: number = 0) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const cpuStatus = (metrics?.cpu ?? 0) > 85 ? 'danger' : (metrics?.cpu ?? 0) > 70 ? 'warning' : 'normal';
  const memStatus = (metrics?.memory ?? 0) > 85 ? 'danger' : (metrics?.memory ?? 0) > 75 ? 'warning' : 'normal';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Server Resources</h1>
        <p className="text-sm text-slate-500 mt-1">
          Machine hardware utilization reported by Node Exporter and host telemetry.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="CPU Usage"
          value={metrics?.cpu ?? 0}
          unit="%"
          infoDescription="Percentage of CPU currently being used."
          infoExample="A high percentage means the processor is heavily loaded with tasks or calculations."
          status={cpuStatus}
          statusLabel={cpuStatus === 'danger' ? 'High Load' : cpuStatus === 'warning' ? 'Elevated' : 'Normal'}
          subtext="Processor load"
        />

        <MetricCard
          label="Memory Usage"
          value={metrics?.memory ?? 0}
          unit="%"
          infoDescription="Percentage of available RAM currently being used."
          infoExample="If RAM fills up completely, the system may start swapping or crash."
          status={memStatus}
          statusLabel={memStatus === 'danger' ? 'Critical' : 'Normal'}
          subtext="RAM allocation"
        />

        <MetricCard
          label="Disk Usage"
          value={metrics?.disk ?? 0}
          unit="%"
          infoDescription="Percentage of disk storage currently being used."
          infoExample="Tracks capacity of the root file system volume."
          status="normal"
          subtext="Storage volume"
        />

        <MetricCard
          label="Uptime"
          value={metrics?.uptime ? formatUptime(metrics.uptime) : '0m'}
          infoDescription="Total duration the host server has been running without reboot."
          infoExample="Long uptime indicates persistent infrastructure stability."
          status="normal"
          subtext="Host system"
        />
      </div>

      <div className="space-y-4">
        <Chart
          title="CPU Usage over time"
          subtitle="Real-time processor load percentage recorded across scrape intervals"
          data={cpuHistory}
          dataKey="cpu"
          xAxisKey="time"
          unit="%"
          color="#2563eb"
          height={280}
        />
      </div>
    </div>
  );
};
