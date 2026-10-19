import React from 'react';
import { ArrowDown, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import type { SystemHealthStatus } from '../types';

interface FlowDiagramProps {
  systemStatus?: SystemHealthStatus;
}

export const FlowDiagram: React.FC<FlowDiagramProps> = ({ systemStatus = 'healthy' }) => {
  const steps = [
    {
      title: 'Application',
      badge: 'Generates',
      explanation: 'Your application generates information about requests, errors, response time and health.',
    },
    {
      title: 'Prometheus',
      badge: 'Collects',
      explanation: 'Prometheus regularly collects these metrics and stores them.',
    },
    {
      title: 'Grafana',
      badge: 'Visualizes',
      explanation: 'Grafana turns the collected metrics into graphs and dashboards.',
    },
    {
      title: 'You',
      badge: 'Actionable',
      explanation: 'You use the dashboard to identify problems and understand system performance.',
    },
  ];

  const getFlowStatus = () => {
    switch (systemStatus) {
      case 'healthy':
        return {
          text: 'Prometheus is collecting metrics',
          color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500 animate-pulse',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        };
      case 'degraded':
        return {
          text: 'Prometheus cannot reach Backend',
          color: 'bg-amber-50 text-amber-800 border-amber-300',
          dot: 'bg-amber-500 animate-pulse',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        };
      case 'down':
      default:
        return {
          text: 'Backend DOWN',
          color: 'bg-rose-50 text-rose-800 border-rose-300',
          dot: 'bg-rose-500',
          icon: <XCircle className="w-4 h-4 text-rose-600" />,
        };
    }
  };

  const currentFlow = getFlowStatus();

  return (
    <div className="space-y-8">
      {/* Live Data-Flow Indicator */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Live Data-Flow State</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time status of the scrape and visualization pipeline</p>
          </div>

          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${currentFlow.color}`}
            role="status"
          >
            <span className={`w-2 h-2 rounded-full ${currentFlow.dot}`} />
            {currentFlow.icon}
            <span>{currentFlow.text}</span>
          </div>
        </div>

        {/* Horizontal Pipeline Steps */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-3 text-xs font-medium text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="bg-white px-2.5 py-1 rounded border border-slate-200">Application</span>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="bg-white px-2.5 py-1 rounded border border-slate-200">
            Metrics <span className="text-[10px] text-slate-500">(every 15s)</span>
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="bg-white px-2.5 py-1 rounded border border-slate-200">Prometheus</span>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="bg-white px-2.5 py-1 rounded border border-slate-200">Grafana</span>
          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200 font-semibold">You</span>
        </div>
      </div>

      {/* Vertical Pipeline Diagram */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-6">Monitoring Pipeline Explained</h3>

        <div className="flex flex-col items-center max-w-xl mx-auto space-y-4">
          {steps.map((step, idx) => (
            <React.Fragment key={step.title}>
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 transition-colors hover:border-blue-300">
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="font-bold text-slate-900 text-sm">{step.title}</h4>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {step.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{step.explanation}</p>
              </div>

              {idx < steps.length - 1 && (
                <div className="flex items-center justify-center py-1">
                  <ArrowDown className="w-5 h-5 text-slate-400" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
