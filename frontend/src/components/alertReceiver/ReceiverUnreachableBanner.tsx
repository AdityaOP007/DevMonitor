import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ReceiverUnreachableBannerProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export const ReceiverUnreachableBanner: React.FC<ReceiverUnreachableBannerProps> = ({
  onRetry,
  isRetrying,
}) => {
  return (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-amber-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold">The alert receiver can&apos;t be reached.</p>
          <p className="text-xs text-amber-800 mt-0.5">
            Check that the <code className="bg-amber-100/70 px-1 py-0.5 rounded font-mono text-[11px]">devmonitor-alert-receiver</code> container is running.
            Background polling will continue automatically.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-100/50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors shrink-0 disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-amber-600' : 'text-amber-700'}`} />
        <span>Try again</span>
      </button>
    </div>
  );
};
