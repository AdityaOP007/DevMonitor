import React, { useState } from 'react';
import { Globe, Terminal, Server, Info } from 'lucide-react';
import { WebsiteMonitorSection } from '../components/connect/WebsiteMonitorSection';
import { ApplicationSdkSection } from '../components/connect/ApplicationSdkSection';
import { ServerAgentSection } from '../components/connect/ServerAgentSection';

type MonitorTab = 'website' | 'application' | 'server';

export const Connect: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MonitorTab>('website');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Connect a Target</h1>
        <p className="text-sm text-slate-500 mt-1">What do you want to monitor?</p>
      </div>

      {/* Explanatory note from brief */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-700">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>How monitoring scope works:</strong> A website URL shows only the outside view
          (up/down status, response time, HTTP status code, and SSL validity).
          Deep inside metrics such as host CPU, memory usage, and internal database queries require the DevMonitor SDK or server agent.
        </p>
      </div>

      {/* 3 Selectable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('website')}
          className={`p-5 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
            activeTab === 'website'
              ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">1. Website (URL)</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Monitor public uptime, latency, and SSL certificate validity from the outside.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('application')}
          className={`p-5 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
            activeTab === 'application'
              ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">2. Application (SDK)</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Track API requests, error rates, and endpoint latency directly inside your code.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('server')}
          className={`p-5 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
            activeTab === 'server'
              ? 'border-blue-600 bg-blue-50/20 ring-1 ring-blue-600'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">3. Server (Agent)</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Install Node Exporter agent to stream host CPU, memory, and disk telemetry.
          </p>
        </button>
      </div>

      {/* Dynamic Tab Content */}
      {activeTab === 'website' && <WebsiteMonitorSection />}
      {activeTab === 'application' && <ApplicationSdkSection />}
      {activeTab === 'server' && <ServerAgentSection />}
    </div>
  );
};
