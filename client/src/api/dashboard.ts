import api from './client';
import type {
  IStudentDashboard,
  IWardenDashboard,
  IAnalyticsOverview,
  ICategoryDistribution,
  IMonthlyTrend,
  IDepartmentPerformance,
  IAIInsightsResponse,
  ApiResponse,
} from '@hera/shared';

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  return res.data.data as T;
}

export interface AdminDashboard {
  stats: IAnalyticsOverview;
  userCounts: Record<string, number>;
  recentActivity: unknown[];
}

export const dashboardApi = {
  student: () => unwrap<IStudentDashboard>(api.get('/dashboard/student')),
  warden: () => unwrap<IWardenDashboard>(api.get('/dashboard/warden')),
  admin: () => unwrap<AdminDashboard>(api.get('/dashboard/admin')),
};

export const analyticsApi = {
  overview: (params: { hostelId?: string; fromDate?: string; toDate?: string } = {}) =>
    unwrap<IAnalyticsOverview>(api.get('/analytics/overview', { params })),
  categories: (params: { hostelId?: string; fromDate?: string; toDate?: string } = {}) =>
    unwrap<ICategoryDistribution[]>(api.get('/analytics/categories', { params })),
  trends: (params: { hostelId?: string } = {}) =>
    unwrap<IMonthlyTrend[]>(api.get('/analytics/trends', { params })),
  departments: () => unwrap<IDepartmentPerformance[]>(api.get('/analytics/departments')),
  insights: (params: { hostelId?: string } = {}) =>
    unwrap<IAIInsightsResponse>(api.get('/analytics/insights', { params })),
};
