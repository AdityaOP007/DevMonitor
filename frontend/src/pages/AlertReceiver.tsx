import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Radio } from 'lucide-react';
import { getAlertReceiverAlerts } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { AlertReceiverResult } from '../types';
import { ReceiverExplainer } from '../components/alertReceiver/ReceiverExplainer';
import { ReceiverSummaryCards } from '../components/alertReceiver/ReceiverSummaryCards';
import { ReceiverFilterBar, type AlertFilter } from '../components/alertReceiver/ReceiverFilterBar';
import { ReceiverTable } from '../components/alertReceiver/ReceiverTable';
import { ReceiverUnreachableBanner } from '../components/alertReceiver/ReceiverUnreachableBanner';
import { ReceiverSkeleton } from '../components/alertReceiver/ReceiverSkeleton';

export const AlertReceiver: React.FC = () => {
  const [result, setResult] = useState<AlertReceiverResult>(() => ({
    reachable: true,
    alerts: [],
    summary: { firingNow: 0, resolved: 0, total: 0 },
    checkedAt: new Date().toISOString(),
  }));
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const data = await getAlertReceiverAlerts();
      setResult(data);
      setLastUpdated(Date.now());
      setSecondsAgo(0);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Poll every 5s, pausing when browser tab is hidden and refreshing immediately on return
  usePolling(loadData, 5000, { pauseWhenHidden: true });

  // Update "Updated N seconds ago" counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Filter alerts based on active selection
  const filteredAlerts = useMemo(() => {
    if (filter === 'firing') {
      return result.alerts.filter((a) => a.active);
    }
    if (filter === 'resolved') {
      return result.alerts.filter((a) => a.status === 'resolved');
    }
    return result.alerts;
  }, [result.alerts, filter]);

  const counts = useMemo(() => {
    return {
      all: result.alerts.length,
      firing: result.summary.firingNow,
      resolved: result.summary.resolved,
    };
  }, [result.alerts.length, result.summary]);

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-blue-600" />
            <span>Alert Receiver</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Notifications that Alertmanager has sent to DevMonitor&apos;s alert receiver.
          </p>
        </div>
        <ReceiverSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Radio className="w-6 h-6 text-blue-600" />
          <span>Alert Receiver</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Notifications that Alertmanager has sent to DevMonitor&apos;s alert receiver.
        </p>
      </div>

      {/* Unreachable State Warning */}
      {!result.reachable && (
        <ReceiverUnreachableBanner onRetry={loadData} isRetrying={isRefreshing} />
      )}

      {/* Architecture Explainer Card */}
      <ReceiverExplainer />

      {/* Summary KPI Cards */}
      <ReceiverSummaryCards summary={result.summary} />

      {/* Filter and Refresh Bar */}
      <ReceiverFilterBar
        currentFilter={filter}
        onFilterChange={setFilter}
        counts={counts}
        secondsAgo={secondsAgo}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
      />

      {/* Notifications Table or Empty State */}
      <ReceiverTable alerts={filteredAlerts} totalCount={result.alerts.length} />
    </div>
  );
};
