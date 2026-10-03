import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import { StatCard, LoadingState, ErrorState, EmptyState, StatusBadge } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import { formatDistanceToNow } from 'date-fns';

export default function StudentDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'student'],
    queryFn: dashboardApi.student,
  });

  if (isLoading) return <LoadingState label="Loading your dashboard..." />;
  if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your Dashboard</h1>
          <p className="text-sm text-slate-500">Track and manage your hostel complaints.</p>
        </div>
        <Link to="/app/complaints/new" className="btn-primary">
          <FilePlus2 size={16} /> Report a Problem
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Complaints" value={data.stats.total} />
        <StatCard label="Pending" value={data.stats.pending} accent="text-amber-600" />
        <StatCard label="In Progress" value={data.stats.inProgress} accent="text-blue-600" />
        <StatCard label="Resolved" value={data.stats.resolved} accent="text-emerald-600" />
      </div>

      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-lg font-semibold text-slate-900">
            Recent Complaints
          </h2>
          <Link to="/app/complaints" className="text-sm font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>

        {data.recentComplaints.length === 0 ? (
          <EmptyState
            title="No complaints yet."
            description="Report your first hostel problem and our AI will route it to the right team."
            action={
              <Link to="/app/complaints/new" className="btn-primary">
                <FilePlus2 size={16} /> Report a Problem
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {data.recentComplaints.map((c) => (
              <li key={c._id}>
                <Link
                  to={`/app/complaints/${c._id}`}
                  className="card flex items-center justify-between gap-3 p-4 transition hover:border-brand-300 hover:shadow"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{c.title}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {c.complaintId} · {c.location}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
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
    </div>
  );
}
