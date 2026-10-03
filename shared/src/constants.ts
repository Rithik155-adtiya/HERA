import type { ComplaintStatus, PriorityLevel, UserRole } from './types';

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: 'Submitted',
  ai_analyzed: 'AI Analyzed',
  pending_review: 'Pending Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  pending_confirmation: 'Pending Confirmation',
  closed: 'Closed',
  rejected: 'Rejected',
  reopened: 'Reopened',
  escalated: 'Escalated',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_SEVERITY: Record<PriorityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  warden: 'Warden',
  admin: 'Administrator',
};

export const VALID_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ['ai_analyzed', 'pending_review', 'rejected'],
  ai_analyzed: ['pending_review', 'rejected'],
  pending_review: ['assigned', 'rejected'],
  assigned: ['in_progress', 'escalated', 'pending_review'],
  in_progress: ['resolved', 'escalated'],
  resolved: ['pending_confirmation', 'closed'],
  pending_confirmation: ['closed', 'reopened'],
  closed: ['reopened'],
  rejected: [],
  reopened: ['pending_review', 'assigned'],
  escalated: ['assigned', 'in_progress', 'resolved'],
};

export const COMPLAINT_ID_PREFIX = 'HST';
