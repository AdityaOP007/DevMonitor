import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { checkUrl } from '../../services/api';
import type { UrlCheckResult } from '../../types';

export const WebsiteMonitorSection: React.FC = () => {
  const [urlInput, setUrlInput] = useState<string>('https://example.com');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [checkingUrl, setCheckingUrl] = useState<boolean>(false);
  const [urlResult, setUrlResult] = useState<UrlCheckResult | null>(null);

  const handleStartWebsiteMonitoring = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

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

  return (
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
  );
};
