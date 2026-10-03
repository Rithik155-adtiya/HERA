import mongoose, { Schema, Document } from 'mongoose';
import type { ComplaintStatus, PriorityLevel } from '../../../shared/src/types';

const aiAnalysisSchema = new Schema(
  {
    summary: { type: String },
    categoryId: { type: Schema.Types.ObjectId, ref: 'ComplaintCategory' },
    subCategory: { type: String },
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    possibleSafetyRisk: { type: Boolean, default: false },
    safetyReason: { type: String },
    confidence: { type: Number, min: 0, max: 1 },
    priorityReason: { type: String },
    rawResponse: { type: String },
    analyzedAt: { type: Date },
    failed: { type: Boolean, default: false },
    failureReason: { type: String },
  },
  { _id: false }
);

const finalClassificationSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'ComplaintCategory', required: true },
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, required: true },
    reason: { type: String },
  },
  { _id: false }
);

export interface IComplaintDocument extends Document {
  complaintId: string;
  studentId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  location: string;
  hostelId: mongoose.Types.ObjectId;
  blockId?: mongoose.Types.ObjectId;
  roomId?: mongoose.Types.ObjectId;
  aiAnalysis?: {
    summary?: string;
    categoryId?: mongoose.Types.ObjectId;
    subCategory?: string;
    priority?: PriorityLevel;
    departmentId?: mongoose.Types.ObjectId;
    possibleSafetyRisk?: boolean;
    safetyReason?: string;
    confidence?: number;
    priorityReason?: string;
    rawResponse?: string;
    analyzedAt?: Date;
    failed?: boolean;
    failureReason?: string;
  };
  finalClassification?: {
    categoryId: mongoose.Types.ObjectId;
    priority: PriorityLevel;
    departmentId: mongoose.Types.ObjectId;
    approvedBy: mongoose.Types.ObjectId;
    approvedAt: Date;
    reason?: string;
  };
  status: ComplaintStatus;
  assignedStaffId?: mongoose.Types.ObjectId;
  assignedDepartmentId?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  isOverdue: boolean;
  escalationLevel: number;
  possibleDuplicates?: mongoose.Types.ObjectId[];
  linkedComplaints?: mongoose.Types.ObjectId[];
  textEmbedding?: number[];
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaintDocument>(
  {
    complaintId: { type: String, required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'Block' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    aiAnalysis: aiAnalysisSchema,
    finalClassification: finalClassificationSchema,
    status: {
      type: String,
      enum: [
        'submitted', 'ai_analyzed', 'pending_review', 'assigned',
        'in_progress', 'resolved', 'pending_confirmation', 'closed',
        'rejected', 'reopened', 'escalated',
      ],
      default: 'submitted',
    },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },
    isOverdue: { type: Boolean, default: false },
    escalationLevel: { type: Number, default: 0 },
    possibleDuplicates: [{ type: Schema.Types.ObjectId, ref: 'Complaint' }],
    linkedComplaints: [{ type: Schema.Types.ObjectId, ref: 'Complaint' }],
    textEmbedding: [{ type: Number }],
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
complaintSchema.index({ studentId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ 'finalClassification.priority': 1 });
complaintSchema.index({ 'finalClassification.categoryId': 1 });
complaintSchema.index({ 'finalClassification.departmentId': 1 });
complaintSchema.index({ assignedStaffId: 1 });
complaintSchema.index({ hostelId: 1 });
complaintSchema.index({ blockId: 1 });
complaintSchema.index({ isOverdue: 1 });
complaintSchema.index({ createdAt: -1 });

export const Complaint = mongoose.model<IComplaintDocument>('Complaint', complaintSchema);
