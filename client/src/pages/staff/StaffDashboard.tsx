import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, Inbox, ShieldAlert, CheckCircle2, Star } from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import { StatCard, LoadingState, ErrorState, EmptyState, StatusBadge, PriorityBadge } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import { formatDistanceToNow } from 'date-fns';

export default function StaffDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'warden'],
    queryFn: dashboardApi.warden,
  });

  if (isLoading) return <LoadingState label="Loading dashboard..." />;
  if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  if (!data) return null;

  const s = data.stats;

  const queue = [
    { label: 'Pending Review', value: data.pendingReview.length, to: '/app/complaints?status=pending_review', icon: <Inbox size={16} />, tone: 'text-amber-600' },
    { label: 'Critical', value: s.critical, to: '/app/complaints?priority=critical', icon: <AlertTriangle size={16} />, tone: 'text-red-600' },
    { label: 'High Priority', value: s.high, to: '/app/complaints?priority=high', icon: <ShieldAlert size={16} />, tone: 'text-orange-600' },
    { label: 'Overdue', value: s.overdue, to: '/app/complaints?isOverdue=true', icon: <Clock size={16} />, tone: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Operations Dashboard</h1>
        <p className="text-sm text-slate-500">Live figures computed from the complaint database.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Complaints" value={s.total} />
        <StatCard label="Pending (unassigned)" value={s.submitted} accent="text-amber-600" />
        <StatCard label="In Progress" value={s.inProgress} accent="text-blue-600" />
        <StatCard label="Resolved" value={s.resolved} accent="text-emerald-600" />
        <StatCard label="Overdue" value={s.overdue} accent="text-red-600" />
        <StatCard label="Escalated" value={s.escalated} accent="text-red-700" />
        <StatCard label="Avg Resolution" value={`${s.avgResolutionTimeHours}h`} hint="hours to resolve" />
        <StatCard
          label="Satisfaction"
          value={s.avgSatisfactionRating > 0 ? `${s.avgSatisfactionRating}/5` : '—'}
          hint={s.avgSatisfactionRating > 0 ? 'from student feedback' : 'no feedback yet'}
          accent="text-amber-500"
        />
      </div>

      {/* Work queue */}
      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Work Queue
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {queue.map((q) => (
            <Link key={q.label} to={q.to} className="card p-4 transition hover:border-brand-300 hover:shadow">
              <div className="flex items-center gap-2 text-slate-500">
                <span className={q.tone}>{q.icon}</span>
                <span className="text-xs font-medium uppercase tracking-wide">{q.label}</span>
              </div>
              <p className={`mt-1 text-2xl font-semibold ${q.tone}`}>{q.value}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="mb-3 text-lg font-semibold text-slate-900">
            Awaiting Review
          </h2>
          {data.pendingReview.length === 0 ? (
            <EmptyState title="No complaints pending review." description="All submitted complaints have been triaged." />
          ) : (
            <ul className="space-y-3">
              {data.pendingReview.map((c) => (
                <li key={c._id}>
                  <Link to={`/app/complaints/${c._id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-brand-300">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{c.title}</p>
                      <p className="text-xs text-slate-500">
                        {c.complaintId} · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
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
            Overdue Complaints
          </h2>
          {data.overdueComplaints.length === 0 ? (
            <EmptyState title="Nothing overdue." description="All complaints are within their resolution targets." />
          ) : (
            <ul className="space-y-3">
              {data.overdueComplaints.map((c) => (
                <li key={c._id}>
                  <Link to={`/app/complaints/${c._id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-red-300">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {c.finalClassification?.priority && <PriorityBadge priority={c.finalClassification.priority} />}
                      </div>
                      <p className="mt-1 truncate font-medium text-slate-900">{c.title}</p>
                      <p className="text-xs text-slate-500">{c.complaintId}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Star size={16} className="text-amber-500" /> Recent Activity
        </h2>
        {data.recentActivity.length === 0 ? (
          <EmptyState title="No recent activity." />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {data.recentActivity.map((event) => (
              <li key={event._id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">
                      {(event.actorId && typeof event.actorId === 'object' && 'name' in event.actorId
                        ? String((event.actorId as { name: string }).name)
                        : undefined) ?? 'System'}
                    </span>{' '}
                    {event.action.replace(/_/g, ' ')}
                  </p>
                  {event.comment && <p className="truncate text-xs text-slate-500">{event.comment}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <CheckCircle2 size={16} className="text-emerald-500" />
        Escalation checks run automatically in the background based on configured rules.
      </div>
    </div>
  );
}
