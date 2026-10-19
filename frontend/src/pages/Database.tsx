import React, { useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Database as DatabaseIcon } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { getDatabaseStats } from '../services/api';
import { usePolling } from '../hooks/usePolling';
import type { DatabaseStats } from '../types';

export const Database: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await getDatabaseStats();
      setStats(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch database stats');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadData, 15000);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
        <p className="text-sm">Loading database metrics...</p>
      </div>
    );
  }

  if (fetchError && !stats) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>Error loading database stats</span>
        </div>
        <p className="text-sm text-rose-700">{fetchError}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Database Performance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Connection pool health and query performance for PostgreSQL.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Connections"
          value={stats?.connections ?? 0}
          infoDescription="Active client connections to the database pool."
          infoExample="A pool of 24 connections handles active web requests without overloading Postgres."
          status="normal"
          subtext="Active pool pool size"
        />

        <MetricCard
          label="Queries"
          value={stats?.queries ?? 0}
          infoDescription="Total database queries executed since server startup."
          infoExample="SELECT, INSERT, UPDATE and DELETE statements executed."
          status="normal"
          subtext="Total executed"
        />

        <MetricCard
          label="Query Duration"
          value={stats?.queryDuration ?? 0}
          unit="ms"
          infoDescription="Average time taken to execute a database query."
          infoExample="Fast queries complete under 20 ms. Queries over 100 ms may indicate missing indexes."
          status={(stats?.queryDuration ?? 0) > 100 ? 'warning' : 'healthy'}
          statusLabel={(stats?.queryDuration ?? 0) > 100 ? 'Slow Queries' : 'Fast'}
          subtext="Mean execution time"
        />

        <MetricCard
          label="Database Size"
          value={stats?.databaseSize ?? '0 MB'}
          infoDescription="Total storage size occupied on disk by the database."
          infoExample="Data tables, indexes, and write-ahead logs on disk."
          status="normal"
          subtext="On-disk storage"
        />
      </div>

      {/* Database Context Explainer */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <DatabaseIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Understanding Database Metrics</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          In web applications, database queries are usually the single biggest contributor to API response time.
          When query durations rise, API response time increases and requests begin queuing. Monitoring database connections
          ensures your application never runs out of pool slots during traffic spikes.
        </p>
      </div>
    </div>
  );
};
