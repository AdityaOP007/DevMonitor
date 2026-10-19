import React from 'react';
import { AlertTriangle, Zap, Cpu, Clock, StopCircle, RotateCcw } from 'lucide-react';

interface SimulatorActionGridProps {
  onGenerateErrors: () => void;
  onSimulateHighTraffic: () => void;
  onSimulateCpu: () => void;
  onSimulateSlow: () => void;
  onStopBackend: () => void;
  onRestore: () => void;
}

export const SimulatorActionGrid: React.FC<SimulatorActionGridProps> = ({
  onGenerateErrors,
  onSimulateHighTraffic,
  onSimulateCpu,
  onSimulateSlow,
  onStopBackend,
  onRestore,
}) => {
  return (
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
          onClick={onRestore}
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
            onClick={onGenerateErrors}
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
            onClick={onSimulateHighTraffic}
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
            onClick={onSimulateCpu}
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
            onClick={onSimulateSlow}
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
            onClick={onStopBackend}
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
            onClick={onRestore}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-sm"
          >
            Restore System
          </button>
        </div>
      </div>
    </div>
  );
};
