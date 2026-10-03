import mongoose, { Schema, Document } from 'mongoose';
import type { PriorityLevel, IEscalationRule } from '../../../shared/src/types';

export interface ISystemSettingsDocument extends Document {
  escalationRules: IEscalationRule[];
  defaultResolutionTargets: Record<PriorityLevel, number>;
  maxComplaintsPerDay: number;
  aiAnalysisEnabled: boolean;
  duplicateDetectionEnabled: boolean;
  duplicateSimilarityThreshold: number;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const escalationRuleSchema = new Schema(
  {
    priorityLevel: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    firstEscalationHours: { type: Number, required: true, min: 1 },
    secondEscalationHours: { type: Number, required: true, min: 1 },
    notifyRoles: [{ type: String, enum: ['student', 'warden', 'admin'] }],
  },
  { _id: false }
);

const systemSettingsSchema = new Schema<ISystemSettingsDocument>(
  {
    escalationRules: [escalationRuleSchema],
    defaultResolutionTargets: {
      critical: { type: Number, default: 4 },
      high: { type: Number, default: 12 },
      medium: { type: Number, default: 48 },
      low: { type: Number, default: 168 },
    },
    maxComplaintsPerDay: { type: Number, default: 10 },
    aiAnalysisEnabled: { type: Boolean, default: true },
    duplicateDetectionEnabled: { type: Boolean, default: true },
    duplicateSimilarityThreshold: { type: Number, default: 0.80, min: 0.5, max: 1.0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model<ISystemSettingsDocument>(
  'SystemSettings',
  systemSettingsSchema
);
