import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../api/notifications';
import { LoadingState, ErrorState, EmptyState, Pagination } from '../components/ui';
import { getErrorMessage } from '../api/client';
import { formatDistanceToNow } from 'date-fns';
import type { INotification } from '@hera/shared';

function notifComplaintId(n: INotification): string | null {
  const raw = n.complaintId as unknown;
  if (raw && typeof raw === 'object' && '_id' in raw) {
    return String((raw as { _id: unknown })._id);
  }
  if (typeof raw === 'string' && raw) return raw;
  return null;
}

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications', page, unreadOnly],
    queryFn: () => notificationsApi.list(page, unreadOnly),
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.unreadCount} unread` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setUnreadOnly((v) => !v)}
            aria-pressed={unreadOnly}
          >
            {unreadOnly ? 'Show all' : 'Unread only'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || (data?.unreadCount ?? 0) === 0}
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Loading notifications..." />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
          description="You'll be notified when your complaints are assigned, updated or resolved."
        />
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((n) => (
              <li key={n._id}>
                <div
                  className={`card flex items-start justify-between gap-3 p-4 ${!n.isRead ? 'border-brand-200 bg-brand-50/40' : ''}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Bell size={16} className={n.isRead ? 'mt-1 text-slate-400' : 'mt-1 text-brand-600'} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                        {notifComplaintId(n) && (
                          <Link
                            to={`/app/complaints/${notifComplaintId(n)}`}
                            className="font-medium text-brand-600 hover:underline"
                          >
                            View complaint
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 text-xs"
                      onClick={() => markRead.mutate(n._id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
