import React, { useState, useCallback } from 'react';
import { PlayCircle, Send, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Chart } from '../components/Chart';
import { simulateLoad, simulateErrors, getRequestHistory } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { RequestMetricPoint } from '../types';

export const Playground: React.FC = () => {
  const [customCount, setCustomCount] = useState<number>(50);
  const [history, setHistory] = useState<RequestMetricPoint[]>([]);
  const [lastActionExplanation, setLastActionExplanation] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await getRequestHistory();
      setHistory(data);
    } catch {
      // Ignore
    }
  }, []);

  usePolling(fetchHistory, 15000);

  const handleSendLoad = async (count: number) => {
    setLoadingAction(true);
    try {
      await simulateLoad(count);
      await fetchHistory();
      setLastActionExplanation(
        `Your application received ${count} requests. Prometheus collected the resulting metrics, and the dashboard updated automatically.`
      );
    } catch {
      setLastActionExplanation('Failed to execute test traffic generator.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTestError = async () => {
    setLoadingAction(true);
    try {
      await simulateErrors();
      await fetchHistory();
      setLastActionExplanation(
        'A test error was simulated. Prometheus noted the failure in http_errors_total and the error counter rose.'
      );
    } catch {
      setLastActionExplanation('Failed to create test error.');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Traffic Playground</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate some traffic to see monitoring in action.
        </p>
      </div>

      {/* Action Controls Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Generate Test Requests</h2>
          <p className="text-xs text-slate-500">
            Click a preset or enter a custom number of requests to simulate inbound traffic to your backend API.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loadingAction}
            onClick={() => handleSendLoad(10)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>Send 10 Requests</span>
          </button>

          <button
            type="button"
            disabled={loadingAction}
            onClick={() => handleSendLoad(100)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>Send 100 Requests</span>
          </button>

          <button
            type="button"
            disabled={loadingAction}
            onClick={handleTestError}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg border border-amber-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Create Test Error</span>
          </button>
        </div>

        {/* Custom traffic generator */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="w-full sm:w-64">
            <label htmlFor="custom-count" className="block text-xs font-semibold text-slate-700 mb-1">
              Custom Request Count
            </label>
            <input
              id="custom-count"
              type="number"
              min="1"
              max="5000"
              value={customCount}
              onChange={(e) => setCustomCount(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="button"
            disabled={loadingAction}
            onClick={() => handleSendLoad(customCount)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 shadow-sm"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Generate Traffic ({customCount} requests)</span>
          </button>
        </div>
      </div>

      {/* "What just happened?" Card */}
      {lastActionExplanation && (
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-blue-900">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="font-semibold text-sm">What just happened?</h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">{lastActionExplanation}</p>
        </div>
      )}

      {/* Prometheus delay reminder */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-2.5 text-xs text-slate-600">
        <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong>Scrape interval note:</strong> Prometheus collects metrics on an automated 15-second cycle.
          In a live environment, updates appear on dashboards after the next scrape occurs.
        </p>
      </div>

      {/* Visible Response Chart */}
      <div className="space-y-4">
        <Chart
          title="Recent Inbound Traffic Trend"
          subtitle="Requests per minute updated by test generator"
          data={history}
          dataKey="requests"
          xAxisKey="time"
          unit="req/min"
          color="#2563eb"
          height={260}
        />
      </div>
    </div>
  );
};
