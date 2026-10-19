import React, { useState, useCallback } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  Zap,
  Cpu,
  Clock,
  StopCircle,
} from 'lucide-react';
import { AlertBanner } from '../components/AlertBanner';
import { MetricCard } from '../components/MetricCard';
import {
  simulateErrors,
  simulateLoad,
  simulateCpu,
  simulateSlow,
  simulateStop,
  simulateRestore,
  getDashboardMetrics,
  getServerMetrics,
  getHealth,
  getApiMetricsOverview,
} from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { DashboardMetrics, ServerMetrics, SystemHealthStatus, ApiMetricsOverview } from '../types';

export const Simulator: React.FC = () => {
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics | null>(null);
  const [apiMetrics, setApiMetrics] = useState<ApiMetricsOverview | null>(null);
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus>('healthy');

  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);
  const [alertBannerInfo, setAlertBannerInfo] = useState<{
    title: string;
    message: string;
    action?: string;
    severity?: 'critical' | 'warning';
  } | null>(null);

  const refreshState = useCallback(async () => {
    try {
      const [d, s, a, h] = await Promise.all([
        getDashboardMetrics(),
        getServerMetrics(),
        getApiMetricsOverview(),
        getHealth(),
      ]);
      setDashboardMetrics(d);
      setServerMetrics(s);
      setApiMetrics(a);
      setHealthStatus(h.status);
    } catch {
      // Ignore
    }
  }, []);

  usePolling(refreshState, 15000);

  const handleGenerateErrors = async () => {
    await simulateErrors();
    setActiveSimulation('errors');
    setAlertBannerInfo({
      title: 'ALERT',
      message: 'Error rate has exceeded the configured threshold. Prometheus detected the error rate.',
      action: 'check backend application logs.',
      severity: 'critical',
    });
    await refreshState();
  };

  const handleSimulateHighTraffic = async () => {
    await simulateLoad(1500);
    setActiveSimulation('traffic');
    setAlertBannerInfo({
      title: 'TRAFFIC SURGE',
      message: 'High request traffic spike detected across inbound endpoints.',
      action: 'scale web service replicas or inspect upstream CDN cache.',
      severity: 'warning',
    });
    await refreshState();
  };

  const handleSimulateCpu = async () => {
    await simulateCpu();
    setActiveSimulation('cpu');
    setAlertBannerInfo({
      title: 'HIGH CPU USAGE',
      message: 'CPU usage reached 91% for production server.',
      action: 'inspect process thread pools and high memory operations.',
      severity: 'critical',
    });
    await refreshState();
  };

  const handleSimulateSlow = async () => {
    await simulateSlow();
    setActiveSimulation('slow');
    setAlertBannerInfo({
      title: 'API DEGRADATION',
      message: 'Response times spiked to 860ms across critical routes.',
      action: 'verify database connection locks and network response times.',
      severity: 'warning',
    });
    await refreshState();
  };

  const handleStopBackend = async () => {
    await simulateStop();
    setActiveSimulation('stop');
    setAlertBannerInfo({
      title: 'CRITICAL FAILURE',
      message: 'Backend service stopped or unreachable. Scrape targets failing.',
      action: 'restart container with docker-compose up -d backend.',
      severity: 'critical',
    });
    await refreshState();
  };

  const handleRestore = async () => {
    await simulateRestore();
    setActiveSimulation(null);
    setAlertBannerInfo(null);
    await refreshState();
  };

  const currentErrorRate = apiMetrics?.errorRate ?? 0;
  const isErrorCritical = currentErrorRate > 5 || activeSimulation === 'errors';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Failure Simulator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Make the system misbehave on purpose to observe how Prometheus and DevMonitor detect anomalies.
        </p>
      </div>

      {/* Active Alert Banner */}
      {alertBannerInfo && (
        <AlertBanner
          title={alertBannerInfo.title}
          message={alertBannerInfo.message}
          recommendedAction={alertBannerInfo.action}
          severity={alertBannerInfo.severity}
          onDismiss={() => setAlertBannerInfo(null)}
        />
      )}

      {/* Live Impact Preview */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Current State Preview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Error Rate"
            value={currentErrorRate}
            unit="%"
            infoDescription="Percentage of requests that returned an error."
            infoExample="When errors spike, Prometheus alerts fire immediately."
            status={isErrorCritical ? 'danger' : 'healthy'}
            statusLabel={isErrorCritical ? 'Critical (12.7%)' : 'Normal (0.2%)'}
            subtext={isErrorCritical ? 'Threshold exceeded (>5%)' : 'Healthy condition'}
          />

          <MetricCard
            label="CPU Usage"
            value={serverMetrics?.cpu ?? 0}
            unit="%"
            infoDescription="Percentage of CPU currently being used."
            infoExample="Under load testing or infinite loops, CPU reaches near 100%."
            status={(serverMetrics?.cpu ?? 0) > 80 ? 'danger' : 'normal'}
            statusLabel={(serverMetrics?.cpu ?? 0) > 80 ? '91% High' : '42% Normal'}
            subtext="Node Exporter reading"
          />

          <MetricCard
            label="Response Time"
            value={dashboardMetrics?.responseTime ?? 0}
            unit="ms"
            infoDescription="How long your API takes to respond. Lower is generally better."
            status={(dashboardMetrics?.responseTime ?? 0) > 500 ? 'danger' : 'normal'}
            statusLabel={(dashboardMetrics?.responseTime ?? 0) > 500 ? '860ms Slow' : '142ms Normal'}
            subtext="Roundtrip latency"
          />

          <MetricCard
            label="Backend Status"
            value={healthStatus === 'down' ? 'DOWN' : healthStatus === 'degraded' ? 'DEGRADED' : 'HEALTHY'}
            infoDescription="Availability status of the primary backend API service."
            status={healthStatus === 'down' ? 'danger' : healthStatus === 'degraded' ? 'warning' : 'healthy'}
            statusLabel={healthStatus === 'down' ? 'Offline' : 'Online'}
            subtext="Container status"
          />
        </div>
      </div>

      {/* Simulator Control Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Trigger System Behaviors</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any scenario below. Notice how the metrics and dashboard respond in real time.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRestore}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore System</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Button 1: Generate API Errors */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 className="font-semibold text-sm text-slate-900">API Error Spike</h3>
              </div>
              <p className="text-xs text-slate-500">
                Backend deliberately returns HTTP 500 status codes. Error rate jumps above 5%, turning the card red.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateErrors}
              className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              Generate API Errors
            </button>
          </div>

          {/* Button 2: Simulate High Traffic */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm text-slate-900">High Inbound Traffic</h3>
              </div>
              <p className="text-xs text-slate-500">
                Spikes incoming request volume with 1,500 requests, producing a clear peak on the traffic chart.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSimulateHighTraffic}
              className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              Simulate High Traffic
            </button>
          </div>

          {/* Button 3: Simulate High CPU */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-sm text-slate-900">Heavy CPU Load</h3>
              </div>
              <p className="text-xs text-slate-500">
                Simulates heavy computing tasks, driving CPU to 91% and triggering the "HIGH CPU USAGE" alert.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSimulateCpu}
              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              Simulate High CPU
            </button>
          </div>

          {/* Button 4: Simulate Slow API */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-sm text-slate-900">Slow API Latency</h3>
              </div>
              <p className="text-xs text-slate-500">
                Adds 860ms artificial latency to endpoints to demonstrate how slow responses affect user metrics.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSimulateSlow}
              className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Simulate Slow API
            </button>
          </div>

          {/* Button 5: Stop Backend */}
          <div className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StopCircle className="w-4 h-4 text-slate-700" />
                <h3 className="font-semibold text-sm text-slate-900">Stop Backend Service</h3>
              </div>
              <p className="text-xs text-slate-500">
                Simulates container crash. Prometheus cannot scrape targets and reports "Backend DOWN".
              </p>
            </div>
            <button
              type="button"
              onClick={handleStopBackend}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Stop Backend
            </button>
          </div>

          {/* Button 6: Restore System */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RotateCcw className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-sm text-slate-900">Restore Everything</h3>
              </div>
              <p className="text-xs text-slate-500">
                Clears all simulated error conditions, clears active alerts, and restores healthy state.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRestore}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-sm"
            >
              Restore System
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
