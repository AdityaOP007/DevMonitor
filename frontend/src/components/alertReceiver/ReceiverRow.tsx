import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { ReceiverAlert } from '../../types';
import { formatRelativeTime, formatFullDateTime } from '../../utils/timeFormat';

interface ReceiverRowProps {
  alert: ReceiverAlert;
  isEven: boolean;
}

export const ReceiverRow: React.FC<ReceiverRowProps> = ({ alert, isEven }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Status Badge Logic:
  // - active firing: "Firing now" (red)
  // - resolved: "Resolved" (green)
  // - non-active firing: "Resolved later" (slate/amber)
  const isFiringNow = alert.active;
  const isResolved = alert.status === 'resolved';

  let statusBadge;
  if (isFiringNow) {
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Firing now</span>
      </span>
    );
  } else if (isResolved) {
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Resolved</span>
      </span>
    );
  } else {
    // Firing in the past, but resolved by a later event
    statusBadge = (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3 h-3 shrink-0 text-slate-500" aria-hidden="true" />
        <span>Resolved later</span>
      </span>
    );
  }

  // Severity Badge Logic:
  let severityBadge;
  if (alert.severity === 'critical') {
    severityBadge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
        critical
      </span>
    );
  } else if (alert.severity === 'warning') {
    severityBadge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
        warning
      </span>
    );
  } else {
    severityBadge = (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
        unknown
      </span>
    );
  }

  return (
    <>
      <tr className={`border-b border-slate-100 hover:bg-slate-50/70 transition-colors ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}>
        {/* Expand toggle */}
        <td className="px-3 py-3 w-10 text-center">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={`Expand details for ${alert.alertname}`}
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>

        {/* Status */}
        <td className="px-3 py-3 whitespace-nowrap text-xs">
          {statusBadge}
        </td>

        {/* Severity */}
        <td className="px-3 py-3 whitespace-nowrap text-xs">
          {severityBadge}
        </td>

        {/* Alert Name */}
        <td className="px-3 py-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
          {alert.alertname}
        </td>

        {/* Summary */}
        <td className="px-3 py-3 text-xs text-slate-700 max-w-xs truncate" title={alert.summary}>
          {alert.summary || '—'}
        </td>

        {/* Server (Instance) */}
        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800">
            {alert.instance || 'n/a'}
          </code>
        </td>

        {/* Received Time */}
        <td
          className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap"
          title={formatFullDateTime(alert.receivedAt)}
        >
          {formatRelativeTime(alert.receivedAt)}
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={7} className="px-6 py-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Description */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                  Description
                </span>
                <p className="text-slate-800 bg-white p-2.5 rounded border border-slate-200">
                  {alert.description || 'No detailed description provided.'}
                </p>
              </div>

              {/* Action Hint */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                  What to check
                </span>
                <p className="text-slate-800 bg-white p-2.5 rounded border border-slate-200">
                  {alert.action || 'No recommended action specified.'}
                </p>
              </div>
            </div>

            {/* Timing & Meta */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-slate-500 text-[11px] border-t border-slate-200/60">
              <div>
                <span className="font-medium text-slate-700">Started: </span>
                <span>{formatFullDateTime(alert.startsAt)}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Ended: </span>
                <span>{formatFullDateTime(alert.endsAt)}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Target instance: </span>
                <span className="font-mono">{alert.instance || 'n/a'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Received by receiver: </span>
                <span>{formatFullDateTime(alert.receivedAt)}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
