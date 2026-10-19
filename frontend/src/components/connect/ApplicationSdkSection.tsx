import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const ApplicationSdkSection: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('nodejs');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const handleGenerateApiKey = () => {
    const randomKey = `devm_live_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    setApiKey(randomKey);
  };

  const handleCopyKey = () => {
    if (apiKey) {
      navigator.clipboard?.writeText(apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-1">Application SDK Integration</h2>
        <p className="text-xs text-slate-500">
          Integrate the DevMonitor SDK into your backend codebase to capture HTTP durations and route errors.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">
          Select Framework / Runtime
        </label>
        <div className="flex flex-wrap gap-4">
          {['nodejs', 'python', 'java', 'go'].map((lang) => (
            <label
              key={lang}
              className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer"
            >
              <input
                type="radio"
                name="language"
                value={lang}
                checked={selectedLanguage === lang}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="text-blue-600 focus:ring-blue-600"
              />
              <span className="capitalize">{lang === 'nodejs' ? 'Node.js' : lang}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleGenerateApiKey}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          Generate API Key
        </button>

        {apiKey && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Your DevMonitor API Key</span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
              </button>
            </div>
            <code className="block p-2 bg-white border border-slate-200 rounded text-xs font-mono text-slate-800">
              {apiKey}
            </code>

            <div className="pt-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-700 mb-1">Install the DevMonitor SDK:</p>
              {selectedLanguage === 'nodejs' && (
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[11px] font-mono overflow-x-auto">
                  npm install @devmonitor/sdk{'\n'}
                  import &#123; devMonitor &#125; from "@devmonitor/sdk";{'\n'}
                  app.use(devMonitor(&#123; apiKey: "{apiKey}" &#125;));
                </pre>
              )}
              {selectedLanguage === 'python' && (
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[11px] font-mono overflow-x-auto">
                  pip install devmonitor-sdk{'\n'}
                  from devmonitor import DevMonitor{'\n'}
                  monitor = DevMonitor(api_key="{apiKey}")
                </pre>
              )}
              {selectedLanguage === 'java' && (
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[11px] font-mono overflow-x-auto">
                  // Add dependency in pom.xml and configure DevMonitorFilter
                </pre>
              )}
              {selectedLanguage === 'go' && (
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[11px] font-mono overflow-x-auto">
                  go get github.com/devmonitor/sdk-go
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
