import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  HelpCircle,
  Server,
  Activity,
  AlertOctagon,
  Database,
  Bell,
  Radio,
  PlayCircle,
  Flame,
  Cable,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/how-it-works', label: 'How It Works', icon: HelpCircle, highlightId: 'nav-how-it-works' },
  { to: '/server', label: 'Server', icon: Server },
  { to: '/api-metrics', label: 'API Metrics', icon: Activity },
  { to: '/errors', label: 'Errors', icon: AlertOctagon },
  { to: '/database', label: 'Database', icon: Database },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/alert-receiver', label: 'Alert Receiver', icon: Radio },
  { to: '/playground', label: 'Playground', icon: PlayCircle },
  { to: '/simulator', label: 'Failure Simulator', icon: Flame },
  { to: '/connect', label: 'Connect', icon: Cable },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        aria-label="Main Navigation"
        className={`fixed top-14 bottom-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 lg:hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                id={item.highlightId}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-600`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 text-xs text-slate-500">
          <p className="font-medium text-slate-700">DevMonitor v1.0</p>
          <p>Educational Observability</p>
        </div>
      </aside>
    </>
  );
};
