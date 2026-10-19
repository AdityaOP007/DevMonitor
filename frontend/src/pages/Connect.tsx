import React, { useState } from 'react';
import { Globe, Terminal, Server, Copy, AlertCircle, Check, Info } from 'lucide-react';
import { checkUrl } from '../services/api';
import type { UrlCheckResult } from '../types';

type MonitorTab = 'website' | 'application' | 'server';

export const Connect: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MonitorTab>('website');

  // Website Tab state
  const [urlInput, setUrlInput] = useState<string>('https://example.com');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [checkingUrl, setCheckingUrl] = useState<boolean>(false);
  const [urlResult, setUrlResult] = useState<UrlCheckResult | null>(null);

  // Application Tab state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('nodejs');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Server Tab state
  const [serverCommand, setServerCommand] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const handleStartWebsiteMonitoring = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    // Simple URL validation
    let valid = false;
    try {
      const parsed = new URL(urlInput);
      valid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      valid = false;
    }

    if (!valid) {
      setUrlError('Please enter a valid HTTP or HTTPS URL (e.g. https://example.com).');
      return;
    }

    setCheckingUrl(true);
    try {
      const result = await checkUrl(urlInput);
      setUrlResult(result);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to connect to URL');
    } finally {
      setCheckingUrl(false);
    }
  };

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

      {/* Tab 1: Website */}
      {activeTab === 'website' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">Website URL Check</h2>
            <p className="text-xs text-slate-500">
              Enter any web address to test reachability, HTTP response codes, and SSL certificate validity.
            </p>
          </div>

          <form onSubmit={handleStartWebsiteMonitoring} className="space-y-4">
            <div>
              <label htmlFor="url-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Application Web URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="url-input"
                  type="text"
                  placeholder="https://example.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={checkingUrl}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 shrink-0"
                >
                  {checkingUrl ? 'Checking...' : 'Start Monitoring'}
                </button>
              </div>
              {urlError && (
                <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{urlError}</span>
                </p>
              )}
            </div>
          </form>

          {/* Result Card */}
          {urlResult && (
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Monitoring Results for {urlResult.url}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 block">Status</span>
                  <span className="text-sm font-bold text-emerald-700">{urlResult.status}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 block">Availability</span>
                  <span className="text-sm font-bold text-slate-900">{urlResult.availability}%</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 block">Response Time</span>
                  <span className="text-sm font-bold text-slate-900">{urlResult.responseTime} ms</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 block">Status Code</span>
                  <span className="text-sm font-bold text-slate-900">{urlResult.statusCode}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 block">SSL Certificate</span>
                  <span className="text-sm font-bold text-emerald-700">{urlResult.ssl}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-500 block">Uptime</span>
                  <span className="text-xs font-bold text-slate-900">{urlResult.uptime}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Application SDK */}
      {activeTab === 'application' && (
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
      )}

      {/* Tab 3: Server Agent */}
      {activeTab === 'server' && (
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
      )}
    </div>
  );
};
