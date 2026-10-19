import React, { useState, useCallback } from 'react';
import { AlertBanner } from '../components/AlertBanner';
import { MetricCard } from '../components/MetricCard';
import { SimulatorActionGrid } from '../components/simulator/SimulatorActionGrid';
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

      {/* Simulator Control Actions */}
      <SimulatorActionGrid
        onGenerateErrors={handleGenerateErrors}
        onSimulateHighTraffic={handleSimulateHighTraffic}
        onSimulateCpu={handleSimulateCpu}
        onSimulateSlow={handleSimulateSlow}
        onStopBackend={handleStopBackend}
        onRestore={handleRestore}
      />
    </div>
  );
};
