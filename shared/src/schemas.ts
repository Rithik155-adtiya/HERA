import { z } from 'zod';

// ========== AUTH SCHEMAS ==========
export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['student', 'warden', 'admin']).optional(),
  hostelId: z.string().optional(),
  blockId: z.string().optional(),
  roomId: z.string().optional(),
});

// ========== COMPLAINT SCHEMAS ==========
export const createComplaintSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description too long'),
  location: z.string().min(2, 'Location is required').max(200),
  hostelId: z.string().min(1, 'Hostel is required'),
  blockId: z.string().optional(),
  roomId: z.string().optional(),
  categoryPreference: z.string().optional(),
});

export const approveAISchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  departmentId: z.string().min(1, 'Department is required'),
  reason: z.string().optional(),
});

export const assignComplaintSchema = z.object({
  staffId: z.string().min(1, 'Staff member is required'),
  departmentId: z.string().min(1, 'Department is required'),
  note: z.string().max(500).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.enum([
    'submitted',
    'ai_analyzed',
    'pending_review',
    'assigned',
    'in_progress',
    'resolved',
    'pending_confirmation',
    'closed',
    'rejected',
    'reopened',
    'escalated',
  ]),
  comment: z.string().max(1000).optional(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  satisfaction: z.enum(['satisfied', 'neutral', 'unsatisfied']),
});

export const reopenSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason (min 10 characters)').max(500),
});

// ========== FILTER SCHEMAS ==========
export const complaintFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  categoryId: z.string().optional(),
  departmentId: z.string().optional(),
  hostelId: z.string().optional(),
  blockId: z.string().optional(),
  assignedStaffId: z.string().optional(),
  isOverdue: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// ========== SETTINGS SCHEMAS ==========
export const escalationRuleSchema = z.object({
  priorityLevel: z.enum(['critical', 'high', 'medium', 'low']),
  firstEscalationHours: z.number().int().min(1).max(720),
  secondEscalationHours: z.number().int().min(1).max(720),
  notifyRoles: z.array(z.enum(['student', 'warden', 'admin'])),
});

export const systemSettingsSchema = z.object({
  escalationRules: z.array(escalationRuleSchema),
  defaultResolutionTargets: z.object({
    critical: z.number().int().min(1),
    high: z.number().int().min(1),
    medium: z.number().int().min(1),
    low: z.number().int().min(1),
  }),
  maxComplaintsPerDay: z.number().int().min(1).max(100),
  aiAnalysisEnabled: z.boolean(),
  duplicateDetectionEnabled: z.boolean(),
  duplicateSimilarityThreshold: z.number().min(0.5).max(1.0),
});

// ========== HOSTEL SCHEMAS ==========
export const hostelSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
});

export const blockSchema = z.object({
  hostelId: z.string().min(1),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
});

export const roomSchema = z.object({
  blockId: z.string().min(1),
  roomNumber: z.string().min(1).max(20),
  capacity: z.number().int().min(1).max(20),
});

// ========== DEPARTMENT/CATEGORY SCHEMAS ==========
export const departmentSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  description: z.string().max(500).optional().default(''),
});

export const categorySchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  description: z.string().max(500).optional().default(''),
  defaultDepartmentId: z.string().optional(),
});

// ========== AI SCHEMAS ==========
export const aiAnalysisResponseSchema = z.object({
  summary: z.string().min(10).max(500),
  category: z.string(),
  subCategory: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  department: z.string(),
  possibleSafetyRisk: z.boolean(),
  safetyReason: z.string().optional(),
  confidence: z.number().min(0).max(1),
  priorityReason: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type ApproveAIInput = z.infer<typeof approveAISchema>;
export type AssignComplaintInput = z.infer<typeof assignComplaintSchema>;
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type ReopenInput = z.infer<typeof reopenSchema>;
export type ComplaintFilter = z.infer<typeof complaintFilterSchema>;
export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
export type AIAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;
