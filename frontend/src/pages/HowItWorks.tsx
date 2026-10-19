import React, { useState, useCallback } from 'react';
import { FlowDiagram } from '../components/FlowDiagram';
import { getHealth } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { SystemHealthStatus } from '../types';
import { Layers, Check, Search, ShieldCheck } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemHealthStatus>('healthy');

  const checkStatus = useCallback(async () => {
    try {
      const res = await getHealth();
      setSystemStatus(res.status);
    } catch {
      setSystemStatus('down');
    }
  }, []);

  usePolling(checkStatus, 15000);

  const containerBoxes = [
    {
      name: 'Frontend',
      tech: 'React + Vite',
      desc: 'The user interface you interact with in your browser.',
    },
    {
      name: 'Backend',
      tech: 'Node.js + Express',
      desc: 'Runs API endpoints, handles logic, and exposes /metrics.',
    },
    {
      name: 'PostgreSQL',
      tech: 'Database',
      desc: 'Stores persistent user data, services, and incident records.',
    },
    {
      name: 'Prometheus',
      tech: 'Monitoring',
      desc: 'Visits /metrics every 15s to pull and store time-stamped numbers.',
    },
    {
      name: 'Grafana',
      tech: 'Visualization',
      desc: 'Connects to Prometheus to display advanced graphs & panels.',
    },
  ];

  const devMonitorFeatures = [
    'Easy, clean overview dashboard',
    'Plain-English system and metric explanations',
    'Beginner-friendly metrics with context',
    'Interactive failure simulator to learn causes & effects',
    'Self-guided onboarding tour',
  ];

  const grafanaFeatures = [
    'Detailed low-level time-series exploration',
    'Complex PromQL query editor & syntax',
    'Advanced multi-variable graphing and heatmaps',
    'Deep host infrastructure hardware monitoring',
    'Specialized technical debugging for DevOps engineers',
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">How Monitoring Works</h1>
        <p className="text-sm text-slate-500 mt-1">
          A step-by-step visual explanation of how metrics travel from your code to your screen.
        </p>
      </div>

      {/* Live Data-Flow & Vertical Pipeline */}
      <FlowDiagram systemStatus={systemStatus} />

      {/* "Why so many containers?" Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Why so many containers?</h2>
        </div>

        <p className="text-xs text-slate-600">
          Docker keeps each component isolated and makes the whole system easier to run consistently.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {containerBoxes.map((box) => (
            <div
              key={box.name}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 block mb-1">
                  {box.tech}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{box.name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{box.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* "DevMonitor vs Grafana" Comparison */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-1">DevMonitor vs Grafana</h2>
        <p className="text-xs text-slate-500 mb-6">
          Two screens with two distinct purposes in the observability ecosystem.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DevMonitor Column */}
          <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">DevMonitor</h3>
            </div>
            <p className="text-xs text-blue-900 font-medium mb-4">
              Built for understanding and learning system health.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-700">
              {devMonitorFeatures.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Grafana Column */}
          <div className="border border-slate-200 bg-slate-50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-5 h-5 text-slate-700" />
              <h3 className="font-bold text-slate-900 text-sm">Grafana</h3>
            </div>
            <p className="text-xs text-slate-600 font-medium mb-4">
              Built for deep technical investigation and diagnostics.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-700">
              {grafanaFeatures.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
