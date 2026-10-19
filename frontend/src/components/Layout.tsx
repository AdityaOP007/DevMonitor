import React, { useState, useCallback } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, Activity, CheckCircle, AlertTriangle, XCircle, Database } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { OnboardingTour } from './OnboardingTour';
import { getHealth, isMockMode } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { SystemHealthStatus } from '../types';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus>('healthy');
  const [showDemoBadge] = useState<boolean>(isMockMode());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getHealth();
      setHealthStatus(res.status);
    } catch {
      setHealthStatus('down');
    }
  }, []);

  usePolling(fetchStatus, 15000);

  const getStatusBadge = () => {
    switch (healthStatus) {
      case 'healthy':
        return (
          <span
            id="topbar-status-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
            role="status"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>System Healthy</span>
          </span>
        );
      case 'degraded':
        return (
          <span
            id="topbar-status-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
            role="status"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Degraded</span>
          </span>
        );
      case 'down':
      default:
        return (
          <span
            id="topbar-status-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200"
            role="status"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Down</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-slate-900 text-lg tracking-tight focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-md px-1"
          >
            <Activity className="w-5 h-5 text-blue-600" />
            <span>DevMonitor</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {showDemoBadge && (
            <span
              id="topbar-demo-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
              title="All metrics are simulated demo placeholders"
            >
              <Database className="w-3 h-3 text-slate-500" />
              <span>Demo data</span>
            </span>
          )}

          {getStatusBadge()}
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 pt-14 lg:pl-64">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* First visit onboarding tour modal */}
      <OnboardingTour />
    </div>
  );
};
