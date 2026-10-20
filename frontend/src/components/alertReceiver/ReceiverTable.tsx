import React from 'react';
import { Link } from 'react-router-dom';
import { BellOff, ArrowRight } from 'lucide-react';
import type { ReceiverAlert } from '../../types';
import { ReceiverRow } from './ReceiverRow';

interface ReceiverTableProps {
  alerts: ReceiverAlert[];
  totalCount: number;
}

export const ReceiverTable: React.FC<ReceiverTableProps> = ({ alerts, totalCount }) => {
  if (totalCount === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm space-y-4">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
          <BellOff className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h3 className="text-base font-semibold text-slate-900">No alert notifications yet</h3>
          <p className="text-sm text-slate-500">
            Alerts appear here a minute or two after a rule is broken. Try the Failure Simulator to see
            real alerts trigger and dispatch.
          </p>
        </div>
        <div>
          <Link
            to="/simulator"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-xs"
          >
            <span>Go to Failure Simulator</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm text-sm">
        No alert notifications match the active filter.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
              <th scope="col" className="px-3 py-3 w-10 text-center">
                <span className="sr-only">Expand details</span>
              </th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-3 py-3">Severity</th>
              <th scope="col" className="px-3 py-3">Alert</th>
              <th scope="col" className="px-3 py-3">Summary</th>
              <th scope="col" className="px-3 py-3">Server</th>
              <th scope="col" className="px-3 py-3">Received</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert, idx) => (
              <ReceiverRow
                key={`${alert.alertname}-${alert.instance}-${alert.receivedAt}-${idx}`}
                alert={alert}
                isEven={idx % 2 === 0}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
