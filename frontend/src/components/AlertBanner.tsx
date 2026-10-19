import React from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface AlertBannerProps {
  title?: string;
  message: string;
  recommendedAction?: string;
  severity?: 'critical' | 'warning' | 'info';
  onDismiss?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  title = 'ALERT',
  message,
  recommendedAction,
  severity = 'critical',
  onDismiss,
}) => {
  const getSeverityStyles = () => {
    switch (severity) {
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-300 text-amber-900',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
          badge: 'bg-amber-200/80 text-amber-800',
        };
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-900',
          icon: <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />,
          badge: 'bg-blue-200/80 text-blue-800',
        };
      case 'critical':
      default:
        return {
          bg: 'bg-rose-50 border-rose-300 text-rose-900',
          icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />,
          badge: 'bg-rose-200/80 text-rose-800',
        };
    }
  };

  const { bg, icon, badge } = getSeverityStyles();

  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 mb-6 shadow-sm transition-all flex items-start justify-between gap-3 ${bg}`}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badge}`}>
              {title}
            </span>
            <span className="font-semibold text-sm">{message}</span>
          </div>

          {recommendedAction && (
            <p className="mt-1.5 text-xs text-slate-700">
              <span className="font-semibold">Recommended action: </span>
              {recommendedAction}
            </p>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
