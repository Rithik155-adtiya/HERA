import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { ComplaintStatus, PriorityLevel } from '@hera/shared';
import { VALID_STATUS_TRANSITIONS } from '@hera/shared';
import { complaintsApi, type ComplaintDetail as Detail } from '../../api/complaints';
import { configApi } from '../../api/config';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../api/client';
import {
  LoadingState,
  ErrorState,
  StatusBadge,
  PriorityBadge,
  ConfidenceBar,
  Modal,
  EmptyState,
} from '../../components/ui';

/**
 * Mongoose populate replaces *_id fields in-place (e.g. aiAnalysis.categoryId becomes the
 * category document). Resolve a display name from either the populated doc or a plain id.
 */
function refName(value: unknown): string | undefined {
  if (value && typeof value === 'object' && 'name' in value) {
    return String((value as { name: unknown }).name);
  }
  return undefined;
}

/**
 * The API populates actorId (may be a document or an id) — resolve display name.
 */
function actorName(event: { actorId?: unknown; actor?: unknown }): string | undefined {
  return refName(event.actor) ?? refName(event.actorId);
}

function TimelineList({ detail }: { detail: Detail }) {
  return (
    <ol className="space-y-4" aria-label="Complaint timeline">
      {detail.timeline.map((event) => (
        <li key={event._id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden="true" />
            <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>
          <div className="pb-2">
            <p className="text-sm font-medium text-slate-800">
              {event.action.replace(/_/g, ' ')}
              {event.previousValue && event.newValue && (
                <span className="font-normal text-slate-500">
                  {' '}
                  · {event.previousValue} → {event.newValue}
                </span>
              )}
            </p>
            {event.comment && <p className="mt-0.5 text-sm text-slate-600">{event.comment}</p>}
            <p className="mt-0.5 text-xs text-slate-400">
              {format(new Date(event.createdAt), 'MMM d, yyyy h:mm a')}
              {actorName(event) ? ` · ${actorName(event)}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function ComplaintDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = user?.role === 'warden' || user?.role === 'admin';
  const isStudent = user?.role === 'student';

  const [approveOpen, setApproveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<ComplaintStatus | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.get(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.complaint.status;
      return status === 'submitted' ? 4000 : false;
    },
  });

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: configApi.categories });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: configApi.departments });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['complaint', id] });
    queryClient.invalidateQueries({ queryKey: ['complaints'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const onError = (err: unknown) => toast.error(getErrorMessage(err));

  const approveMutation = useMutation({
    mutationFn: (input: { categoryId: string; priority: PriorityLevel; departmentId: string; reason?: string }) =>
      complaintsApi.approveAI(id, input),
    onSuccess: () => {
      toast.success('Classification approved');
      setApproveOpen(false);
      invalidate();
    },
    onError,
  });

  const assignMutation = useMutation({
    mutationFn: (input: { staffId: string; departmentId: string; note?: string }) =>
      complaintsApi.assign(id, input),
    onSuccess: () => {
      toast.success('Complaint assigned');
      setAssignOpen(false);
      invalidate();
    },
    onError,
  });

  const statusMutation = useMutation({
    mutationFn: (input: { status: ComplaintStatus; comment?: string }) => complaintsApi.updateStatus(id, input),
    onSuccess: () => {
      toast.success('Status updated');
      setStatusModal(null);
      invalidate();
    },
    onError,
  });

  const reopenMutation = useMutation({
    mutationFn: (reason: string) => complaintsApi.reopen(id, reason),
    onSuccess: () => {
      toast.success('Complaint reopened');
      setReopenOpen(false);
      invalidate();
    },
    onError,
  });

  const feedbackMutation = useMutation({
    mutationFn: (input: { rating: number; comment?: string; satisfaction: 'satisfied' | 'neutral' | 'unsatisfied' }) =>
      complaintsApi.feedback(id, input),
    onSuccess: () => {
      toast.success('Thanks for your feedback!');
      setFeedbackOpen(false);
      invalidate();
    },
    onError,
  });

  const reanalyzeMutation = useMutation({
    mutationFn: () => complaintsApi.reanalyze(id),
    onSuccess: () => {
      toast.success('Re-analysis started');
      setTimeout(() => void refetch(), 3000);
    },
    onError,
  });

  if (isLoading) return <LoadingState label="Loading complaint..." />;
  if (isError) return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  if (!data) return null;

  const { complaint, timeline, feedback } = data;
  const ai = complaint.aiAnalysis;
  const finalClass = complaint.finalClassification;
  const aiFailed = ai?.failed;
  const aiPending = !ai && ['submitted', 'ai_analyzed'].includes(complaint.status);
  const suggestedCategory = ai?.categoryId ?? finalClass?.categoryId ?? '';
  const suggestedPriority = ai?.priority ?? finalClass?.priority ?? 'medium';
  const suggestedDepartment = ai?.departmentId ?? finalClass?.departmentId ?? '';

  const possibleNext: ComplaintStatus[] = VALID_STATUS_TRANSITIONS[complaint.status] ?? [];
  const staffNext = possibleNext.filter((s) =>
    ['assigned', 'in_progress', 'resolved', 'pending_confirmation', 'rejected', 'escalated'].includes(s)
  );
  const studentNext = possibleNext.filter((s) => ['closed', 'reopened'].includes(s));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-brand-600">{complaint.complaintId}</span>
            <StatusBadge status={complaint.status} />
            {finalClass?.priority && <PriorityBadge priority={finalClass.priority} />}
            {complaint.isOverdue && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Overdue</span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{complaint.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {complaint.location}
            {complaint.student && ` · Reported by ${complaint.student.name}`}
          </p>
        </div>
        {isStaff && (staffNext.length > 0 || complaint.status === 'pending_review') && (
          <div className="flex flex-wrap gap-2">
            {complaint.status === 'pending_review' && (
              <button type="button" className="btn-primary" onClick={() => setApproveOpen(true)}>
                Review AI Recommendation
              </button>
            )}
            {['assigned', 'in_progress', 'escalated', 'pending_review', 'reopened'].includes(complaint.status) && (
              <button type="button" className="btn-secondary" onClick={() => setAssignOpen(true)}>
                {complaint.assignedStaffId ? 'Reassign' : 'Assign Staff'}
              </button>
            )}
            {staffNext.length > 0 && (
              <button type="button" className="btn-secondary" onClick={() => setStatusModal(staffNext[0])}>
                Change Status
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5" aria-labelledby="desc-heading">
            <h2 id="desc-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {complaint.description}
            </p>
          </section>

          {/* AI analysis */}
          <section className="card p-5" aria-labelledby="ai-heading">
            <div className="flex items-center justify-between">
              <h2 id="ai-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                AI Analysis
              </h2>
              {isStaff && (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => reanalyzeMutation.mutate()}
                  disabled={reanalyzeMutation.isPending}
                >
                  {reanalyzeMutation.isPending ? 'Analyzing...' : 'Re-run analysis'}
                </button>
              )}
            </div>

            {aiPending && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500" role="status">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                AI analysis in progress — this page refreshes automatically.
              </div>
            )}

            {aiFailed && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
                <strong>AI analysis unavailable.</strong> A warden must classify this complaint
                manually. {ai?.failureReason}
              </div>
            )}

            {ai && !aiFailed && (
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-relaxed text-slate-700">{ai.summary}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Category</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {refName(ai.category) ?? refName(ai.categoryId) ?? 'Not classified'}
                      {ai.subCategory && <span className="font-normal text-slate-500"> · {ai.subCategory}</span>}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Priority</p>
                    <div className="mt-1">
                      <PriorityBadge priority={ai.priority} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Department</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {refName(ai.department) ?? refName(ai.departmentId) ?? 'Not set'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Safety risk</p>
                    <p className={`mt-0.5 text-sm font-medium ${ai.possibleSafetyRisk ? 'text-red-600' : 'text-emerald-600'}`}>
                      {ai.possibleSafetyRisk ? `Yes — ${ai.safetyReason ?? 'review required'}` : 'No identified risk'}
                    </p>
                  </div>
                </div>
                <ConfidenceBar value={ai.confidence} />
                <p className="text-xs text-slate-400">
                  AI recommendations are advisory — staff approve or override every classification.
                </p>
              </div>
            )}
          </section>

          {/* Final classification */}
          {finalClass && (
            <section className="card p-5" aria-labelledby="final-heading">
              <h2 id="final-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Approved Classification
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="rounded bg-slate-100 px-2 py-1 font-medium">
                  {refName(finalClass.category) ?? refName(finalClass.categoryId) ?? 'Category'}
                </span>
                <PriorityBadge priority={finalClass.priority} />
                <span className="rounded bg-slate-100 px-2 py-1 font-medium">
                  {refName(finalClass.department) ?? refName(finalClass.departmentId) ?? 'Department'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Approved by {refName(finalClass.approver) ?? refName(finalClass.approvedBy) ?? 'staff'} on{' '}
                {format(new Date(finalClass.approvedAt), 'MMM d, yyyy h:mm a')}
              </p>
            </section>
          )}

          {/* Timeline */}
          <section className="card p-5" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Timeline
            </h2>
            <div className="mt-4">
              {timeline.length === 0 ? (
                <EmptyState title="No timeline events yet." />
              ) : (
                <TimelineList detail={data} />
              )}
            </div>
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Assignment */}
          <section className="card p-5" aria-labelledby="assign-heading">
            <h2 id="assign-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Assignment
            </h2>
            {complaint.assignedStaff ? (
              <div className="mt-2 text-sm text-slate-700">
                <p className="font-medium">{complaint.assignedStaff.name}</p>
                <p className="text-slate-500">{complaint.assignedStaff.email}</p>
                {(complaint.assignedDepartment ?? refName(complaint.assignedDepartmentId)) && (
                  <p className="mt-1 text-slate-600">
                    Dept: {refName(complaint.assignedDepartment) ?? refName(complaint.assignedDepartmentId)}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Not assigned yet.</p>
            )}
          </section>

          {/* Student actions */}
          {isStudent && studentNext.length > 0 && (
            <section className="card p-5" aria-labelledby="actions-heading">
              <h2 id="actions-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your Actions
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {studentNext.includes('closed') && (
                  <>
                    <button
                      type="button"
                      className="btn-success"
                      onClick={() => statusMutation.mutate({ status: 'closed', comment: 'Issue confirmed as resolved' })}
                      disabled={statusMutation.isPending}
                    >
                      Confirm Resolution
                    </button>
                    <button type="button" className="btn-danger" onClick={() => setReopenOpen(true)}>
                      Reopen Complaint
                    </button>
                  </>
                )}
                {studentNext.includes('reopened') && (
                  <button type="button" className="btn-danger" onClick={() => setReopenOpen(true)}>
                    Reopen Complaint
                  </button>
                )}
                {!feedback && ['resolved', 'pending_confirmation', 'closed'].includes(complaint.status) && (
                  <button type="button" className="btn-secondary" onClick={() => setFeedbackOpen(true)}>
                    Leave Feedback
                  </button>
                )}
              </div>
            </section>
          )}

          {feedback && (
            <section className="card p-5" aria-labelledby="feedback-heading">
              <h2 id="feedback-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your Feedback
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {'★'.repeat(feedback.rating)}
                {'☆'.repeat(5 - feedback.rating)} <span className="ml-1">{feedback.rating}/5</span>
              </p>
              {feedback.comment && <p className="mt-1 text-sm text-slate-600">{feedback.comment}</p>}
            </section>
          )}

          {/* Duplicates */}
          {complaint.possibleDuplicates && complaint.possibleDuplicates.length > 0 && (
            <section className="card border-amber-200 p-5" aria-labelledby="dup-heading">
              <h2 id="dup-heading" className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                Possible Duplicates
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Detected by semantic similarity — a human decides whether to link them.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {complaint.possibleDuplicates.length} possible duplicate(s) flagged.
              </p>
            </section>
          )}
        </div>
      </div>

      {/* Approve / Edit AI modal */}
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        categories={categories ?? []}
        departments={departments ?? []}
        defaults={{ categoryId: suggestedCategory, priority: suggestedPriority, departmentId: suggestedDepartment }}
        submitting={approveMutation.isPending}
        onSubmit={(values) => approveMutation.mutate(values)}
        ai={ai ?? null}
      />

      {/* Assign modal */}
      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        departments={departments ?? []}
        submitting={assignMutation.isPending}
        onSubmit={(values) => assignMutation.mutate(values)}
      />

      {/* Status modal */}
      <StatusModal
        open={statusModal !== null}
        status={statusModal}
        options={staffNext}
        onClose={() => setStatusModal(null)}
        submitting={statusMutation.isPending}
        onSubmit={(status, comment) => statusMutation.mutate({ status, comment })}
      />

      {/* Reopen modal */}
      <ReopenModal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        submitting={reopenMutation.isPending}
        onSubmit={(reason) => reopenMutation.mutate(reason)}
      />

      {/* Feedback modal */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        submitting={feedbackMutation.isPending}
        onSubmit={(values) => feedbackMutation.mutate(values)}
      />
    </div>
  );
}

function ApproveModal({
  open,
  onClose,
  categories,
  departments,
  defaults,
  submitting,
  onSubmit,
  ai,
}: {
  open: boolean;
  onClose: () => void;
  categories: Array<{ _id: string; name: string }>;
  departments: Array<{ _id: string; name: string }>;
  defaults: { categoryId: string; priority: PriorityLevel; departmentId: string };
  submitting: boolean;
  onSubmit: (v: { categoryId: string; priority: PriorityLevel; departmentId: string; reason?: string }) => void;
  ai: Detail['complaint']['aiAnalysis'] | null;
}) {
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [priority, setPriority] = useState<PriorityLevel>(defaults.priority);
  const [departmentId, setDepartmentId] = useState(defaults.departmentId);
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (open) {
      setCategoryId(defaults.categoryId);
      setPriority(defaults.priority);
      setDepartmentId(defaults.departmentId);
      setReason('');
    }
  }, [open, defaults.categoryId, defaults.priority, defaults.departmentId]);

  const edited =
    categoryId !== defaults.categoryId || priority !== defaults.priority || departmentId !== defaults.departmentId;

  return (
    <Modal open={open} onClose={onClose} title="Review AI Recommendation">
      {ai && !ai.failed && (
        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-700">AI suggested</p>
          <p>
            {ai.summary}
          </p>
        </div>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ categoryId, priority, departmentId, reason: reason || undefined });
        }}
      >
        <div>
          <label htmlFor="appr-category" className="label">
            Category
          </label>
          <select
            id="appr-category"
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="appr-priority" className="label">
            Priority
          </label>
          <select
            id="appr-priority"
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as PriorityLevel)}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label htmlFor="appr-dept" className="label">
            Department
          </label>
          <select
            id="appr-dept"
            className="input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {edited && (
          <div>
            <label htmlFor="appr-reason" className="label">
              Reason for override
            </label>
            <textarea
              id="appr-reason"
              className="input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing the AI recommendation?"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting || !categoryId || !departmentId}>
            {submitting ? 'Saving...' : edited ? 'Save Override' : 'Approve'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({
  open,
  onClose,
  departments,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  departments: Array<{ _id: string; name: string }>;
  submitting: boolean;
  onSubmit: (v: { staffId: string; departmentId: string; note?: string }) => void;
}) {
  const [departmentId, setDepartmentId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [note, setNote] = useState('');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff', departmentId],
    queryFn: () => configApi.staff(departmentId || undefined),
    enabled: open,
  });

  return (
    <Modal open={open} onClose={onClose} title="Assign Complaint">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ staffId, departmentId, note: note || undefined });
        }}
      >
        <div>
          <label htmlFor="asg-dept" className="label">
            Department
          </label>
          <select
            id="asg-dept"
            className="input"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setStaffId('');
            }}
            required
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="asg-staff" className="label">
            Staff member
          </label>
          <select
            id="asg-staff"
            className="input"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            required
            disabled={!departmentId || isLoading}
          >
            <option value={isLoading ? 'Loading...' : ''}>
              {isLoading ? 'Loading staff...' : 'Select staff'}
            </option>
            {staff?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>
          {departmentId && !isLoading && staff?.length === 0 && (
            <p className="error-text">No active staff in this department.</p>
          )}
        </div>
        <div>
          <label htmlFor="asg-note" className="label">
            Note <span className="text-slate-400">(optional)</span>
          </label>
          <textarea id="asg-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting || !staffId}>
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StatusModal({
  open,
  status,
  options,
  onClose,
  submitting,
  onSubmit,
}: {
  open: boolean;
  status: ComplaintStatus | null;
  options: ComplaintStatus[];
  onClose: () => void;
  submitting: boolean;
  onSubmit: (status: ComplaintStatus, comment?: string) => void;
}) {
  const [selected, setSelected] = useState<ComplaintStatus | ''>('');
  const [comment, setComment] = useState('');

  React.useEffect(() => {
    if (open) {
      setSelected(options[0] ?? '');
      setComment('');
    }
  }, [open, options]);

  return (
    <Modal open={open} onClose={onClose} title="Change Status">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (selected) onSubmit(selected, comment || undefined);
        }}
      >
        <div>
          <label htmlFor="st-next" className="label">
            New status
          </label>
          <select
            id="st-next"
            className="input"
            value={selected}
            onChange={(e) => setSelected(e.target.value as ComplaintStatus)}
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Currently: {status?.replace(/_/g, ' ')} — only valid transitions are allowed.
          </p>
        </div>
        <div>
          <label htmlFor="st-comment" className="label">
            Comment <span className="text-slate-400">(optional)</span>
          </label>
          <textarea id="st-comment" className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting || !selected}>
            {submitting ? 'Updating...' : 'Update Status'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReopenModal({
  open,
  onClose,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const invalid = reason.trim().length < 10;

  return (
    <Modal open={open} onClose={onClose} title="Reopen Complaint">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!invalid) onSubmit(reason.trim());
        }}
      >
        <div>
          <label htmlFor="reopen-reason" className="label">
            Why is the issue not resolved?
          </label>
          <textarea
            id="reopen-reason"
            className="input"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what is still wrong (at least 10 characters)"
            aria-invalid={touched && invalid}
          />
          {touched && invalid && <p className="error-text">Please provide at least 10 characters.</p>}
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-danger flex-1" disabled={submitting}>
            {submitting ? 'Reopening...' : 'Reopen Complaint'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FeedbackModal({
  open,
  onClose,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onSubmit: (v: { rating: number; comment?: string; satisfaction: 'satisfied' | 'neutral' | 'unsatisfied' }) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const satisfaction = rating >= 4 ? 'satisfied' : rating === 3 ? 'neutral' : 'unsatisfied';

  return (
    <Modal open={open} onClose={onClose} title="Rate the Resolution">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ rating, comment: comment || undefined, satisfaction: satisfaction as 'satisfied' | 'neutral' | 'unsatisfied' });
        }}
      >
        <div>
          <span className="label">Rating</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setRating(n)}
                className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-slate-300'}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            You selected {rating}/5 — {satisfaction}.
          </p>
        </div>
        <div>
          <label htmlFor="fb-comment" className="label">
            Comment <span className="text-slate-400">(optional)</span>
          </label>
          <textarea id="fb-comment" className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
