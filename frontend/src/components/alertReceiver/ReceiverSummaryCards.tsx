import React from 'react';
import { AlertCircle, CheckCircle2, Inbox } from 'lucide-react';
import type { ReceiverSummary } from '../../types';

interface ReceiverSummaryCardsProps {
  summary: ReceiverSummary;
}

export const ReceiverSummaryCards: React.FC<ReceiverSummaryCardsProps> = ({ summary }) => {
  const isFiring = summary.firingNow > 0;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {/* 1. Firing Now */}
      <div
        className={`bg-white border rounded-xl p-5 shadow-sm transition-colors ${
          isFiring ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Firing now
          </span>
          {isFiring ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Normal</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`text-3xl font-bold tracking-tight ${
              isFiring ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {summary.firingNow}
          </span>
          <span className="text-xs text-slate-500">
            {summary.firingNow === 1 ? 'alert needs attention' : 'active alerts'}
          </span>
        </div>
      </div>

      {/* 2. Resolved */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Resolved
          </span>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Recovered</span>
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {summary.resolved}
          </span>
          <span className="text-xs text-slate-500">resolved notifications</span>
        </div>
      </div>

      {/* 3. Total Received */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total received
          </span>
          <Inbox className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {summary.total}
          </span>
          <span className="text-xs text-slate-500">
            {summary.total === 1 ? 'webhook payload' : 'in-memory history'}
          </span>
        </div>
      </div>
    </div>
  );
};
