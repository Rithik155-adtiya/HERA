import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import { analyticsApi } from '../../api/dashboard';
import { StatCard, LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { getErrorMessage } from '../../api/client';

const COLORS = ['#3358f5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#64748b'];

export default function Analytics() {
  const overview = useQuery({ queryKey: ['analytics', 'overview'], queryFn: () => analyticsApi.overview() });
  const categories = useQuery({ queryKey: ['analytics', 'categories'], queryFn: () => analyticsApi.categories() });
  const trends = useQuery({ queryKey: ['analytics', 'trends'], queryFn: () => analyticsApi.trends() });
  const departments = useQuery({ queryKey: ['analytics', 'departments'], queryFn: analyticsApi.departments });

  if (overview.isLoading || categories.isLoading || trends.isLoading || departments.isLoading) {
    return <LoadingState label="Loading analytics..." />;
  }
  if (overview.isError) return <ErrorState message={getErrorMessage(overview.error)} onRetry={() => void overview.refetch()} />;
  if (!overview.data) return null;

  const s = overview.data;

  const statusData = [
    { name: 'Submitted', value: s.submitted },
    { name: 'In Progress', value: s.inProgress },
    { name: 'Resolved', value: s.resolved },
    { name: 'Closed', value: s.closed },
    { name: 'Escalated', value: s.escalated },
    { name: 'Overdue', value: s.overdue },
  ].filter((d) => d.value > 0);

  const priorityData = [
    { name: 'Critical', value: s.critical },
    { name: 'High', value: s.high },
    { name: 'Medium', value: s.medium },
    { name: 'Low', value: s.low },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">Every figure below is aggregated from MongoDB in real time.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Complaints" value={s.total} />
        <StatCard label="Avg Resolution" value={`${s.avgResolutionTimeHours}h`} hint="hours" />
        <StatCard label="Overdue" value={s.overdue} accent="text-red-600" />
        <StatCard
          label="Avg Satisfaction"
          value={s.avgSatisfactionRating > 0 ? `${s.avgSatisfactionRating}/5` : '—'}
          accent="text-amber-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="cat-heading">
          <h2 id="cat-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Category Distribution
          </h2>
          {!categories.data || categories.data.length === 0 ? (
            <EmptyState title="No categorized complaints yet." description="Approve classifications to populate this chart." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories.data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="categoryName" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3358f5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-5" aria-labelledby="trend-heading">
          <h2 id="trend-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Monthly Trend (12 months)
          </h2>
          {!trends.data || trends.data.length === 0 ? (
            <EmptyState title="No trend data yet." description="Complaint history will appear here over time." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="monthName" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="Complaints" stroke="#3358f5" strokeWidth={2} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-5" aria-labelledby="prio-heading">
          <h2 id="prio-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Priority Distribution
          </h2>
          {priorityData.length === 0 ? (
            <EmptyState title="No priority data yet." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {priorityData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-5" aria-labelledby="dept-heading">
          <h2 id="dept-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Department Performance
          </h2>
          {!departments.data || departments.data.length === 0 ? (
            <EmptyState title="No assignments yet." description="Department metrics appear once complaints are assigned." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-3">Department</th>
                    <th scope="col" className="py-2 pr-3">Assigned</th>
                    <th scope="col" className="py-2 pr-3">Resolved</th>
                    <th scope="col" className="py-2 pr-3">Avg (h)</th>
                    <th scope="col" className="py-2">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.data.map((d) => (
                    <tr key={d.departmentId}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{d.departmentName}</td>
                      <td className="py-2 pr-3">{d.assigned}</td>
                      <td className="py-2 pr-3">{d.resolved}</td>
                      <td className="py-2 pr-3">{d.avgResolutionHours}</td>
                      <td className={`py-2 ${d.overdue > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{d.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card p-5" aria-labelledby="status-heading">
        <h2 id="status-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Status Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statusData.length === 0 ? (
            <p className="text-sm text-slate-500">No complaints yet.</p>
          ) : (
            statusData.map((d) => (
              <div key={d.name} className="rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-xl font-semibold text-slate-800">{d.value}</p>
                <p className="text-xs text-slate-500">{d.name}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
