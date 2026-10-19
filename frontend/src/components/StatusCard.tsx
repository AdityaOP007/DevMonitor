import React from 'react';
import { CheckCircle2, Clock, Check, XCircle } from 'lucide-react';
import type { ServiceStatus } from '../types';

interface StatusCardProps {
  name: string;
  status: ServiceStatus;
  role?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({ name, status, role }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'Healthy':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          label: 'Healthy',
        };
      case 'Collecting':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Clock className="w-4 h-4 text-amber-600 animate-pulse" />,
          label: 'Collecting',
        };
      case 'Connected':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <Check className="w-4 h-4 text-emerald-600" />,
          label: 'Connected',
        };
      case 'Down':
      default:
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <XCircle className="w-4 h-4 text-rose-600" />,
          label: 'Down',
        };
    }
  };

  const { bg, icon, label } = getStatusDisplay();

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{name}</h4>
        {role && <p className="text-xs text-slate-500 mt-0.5">{role}</p>}
      </div>

      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${bg}`}
        role="status"
      >
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
};
