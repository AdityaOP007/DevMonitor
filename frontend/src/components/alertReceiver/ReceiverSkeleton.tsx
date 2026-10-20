import React from 'react';

export const ReceiverSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading alert receiver">
      {/* Explainer skeleton */}
      <div className="h-28 bg-slate-200/60 rounded-xl" />

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-24 bg-slate-200/60 rounded-xl" />
        <div className="h-24 bg-slate-200/60 rounded-xl" />
        <div className="h-24 bg-slate-200/60 rounded-xl" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex justify-between items-center h-10">
        <div className="w-56 h-8 bg-slate-200/60 rounded-lg" />
        <div className="w-32 h-8 bg-slate-200/60 rounded-md" />
      </div>

      {/* Table skeleton */}
      <div className="h-64 bg-slate-200/60 rounded-xl" />
    </div>
  );
};
