import React, { useState, useCallback } from 'react';
import { Bell, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { getAlerts, getAlertConfig } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import { AlertConfigForm } from '../components/alerts/AlertConfigForm';
import type { AlertItem, AlertConfig } from '../types';

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setFetchError(null);
      const [alertList, alertCfg] = await Promise.all([getAlerts(), getAlertConfig()]);
      setAlerts(alertList);
      setConfig(alertCfg);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch alerts data');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadData, 15000);

  if (loading && alerts.length === 0 && !config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading alerts and configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Alerts & Rules</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review active warnings triggered by Prometheus and configure threshold rules.
        </p>
      </div>

      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Part A: Active and Recent Alerts */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">Active & Recent Alerts</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {alerts.filter((a) => a.active).length} active
          </span>
        </div>

        {alerts.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No active or recent alerts recorded. All system parameters are within thresholds.
          </p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                  alert.active
                    ? alert.severity === 'critical'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  {alert.severity === 'critical' ? (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase tracking-wider">
                        {alert.title}
                      </span>
                      {alert.active && (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium mt-1">{alert.message}</p>
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 shrink-0">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Part B: Alert Configuration Form */}
      {config && <AlertConfigForm initialConfig={config} />}
    </div>
  );
};
