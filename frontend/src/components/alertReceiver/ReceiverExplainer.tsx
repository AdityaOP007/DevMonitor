import React from 'react';
import { Info, HelpCircle } from 'lucide-react';

export const ReceiverExplainer: React.FC = () => {
  return (
    <section
      aria-labelledby="receiver-pipeline-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-blue-600 shrink-0" />
        <h2 id="receiver-pipeline-heading" className="text-base font-semibold text-slate-900">
          How Alert Notifications Work
        </h2>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <span className="bg-white px-2 py-1 rounded border border-slate-200 text-slate-900">
            1. Prometheus watches rules
          </span>
          <span className="text-slate-400">&rarr;</span>
          <span className="bg-white px-2 py-1 rounded border border-slate-200 text-slate-900">
            2. Alertmanager decides who to tell
          </span>
          <span className="text-slate-400">&rarr;</span>
          <span className="bg-white px-2 py-1 rounded border border-slate-200 text-slate-900">
            3. Receiver collects webhook
          </span>
          <span className="text-slate-400">&rarr;</span>
          <span className="bg-blue-50 px-2 py-1 rounded border border-blue-200 text-blue-700">
            4. You see it here
          </span>
        </div>
      </div>

      <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
        <p>
          <strong className="text-slate-800">Difference from the &ldquo;Alerts&rdquo; page:</strong> The
          existing <span className="font-semibold text-slate-800">Alerts</span> page shows the
          application&apos;s own simple in-app checks and allows you to adjust simulation thresholds.
          This <span className="font-semibold text-blue-700">Alert Receiver</span> page displays
          live notifications delivered by the production-grade Prometheus and Alertmanager pipeline,
          independent of backend health.
        </p>
        <div className="flex items-start gap-2 pt-1 text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            <em>Storage notice:</em> The alert receiver stores the last 100 notifications in memory;
            they are cleared whenever the <code>devmonitor-alert-receiver</code> container restarts.
          </p>
        </div>
      </div>
    </section>
  );
};
