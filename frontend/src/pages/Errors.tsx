import React, { useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { getRecentErrors } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { SystemErrorItem } from '../types';

export const Errors: React.FC = () => {
  const [errors, setErrors] = useState<SystemErrorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await getRecentErrors();
      setErrors(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch errors');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadData, 15000);

  if (loading && errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading recent errors...</p>
      </div>
    );
  }

  if (fetchError && errors.length === 0) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>Error loading errors log</span>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recent Errors</h1>
        <p className="text-sm text-slate-500 mt-1">
          Detailed log of HTTP failure responses captured by backend monitoring middleware.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Application Error Log</h2>
          </div>
          <span className="text-xs text-slate-500">{errors.length} events logged</span>
        </div>

        {errors.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <p>No recent errors detected.</p>
            <p className="text-xs text-slate-400 mt-1">
              You can trigger a test error on the Playground or Failure Simulator page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">HTTP Route</th>
                  <th className="px-5 py-3">Occurred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {errors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold text-[11px] border ${
                          err.status >= 500
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {err.status} {err.status >= 500 ? 'Server Error' : 'Client Error'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-800">{err.path}</td>
                    <td className="px-5 py-3 text-slate-500">{err.timeAgo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
