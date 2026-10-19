import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SystemErrorItem } from '../../types';

interface RecentErrorsListProps {
  errors: SystemErrorItem[];
}

export const RecentErrorsList: React.FC<RecentErrorsListProps> = ({ errors }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Recent Errors</h3>
          <p className="text-xs text-slate-500 mt-0.5">Most recent failed HTTP requests logged by the server</p>
        </div>
        <Link
          to="/errors"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <span>View all errors</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {errors.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">
          No recent errors logged. System is operating normally.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {errors.slice(0, 5).map((err) => (
            <div key={err.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                    err.status >= 500
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {err.status}
                </span>
                <span className="font-mono text-slate-800">{err.path}</span>
              </div>
              <span className="text-slate-400">{err.timeAgo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
