import React, { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { saveAlertConfig } from '../../services/api';
import type { AlertConfig } from '../../types';

interface AlertConfigFormProps {
  initialConfig: AlertConfig;
}

export const AlertConfigForm: React.FC<AlertConfigFormProps> = ({ initialConfig }) => {
  const [config, setConfig] = useState<AlertConfig>(initialConfig);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

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

  return (
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
  );
};
