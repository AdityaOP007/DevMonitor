import React from 'react';
import { RefreshCw } from 'lucide-react';

export type AlertFilter = 'all' | 'firing' | 'resolved';

interface ReceiverFilterBarProps {
  currentFilter: AlertFilter;
  onFilterChange: (filter: AlertFilter) => void;
  counts: {
    all: number;
    firing: number;
    resolved: number;
  };
  secondsAgo: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const ReceiverFilterBar: React.FC<ReceiverFilterBarProps> = ({
  currentFilter,
  onFilterChange,
  counts,
  secondsAgo,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
      {/* Filter Buttons */}
      <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
        <button
          type="button"
          aria-pressed={currentFilter === 'all'}
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            currentFilter === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All ({counts.all})
        </button>

        <button
          type="button"
          aria-pressed={currentFilter === 'firing'}
          onClick={() => onFilterChange('firing')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            currentFilter === 'firing'
              ? 'bg-white text-rose-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Firing now ({counts.firing})
        </button>

        <button
          type="button"
          aria-pressed={currentFilter === 'resolved'}
          onClick={() => onFilterChange('resolved')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            currentFilter === 'resolved'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Resolved ({counts.resolved})
        </button>
      </div>

      {/* Refresh Status & Manual Action */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          Updated {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors disabled:opacity-50"
          aria-label="Refresh alerts now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};
