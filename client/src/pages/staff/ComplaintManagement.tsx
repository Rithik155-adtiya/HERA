import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { complaintsApi } from '../../api/complaints';
import { configApi } from '../../api/config';
import { StatusBadge, PriorityBadge, Pagination, LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';
import { formatDistanceToNow } from 'date-fns';
import type { ComplaintStatus, PriorityLevel } from '@hera/shared';

const STATUSES: ComplaintStatus[] = [
  'submitted',
  'ai_analyzed',
  'pending_review',
  'assigned',
  'in_progress',
  'resolved',
  'pending_confirmation',
  'closed',
  'rejected',
  'reopened',
  'escalated',
];

const PRIORITIES: PriorityLevel[] = ['critical', 'high', 'medium', 'low'];

export default function ComplaintManagement() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const status = params.get('status') || '';
  const priority = params.get('priority') || '';
  const categoryId = params.get('categoryId') || '';
  const departmentId = params.get('departmentId') || '';
  const isOverdue = params.get('isOverdue') || '';
  const sortBy = params.get('sortBy') || 'createdAt';
  const [searchInput, setSearchInput] = useState(params.get('search') || '');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const search = params.get('search') || '';

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['complaints', 'staff', { page, status, priority, categoryId, departmentId, isOverdue, search, sortBy }],
    queryFn: () =>
      complaintsApi.list({
        page,
        limit: 20,
        status: (status || undefined) as ComplaintStatus | undefined,
        priority: (priority || undefined) as PriorityLevel | undefined,
        categoryId: categoryId || undefined,
        departmentId: departmentId || undefined,
        isOverdue: isOverdue ? isOverdue === 'true' : undefined,
        search: search || undefined,
        sortBy,
        sortOrder: sortBy === 'createdAt' ? 'desc' : 'desc',
      }),
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: configApi.categories });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: configApi.departments });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Complaint Management</h1>
        <p className="text-sm text-slate-500">Server-side filtering, search and pagination.</p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParam('search', searchInput.trim());
        }}
      >
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="ID, title, description, room..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search complaints"
          />
        </div>
        <select className="input" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select className="input" value={priority} onChange={(e) => setParam('priority', e.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className="input" value={categoryId} onChange={(e) => setParam('categoryId', e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={departmentId} onChange={(e) => setParam('departmentId', e.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
        <select className="input" value={isOverdue} onChange={(e) => setParam('isOverdue', e.target.value)} aria-label="Filter overdue">
          <option value="">Overdue: any</option>
          <option value="true">Overdue only</option>
          <option value="false">Not overdue</option>
        </select>
        <select className="input" value={sortBy} onChange={(e) => setParam('sortBy', e.target.value)} aria-label="Sort by">
          <option value="createdAt">Newest first</option>
          <option value="updatedAt">Recently updated</option>
        </select>
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {isLoading ? (
        <LoadingState label="Loading complaints..." />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No complaints found." description="Adjust your filters or search terms." />
      ) : (
        <>
          <div className="card overflow-x-auto" aria-busy={isFetching}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">ID</th>
                  <th scope="col" className="px-4 py-3">Complaint</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-600">
                      <Link to={`/app/complaints/${c._id}`} className="hover:underline">
                        {c.complaintId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.title}</p>
                      <p className="text-xs text-slate-500">
                        {c.location}
                        {c.student ? ` · ${c.student.name}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {c.finalClassification?.priority ? (
                        <PriorityBadge priority={c.finalClassification.priority} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                      {c.isOverdue && (
                        <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={(p) => setParam('page', String(p))} />
        </>
      )}
    </div>
  );
}
