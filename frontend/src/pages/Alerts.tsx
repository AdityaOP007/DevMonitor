import React, { useState, useCallback } from 'react';
import { Bell, AlertTriangle, AlertCircle, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { getAlerts, getAlertConfig, saveAlertConfig } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { AlertItem, AlertConfig } from '../types';

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [config, setConfig] = useState<AlertConfig>({
    cpuThreshold: 80,
    memoryThreshold: 85,
    errorRateThreshold: 5,
    responseTimeThreshold: 300,
    durationMinutes: 5,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
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

  const handleConfigChange = (field: keyof AlertConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await saveAlertConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save alert configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading && alerts.length === 0) {
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Alert Configuration</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define the threshold conditions that cause Prometheus and Alertmanager to trigger a warning.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Alert rules updated successfully. Saved settings are sent to the backend, which turns them into alert rules.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="cpuThreshold" className="block text-xs font-semibold text-slate-700 mb-1.5">
                CPU Usage Threshold (%)
              </label>
              <input
                id="cpuThreshold"
                type="number"
                min="10"
                max="100"
                required
                value={config.cpuThreshold}
                onChange={(e) => handleConfigChange('cpuThreshold', Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Trigger warning when CPU exceeds this percentage.</span>
            </div>

            <div>
              <label htmlFor="memoryThreshold" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Memory Usage Threshold (%)
              </label>
              <input
                id="memoryThreshold"
                type="number"
                min="10"
                max="100"
                required
                value={config.memoryThreshold}
                onChange={(e) => handleConfigChange('memoryThreshold', Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Trigger warning when RAM exceeds this percentage.</span>
            </div>

            <div>
              <label htmlFor="errorRateThreshold" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Error Rate Threshold (%)
              </label>
              <input
                id="errorRateThreshold"
                type="number"
                min="1"
                max="100"
                required
                value={config.errorRateThreshold}
                onChange={(e) => handleConfigChange('errorRateThreshold', Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Trigger alert if failed requests exceed this percentage.</span>
            </div>

            <div>
              <label htmlFor="responseTimeThreshold" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Response Time Threshold (ms)
              </label>
              <input
                id="responseTimeThreshold"
                type="number"
                min="50"
                max="5000"
                step="10"
                required
                value={config.responseTimeThreshold}
                onChange={(e) => handleConfigChange('responseTimeThreshold', Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Trigger warning if mean response latency exceeds this.</span>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="durationMinutes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Condition Duration (minutes)
              </label>
              <input
                id="durationMinutes"
                type="number"
                min="1"
                max="60"
                required
                value={config.durationMinutes}
                onChange={(e) => handleConfigChange('durationMinutes', Number(e.target.value))}
                className="w-full max-w-xs px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                How long the violation must persist before an alert is dispatched.
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 italic">
              Note: Saved settings are sent to the backend, which turns them into alert rules.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Alert Rules'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
