// ========== USER TYPES ==========
export type UserRole = 'student' | 'warden' | 'admin';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  hostelId?: string;
  blockId?: string;
  roomId?: string;
  departmentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ========== HOSTEL TYPES ==========
export interface IHostel {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IBlock {
  _id: string;
  hostelId: string;
  hostel?: IHostel;
  name: string;
  code: string;
  isActive: boolean;
}

export interface IRoom {
  _id: string;
  blockId: string;
  block?: IBlock;
  roomNumber: string;
  capacity: number;
  isActive: boolean;
}

// ========== DEPARTMENT TYPES ==========
export interface IDepartment {
  _id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
}

// ========== CATEGORY TYPES ==========
export interface IComplaintCategory {
  _id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  defaultDepartmentId?: string;
  defaultDepartment?: IDepartment;
}

// ========== PRIORITY TYPES ==========
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface IPriorityConfig {
  _id: string;
  name: string;
  level: PriorityLevel;
  description: string;
  severityLevel: number; // 1=low, 4=critical
  defaultResolutionHours: number;
  isActive: boolean;
}

// ========== COMPLAINT TYPES ==========
export type ComplaintStatus =
  | 'submitted'
  | 'ai_analyzed'
  | 'pending_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'pending_confirmation'
  | 'closed'
  | 'rejected'
  | 'reopened'
  | 'escalated';

export interface IAIAnalysis {
  summary: string;
  categoryId?: string;
  category?: IComplaintCategory;
  subCategory?: string;
  priority: PriorityLevel;
  departmentId?: string;
  department?: IDepartment;
  possibleSafetyRisk: boolean;
  safetyReason?: string;
  confidence: number;
  rawResponse?: string;
  analyzedAt: string;
  failed?: boolean;
  failureReason?: string;
}

export interface IFinalClassification {
  categoryId: string;
  category?: IComplaintCategory;
  priority: PriorityLevel;
  departmentId: string;
  department?: IDepartment;
  approvedBy: string;
  approver?: IUser;
  approvedAt: string;
}

export interface IComplaint {
  _id: string;
  complaintId: string;
  studentId: string;
  student?: IUser;
  title: string;
  description: string;
  location: string;
  hostelId: string;
  hostel?: IHostel;
  blockId?: string;
  block?: IBlock;
  roomId?: string;
  room?: IRoom;
  aiAnalysis?: IAIAnalysis;
  finalClassification?: IFinalClassification;
  status: ComplaintStatus;
  assignedStaffId?: string;
  assignedStaff?: IUser;
  assignedDepartmentId?: string;
  assignedDepartment?: IDepartment;
  assignedBy?: string;
  assignedAt?: string;
  isOverdue: boolean;
  escalationLevel: number;
  possibleDuplicates?: string[];
  linkedComplaints?: string[];
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ========== TIMELINE TYPES ==========
export interface IComplaintTimeline {
  _id: string;
  complaintId: string;
  actorId: string;
  actor?: IUser;
  action: string;
  previousValue?: string;
  newValue?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ========== NOTIFICATION TYPES ==========
export type NotificationType =
  | 'complaint_submitted'
  | 'complaint_assigned'
  | 'complaint_status_changed'
  | 'complaint_resolved'
  | 'complaint_reopened'
  | 'escalation'
  | 'duplicate_detected'
  | 'feedback_requested'
  | 'system';

export interface INotification {
  _id: string;
  recipientId: string;
  complaintId?: string;
  complaint?: Partial<IComplaint>;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ========== FEEDBACK TYPES ==========
export interface IFeedback {
  _id: string;
  complaintId: string;
  studentId: string;
  rating: number; // 1-5
  comment?: string;
  satisfaction: 'satisfied' | 'neutral' | 'unsatisfied';
  createdAt: string;
}

// ========== ANALYTICS TYPES ==========
export interface IAnalyticsOverview {
  total: number;
  submitted: number;
  inProgress: number;
  resolved: number;
  closed: number;
  escalated: number;
  overdue: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgResolutionTimeHours: number;
  avgSatisfactionRating: number;
}

export interface ICategoryDistribution {
  categoryId: string;
  categoryName: string;
  count: number;
  percentage: number;
}

export interface IMonthlyTrend {
  year: number;
  month: number;
  monthName: string;
  count: number;
  resolved: number;
}

export interface IDepartmentPerformance {
  departmentId: string;
  departmentName: string;
  assigned: number;
  resolved: number;
  avgResolutionHours: number;
  overdue: number;
}

export interface IRecurringIssue {
  _id: string;
  title: string;
  summary: string;
  evidence: Array<{ metric: string; value: number | string }>;
  recommendation: string;
  confidence: number;
  affectedArea?: string;
  categoryId?: string;
  categoryName?: string;
  period: { from: string; to: string };
  generatedAt: string;
}

// ========== SYSTEM SETTINGS TYPES ==========
export interface IEscalationRule {
  priorityLevel: PriorityLevel;
  firstEscalationHours: number;
  secondEscalationHours: number;
  notifyRoles: UserRole[];
}

export interface ISystemSettings {
  _id: string;
  escalationRules: IEscalationRule[];
  defaultResolutionTargets: Record<PriorityLevel, number>;
  maxComplaintsPerDay: number;
  aiAnalysisEnabled: boolean;
  duplicateDetectionEnabled: boolean;
  duplicateSimilarityThreshold: number;
  updatedBy?: string;
  updatedAt: string;
}

// ========== API RESPONSE TYPES ==========
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ========== AUTH TYPES ==========
export interface IAuthUser {
  user: IUser;
  token: string;
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface IRegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  hostelId?: string;
  blockId?: string;
  roomId?: string;
}

// ========== COMPLAINT INPUT TYPES ==========
export interface ICreateComplaintInput {
  title: string;
  description: string;
  location: string;
  hostelId: string;
  blockId?: string;
  roomId?: string;
  categoryPreference?: string;
}

export interface IApproveAIInput {
  categoryId: string;
  priority: PriorityLevel;
  departmentId: string;
  reason?: string;
}

export interface IAssignComplaintInput {
  staffId: string;
  departmentId: string;
  note?: string;
}

export interface IStatusUpdateInput {
  status: ComplaintStatus;
  comment?: string;
}

export interface IFeedbackInput {
  rating: number;
  comment?: string;
  satisfaction: 'satisfied' | 'neutral' | 'unsatisfied';
}

// ========== DASHBOARD TYPES ==========
export interface IStudentDashboard {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  recentComplaints: IComplaint[];
  unreadNotifications: number;
}

export interface IWardenDashboard {
  stats: IAnalyticsOverview;
  criticalComplaints: IComplaint[];
  overdueComplaints: IComplaint[];
  pendingReview: IComplaint[];
  recentActivity: IComplaintTimeline[];
}

// ========== AI INSIGHT TYPES ==========
export interface IAIInsight {
  id: string;
  type: 'recurring_issue' | 'department_performance' | 'priority_alert' | 'resolution_time' | 'general';
  title: string;
  summary: string;
  evidence?: Array<{ metric: string; value: number | string; label?: string }>;
  recommendation?: string;
  confidence: number;
  severity: 'info' | 'warning' | 'critical';
  period?: { from: string; to: string };
}

export interface IAIInsightsResponse {
  insights: IAIInsight[];
  generatedAt: string;
  dataPoints: number;
  hasEnoughData: boolean;
}
