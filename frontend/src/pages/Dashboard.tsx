import React, { useState, useCallback } from 'react';
import { ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { StatusCard } from '../components/StatusCard';
import { Chart } from '../components/Chart';
import {
  getDashboardMetrics,
  getServices,
  getRequestHistory,
  getRecentErrors,
} from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type {
  DashboardMetrics,
  ServiceItem,
  RequestMetricPoint,
  SystemErrorItem,
} from '../types';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [history, setHistory] = useState<RequestMetricPoint[]>([]);
  const [errors, setErrors] = useState<SystemErrorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setFetchError(null);
      const [m, s, h, e] = await Promise.all([
        getDashboardMetrics(),
        getServices(),
        getRequestHistory(),
        getRecentErrors(),
      ]);
      setMetrics(m);
      setServices(s);
      setHistory(h);
      setErrors(e);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadData, 15000);

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading dashboard metrics...</p>
      </div>
    );
  }

  if (fetchError && !metrics) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>Error loading dashboard</span>
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

  const errorRate =
    metrics && metrics.requests > 0
      ? Number(((metrics.errors / metrics.requests) * 100).toFixed(1))
      : 0;

  return (
    <div className="space-y-6">
      {/* Header & Teaching strip */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time health, request volume and response times of your application.
        </p>
      </div>

      {/* "How it works" Quick Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-700 font-medium">
          <span className="text-slate-500">How monitoring works:</span>
          <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            <strong>Your App</strong> <span className="text-slate-500">(Generates)</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            <strong>Prometheus</strong> <span className="text-slate-500">(Collects)</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            <strong>Grafana</strong> <span className="text-slate-500">(Visualizes)</span>
          </span>
        </div>

        <Link
          to="/how-it-works"
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 shrink-0"
        >
          <span>Learn how the pipeline works</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* System Status List */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Component Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((srv) => (
            <StatusCard key={srv.id} name={srv.name} status={srv.status} role={srv.role} />
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div id="metric-cards-container">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Headline Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Requests"
            value={metrics?.requests ?? 0}
            infoDescription="Total number of HTTP requests processed by your application since startup."
            infoExample="The app has answered 15,234 requests from users."
            status="normal"
            subtext="Collected every 15s"
          />

          <MetricCard
            label="Errors"
            value={metrics?.errors ?? 0}
            infoDescription="Percentage of requests that returned an error."
            infoExample="32 requests out of 15,234 returned a 5xx or 4xx status."
            status={errorRate > 5 ? 'danger' : errorRate > 2 ? 'warning' : 'healthy'}
            statusLabel={errorRate > 5 ? 'High Errors' : 'Normal'}
            subtext={`${errorRate}% error rate`}
          />

          <MetricCard
            label="Response Time"
            value={metrics?.responseTime ?? 0}
            unit="ms"
            infoDescription="How long your API takes to respond. Lower is generally better. Example: you ask for your profile and the backend answers in 142 ms."
            infoExample="Average time from request arrival to response completion."
            status={(metrics?.responseTime ?? 0) > 500 ? 'danger' : 'normal'}
            subtext="Average latency"
          />

          <MetricCard
            label="Uptime"
            value={metrics?.uptime ?? 0}
            unit="%"
            infoDescription="Percentage of time the application has been healthy and successfully serving requests."
            infoExample="99.9% uptime corresponds to less than 44 minutes of downtime per month."
            status={(metrics?.uptime ?? 0) < 95 ? 'danger' : 'healthy'}
            statusLabel={(metrics?.uptime ?? 0) >= 99 ? 'Excellent' : 'Degraded'}
            subtext="Last 30 days"
          />
        </div>
      </div>

      {/* Chart: Requests per minute */}
      <div className="space-y-4">
        <Chart
          title="Requests per minute"
          subtitle="Real-time traffic volume recorded at 2-minute scrape intervals"
          data={history}
          dataKey="requests"
          xAxisKey="time"
          unit="req/min"
          color="#2563eb"
          height={260}
        />
      </div>

      {/* Recent Errors List */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Errors</h3>
            <p className="text-xs text-slate-500 mt-0.5">Most recent failed HTTP requests logged by the server</p>
          </div>
          <Link
            to="/errors"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>View all errors</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {errors.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No recent errors logged. System is operating normally.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {errors.slice(0, 5).map((err) => (
              <div key={err.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                      err.status >= 500
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {err.status}
                  </span>
                  <span className="font-mono text-slate-800">{err.path}</span>
                </div>
                <span className="text-slate-400">{err.timeAgo}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
