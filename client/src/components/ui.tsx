import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ComplaintStatus, PriorityLevel } from '@hera/shared';
import { COMPLAINT_STATUS_LABELS, PRIORITY_LABELS } from '@hera/shared';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin ${className}`} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500" role="status">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} aria-hidden="true" />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-base font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="card border-red-200 bg-red-50 px-6 py-4"
      role="alert"
    >
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-3 text-sm">
          Try again
        </button>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700 ring-slate-300',
  ai_analyzed: 'bg-sky-50 text-sky-700 ring-sky-300',
  pending_review: 'bg-amber-50 text-amber-800 ring-amber-300',
  assigned: 'bg-indigo-50 text-indigo-700 ring-indigo-300',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-300',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
  pending_confirmation: 'bg-teal-50 text-teal-700 ring-teal-300',
  closed: 'bg-slate-200 text-slate-700 ring-slate-300',
  rejected: 'bg-red-50 text-red-700 ring-red-300',
  reopened: 'bg-orange-50 text-orange-700 ring-orange-300',
  escalated: 'bg-red-100 text-red-800 ring-red-400',
};

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  critical: 'bg-red-100 text-red-800 ring-red-400',
  high: 'bg-orange-50 text-orange-800 ring-orange-300',
  medium: 'bg-amber-50 text-amber-800 ring-amber-300',
  low: 'bg-slate-100 text-slate-700 ring-slate-300',
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {COMPLAINT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = 'text-slate-900',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>AI Confidence</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="AI confidence"
      >
        <div
          className={`h-2 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between px-1 py-3" aria-label="Pagination">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
