import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, RefreshCw, Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { analyticsApi } from '../../api/dashboard';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import type { IAIInsight } from '@hera/shared';

function severityIcon(severity: IAIInsight['severity']) {
  if (severity === 'critical') return <AlertOctagon size={18} className="text-red-600" />;
  if (severity === 'warning') return <AlertTriangle size={18} className="text-amber-600" />;
  return <Info size={18} className="text-brand-600" />;
}

export default function Insights() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics', 'insights', refreshKey],
    queryFn: () => analyticsApi.insights(),
  });

  if (isLoading) return <LoadingState label="Analyzing real complaint data..." />;
  if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Sparkles size={20} className="text-brand-600" /> AI Insights
          </h1>
          <p className="text-sm text-slate-500">
            Evidence is calculated from the database first — the AI only explains it.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setRefreshKey((k) => k + 1);
            void refetch();
          }}
          disabled={isFetching}
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Refreshing...' : 'Regenerate'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-slate-800">{data.dataPoints}</p>
          <p className="text-xs text-slate-500">data points analyzed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-slate-800">{data.insights.length}</p>
          <p className="text-xs text-slate-500">insights generated</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-semibold text-slate-800">{data.hasEnoughData ? 'Yes' : 'Limited'}</p>
          <p className="text-xs text-slate-500">sufficient history</p>
        </div>
      </div>

      {data.insights.length === 0 ? (
        <EmptyState
          title="No recurring issues detected from the available historical data."
          description="As more complaints are recorded, patterns will surface here with their supporting evidence."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.insights.map((insight) => (
            <article key={insight.id} className="card p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{severityIcon(insight.severity)}</div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">{insight.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{insight.summary}</p>

                  {insight.evidence && insight.evidence.length > 0 && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Evidence (from database)
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {insight.evidence.map((e, i) => (
                          <li key={i} className="flex justify-between text-sm text-slate-700">
                            <span>{e.label ?? e.metric}</span>
                            <span className="font-semibold">{e.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insight.recommendation && (
                    <p className="mt-3 text-sm text-slate-700">
                      <span className="font-medium">Recommendation:</span> {insight.recommendation}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Confidence {Math.round(insight.confidence * 100)}% · {insight.type.replace(/_/g, ' ')}
                    </span>
                    {insight.period && (
                      <span>
                        {new Date(insight.period.from).toLocaleDateString()} —{' '}
                        {new Date(insight.period.to).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
