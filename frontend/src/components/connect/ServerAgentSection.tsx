import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const ServerAgentSection: React.FC = () => {
  const [serverCommand, setServerCommand] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const handleGenerateCommand = () => {
    setServerCommand(
      'curl -sSL https://get.devmonitor.local/agent.sh | sudo DEVMONITOR_KEY=placeholder_key bash'
    );
  };

  const handleCopyCommand = () => {
    if (serverCommand) {
      navigator.clipboard?.writeText(serverCommand);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-1">Host Server Monitoring</h2>
        <p className="text-xs text-slate-500">
          Follow these three numbered steps to stream real CPU, memory, and disk telemetry.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold shrink-0">
            1
          </span>
          <div>
            <strong className="text-slate-800">Generate API Key:</strong> A secure project identifier to link telemetry.
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold shrink-0">
            2
          </span>
          <div>
            <strong className="text-slate-800">Install DevMonitor Agent:</strong> Run the lightweight Node Exporter collector on your server.
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold shrink-0">
            3
          </span>
          <div>
            <strong className="text-slate-800">Start Monitoring:</strong> Metrics will appear in real time on the Server dashboard.
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleGenerateCommand}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          Generate Installation Command
        </button>

        {serverCommand && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800">Installation Command</span>
                <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  PLACEHOLDER COMMAND
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>

            <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono overflow-x-auto">
              {serverCommand}
            </pre>
            <p className="text-[11px] text-slate-500 italic">
              Note: In a full deployment, this command runs Docker or systemd to launch Node Exporter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
