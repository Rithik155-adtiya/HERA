import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { complaintsApi } from '../../api/complaints';
import { StatusBadge, PriorityBadge, LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import { formatDistanceToNow } from 'date-fns';

export default function Escalated() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['complaints', 'escalated'],
    queryFn: () =>
      complaintsApi.list({
        status: 'escalated',
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      }),
  });

  const overdue = useQuery({
    queryKey: ['complaints', 'overdue'],
    queryFn: () => complaintsApi.list({ isOverdue: true, limit: 50 }),
  });

  if (isLoading || overdue.isLoading) return <LoadingState label="Loading escalations..." />;
  if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;

  const escalated = data?.items ?? [];
  const overdueItems = (overdue.data?.items ?? []).filter((c) => c.status !== 'escalated');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Escalated &amp; Overdue</h1>
        <p className="text-sm text-slate-500">
          Escalations are triggered server-side by the configured thresholds — never hardcoded.
        </p>
      </div>

      <section aria-labelledby="esc-heading">
        <h2 id="esc-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Escalated ({escalated.length})
        </h2>
        {escalated.length === 0 ? (
          <EmptyState title="No escalated complaints." description="Nothing has breached escalation rules." />
        ) : (
          <ul className="space-y-3">
            {escalated.map((c) => (
              <li key={c._id}>
                <Link to={`/app/complaints/${c._id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-red-300">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-600">{c.complaintId}</span>
                      {c.finalClassification?.priority && <PriorityBadge priority={c.finalClassification.priority} />}
                      <span className="text-xs text-slate-500">level {c.escalationLevel}</span>
                    </div>
                    <p className="mt-1 truncate font-medium text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="overdue-heading">
        <h2 id="overdue-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Overdue ({overdueItems.length})
        </h2>
        {overdueItems.length === 0 ? (
          <EmptyState title="Nothing overdue." description="All complaints are within their configured resolution targets." />
        ) : (
          <ul className="space-y-3">
            {overdueItems.map((c) => (
              <li key={c._id}>
                <Link to={`/app/complaints/${c._id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-amber-300">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-600">{c.complaintId}</span>
                      {c.finalClassification?.priority && <PriorityBadge priority={c.finalClassification.priority} />}
                    </div>
                    <p className="mt-1 truncate font-medium text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-500">
                      created {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
