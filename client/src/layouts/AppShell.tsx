import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  FilePlus2,
  ListChecks,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  BarChart3,
  Sparkles,
  Users,
  Building2,
  Settings,
  Home,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { notificationsApi } from '../api/notifications';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

function navForRole(role: string): NavItem[] {
  if (role === 'student') {
    return [
      { to: '/app', label: 'Dashboard', icon: <Home size={18} />, end: true },
      { to: '/app/complaints/new', label: 'Report Problem', icon: <FilePlus2 size={18} /> },
      { to: '/app/complaints', label: 'My Complaints', icon: <ListChecks size={18} /> },
      { to: '/app/notifications', label: 'Notifications', icon: <Bell size={18} /> },
      { to: '/app/profile', label: 'Profile', icon: <User size={18} /> },
    ];
  }
  const staff: NavItem[] = [
    { to: '/app', label: 'Dashboard', icon: <LayoutDashboard size={18} />, end: true },
    { to: '/app/complaints', label: 'Complaints', icon: <ListChecks size={18} /> },
    { to: '/app/complaints/escalated', label: 'Escalated', icon: <ShieldAlert size={18} /> },
    { to: '/app/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { to: '/app/insights', label: 'AI Insights', icon: <Sparkles size={18} /> },
    { to: '/app/notifications', label: 'Notifications', icon: <Bell size={18} /> },
  ];
  if (role === 'admin') {
    staff.push(
      { to: '/app/admin/users', label: 'Users', icon: <Users size={18} /> },
      { to: '/app/admin/hostels', label: 'Hostels & Rooms', icon: <Building2 size={18} /> },
      { to: '/app/admin/taxonomy', label: 'Categories & Depts', icon: <ListChecks size={18} /> },
      { to: '/app/admin/settings', label: 'Settings', icon: <Settings size={18} /> }
    );
  }
  staff.push({ to: '/app/profile', label: 'Profile', icon: <User size={18} /> });
  return staff;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.list(1, true),
    refetchInterval: 30000,
    enabled: !!user,
  });

  const items = navForRole(user?.role ?? 'student');
  const unread = notifData?.unreadCount ?? 0;

  const renderLink = (item: NavItem, mobile = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => mobile && setMobileOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-600 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {item.icon}
      <span>{item.label}</span>
      {item.to === '/app/notifications' && unread > 0 && (
        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <NavLink to="/app" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                H
              </span>
              <span className="text-lg font-semibold tracking-tight text-slate-900">HERA</span>
            </NavLink>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {user?.name}
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs uppercase text-slate-500">
                {user?.role}
              </span>
            </span>
            <button
              type="button"
              onClick={logout}
              className="btn-secondary"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 lg:flex">
          <nav className="flex flex-col gap-1" aria-label="Main navigation">
            {items.map((item) => renderLink(item))}
          </nav>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute left-0 top-0 h-full w-64 bg-white p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-semibold">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Close navigation menu"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                {items.map((item) => renderLink(item, true))}
              </nav>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav (students) */}
      {user?.role === 'student' && (
        <>
          <button
            type="button"
            onClick={() => navigate('/app/complaints/new')}
            className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 sm:hidden"
            aria-label="Report a problem"
            title="Report a problem"
          >
            <FilePlus2 size={24} />
          </button>
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white sm:hidden"
            aria-label="Bottom navigation"
          >
            {items.slice(0, 4).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                    isActive ? 'text-brand-600' : 'text-slate-500'
                  }`
                }
              >
                {item.icon}
                <span>{item.label.split(' ')[0]}</span>
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
