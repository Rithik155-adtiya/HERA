import api from './client';
import type { INotification, PaginatedResponse, ApiResponse } from '@hera/shared';

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  return res.data.data as T;
}

export interface NotificationPage extends PaginatedResponse<INotification> {
  unreadCount: number;
}

export const notificationsApi = {
  list: (page = 1, unreadOnly = false) =>
    unwrap<NotificationPage>(
      api.get('/notifications', { params: { page, limit: 20, unreadOnly: unreadOnly || undefined } })
    ),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};
