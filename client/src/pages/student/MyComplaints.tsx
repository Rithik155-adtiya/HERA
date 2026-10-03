import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2, Search } from 'lucide-react';
import { complaintsApi } from '../../api/complaints';
import { StatusBadge, Pagination, LoadingState, ErrorState, EmptyState, PriorityBadge } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import { formatDistanceToNow } from 'date-fns';
import type { ComplaintStatus } from '@hera/shared';

const STATUS_OPTIONS: Array<{ value: ComplaintStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'reopened', label: 'Reopened' },
  { value: 'escalated', label: 'Escalated' },
];

export default function MyComplaints() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['complaints', 'mine', { page, status, appliedSearch }],
    queryFn: () =>
      complaintsApi.list({
        page,
        limit: 10,
        status: (status || undefined) as ComplaintStatus | undefined,
        search: appliedSearch || undefined,
      }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Complaints</h1>
          <p className="text-sm text-slate-500">Everything you have reported, in one place.</p>
        </div>
        <Link to="/app/complaints/new" className="btn-primary">
          <FilePlus2 size={16} /> Report a Problem
        </Link>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setAppliedSearch(search.trim());
        }}
        role="search"
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by ID, title or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search complaints"
          />
        </div>
        <select
          className="input sm:w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {isLoading ? (
        <LoadingState label="Loading complaints..." />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No complaints found."
          description={appliedSearch || status ? 'Try clearing your filters.' : 'Report your first problem to get started.'}
          action={
            <Link to="/app/complaints/new" className="btn-primary">
              <FilePlus2 size={16} /> Report a Problem
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-3" aria-busy={isFetching}>
            {data.items.map((c) => (
              <li key={c._id}>
                <Link
                  to={`/app/complaints/${c._id}`}
                  className="card flex items-center justify-between gap-3 p-4 transition hover:border-brand-300 hover:shadow"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand-600">{c.complaintId}</span>
                      {c.finalClassification?.priority && <PriorityBadge priority={c.finalClassification.priority} />}
                      {c.isOverdue && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-medium text-slate-900">{c.title}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{c.location}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
