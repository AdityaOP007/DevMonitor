import React from 'react';
import { InfoPopover } from './InfoPopover';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  infoDescription: string;
  infoExample?: string;
  status?: 'normal' | 'healthy' | 'warning' | 'danger';
  statusLabel?: string;
  subtext?: string;
  id?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  infoDescription,
  infoExample,
  status = 'normal',
  statusLabel,
  subtext,
  id,
}) => {
  const getStatusClasses = () => {
    switch (status) {
      case 'healthy':
        return 'border-emerald-200 bg-white text-emerald-700';
      case 'warning':
        return 'border-amber-300 bg-amber-50/30 text-amber-800';
      case 'danger':
        return 'border-rose-300 bg-rose-50/40 text-rose-800';
      case 'normal':
      default:
        return 'border-slate-200 bg-white text-slate-900';
    }
  };

  const getStatusBadge = () => {
    if (!statusLabel && status === 'normal') return null;
    switch (status) {
      case 'healthy':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {statusLabel || 'Healthy'}
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            {statusLabel || 'Warning'}
          </span>
        );
      case 'danger':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            {statusLabel || 'Critical'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      id={id}
      className={`rounded-xl border p-5 shadow-sm transition-colors ${getStatusClasses()}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className="flex items-center gap-1.5">
          {getStatusBadge()}
          <InfoPopover title={label} description={infoDescription} example={infoExample} />
        </div>
      </div>

      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-bold tracking-tight text-slate-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
      </div>

      {subtext && <p className="mt-2 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
};
