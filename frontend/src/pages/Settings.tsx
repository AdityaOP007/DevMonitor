import React, { useState } from 'react';
import { RotateCcw, CheckCircle2, Database, Shield } from 'lucide-react';
import { isMockMode } from '../services/api';
import { TOUR_STORAGE_KEY } from '../components/OnboardingTour';

export const Settings: React.FC = () => {
  const [resetDone, setResetDone] = useState<boolean>(false);
  const mockActive = isMockMode();

  const handleResetTour = () => {
    try {
      localStorage.removeItem(TOUR_STORAGE_KEY);
      setResetDone(true);
      window.dispatchEvent(new Event('devmonitor_reset_tour'));
      setTimeout(() => setResetDone(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          System preferences, onboarding tour state, and telemetry source configuration.
        </p>
      </div>

      <div className="space-y-6">
        {/* Onboarding Tour Control */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Onboarding Tour</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reset the first-visit guide modal and walk-through highlights.
            </p>
          </div>

          {resetDone && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Tour reset! The welcome guide modal has been reopened.</span>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={handleResetTour}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Reset & Restart Onboarding Tour</span>
            </button>
          </div>
        </div>

        {/* Data Mode Display */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Current Data Mode</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configured via environment variable <code>VITE_USE_MOCK</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {mockActive ? 'Mock / Demo Data Active' : 'Live Backend Mode Active'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mockActive
                    ? 'All requests return simulated in-memory metrics without requiring a running backend.'
                    : 'The frontend is proxying requests to http://localhost:5000/api.'}
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                mockActive
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {mockActive ? 'Mock Mode' : 'Live API'}
            </span>
          </div>

          <div className="text-xs text-slate-500 flex items-start gap-2 pt-2">
            <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              To switch to live API calls when backend is running, set <code>VITE_USE_MOCK=false</code> in your <code>.env</code> file.
              All components interact strictly through <code>src/services/api.ts</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
