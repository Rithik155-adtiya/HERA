import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AppShell from './layouts/AppShell';
import { LoadingState } from './components/ui';

const Landing = lazy(() => import('./pages/public/Landing'));
const Register = lazy(() => import('./pages/public/Register'));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const CreateComplaint = lazy(() => import('./pages/student/CreateComplaint'));
const MyComplaints = lazy(() => import('./pages/student/MyComplaints'));
const ComplaintDetail = lazy(() => import('./pages/complaints/ComplaintDetail'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const ComplaintManagement = lazy(() => import('./pages/staff/ComplaintManagement'));
const Escalated = lazy(() => import('./pages/staff/Escalated'));
const Analytics = lazy(() => import('./pages/staff/Analytics'));
const Insights = lazy(() => import('./pages/staff/Insights'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminHostels = lazy(() => import('./pages/admin/Hostels'));
const AdminTaxonomy = lazy(() => import('./pages/admin/Taxonomy'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Protected({ roles, children }: { roles?: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState label="Checking session..." />;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function StaffOnly({ children }: { children: React.ReactNode }) {
  return <Protected roles={['warden', 'admin']}>{children}</Protected>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  return <Protected roles={['admin']}>{children}</Protected>;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/app"
          element={
            <Protected>
              <AppShell>
                <RoleDashboard />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/app/complaints/new"
          element={
            <Protected roles={['student']}>
              <AppShell>
                <CreateComplaint />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/app/complaints"
          element={
            <Protected>
              <AppShell>
                <RoleComplaintList />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/app/complaints/escalated"
          element={
            <StaffOnly>
              <AppShell>
                <Escalated />
              </AppShell>
            </StaffOnly>
          }
        />
        <Route
          path="/app/complaints/:id"
          element={
            <Protected>
              <AppShell>
                <ComplaintDetail />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/app/notifications"
          element={
            <Protected>
              <AppShell>
                <Notifications />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/app/profile"
          element={
            <Protected>
              <AppShell>
                <Profile />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/app/analytics"
          element={
            <StaffOnly>
              <AppShell>
                <Analytics />
              </AppShell>
            </StaffOnly>
          }
        />
        <Route
          path="/app/insights"
          element={
            <StaffOnly>
              <AppShell>
                <Insights />
              </AppShell>
            </StaffOnly>
          }
        />
        <Route
          path="/app/admin/users"
          element={
            <AdminOnly>
              <AppShell>
                <AdminUsers />
              </AppShell>
            </AdminOnly>
          }
        />
        <Route
          path="/app/admin/hostels"
          element={
            <AdminOnly>
              <AppShell>
                <AdminHostels />
              </AppShell>
            </AdminOnly>
          }
        />
        <Route
          path="/app/admin/taxonomy"
          element={
            <AdminOnly>
              <AppShell>
                <AdminTaxonomy />
              </AppShell>
            </AdminOnly>
          }
        />
        <Route
          path="/app/admin/settings"
          element={
            <AdminOnly>
              <AppShell>
                <AdminSettings />
              </AppShell>
            </AdminOnly>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentDashboard />;
  return <StaffDashboard />;
}

function RoleComplaintList() {
  const { user } = useAuth();
  if (user?.role === 'student') return <MyComplaints />;
  return <ComplaintManagement />;
}
