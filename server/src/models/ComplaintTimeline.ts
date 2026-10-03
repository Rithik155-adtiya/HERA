import mongoose, { Schema, Document } from 'mongoose';

export interface IComplaintTimelineDocument extends Document {
  complaintId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  action: string;
  previousValue?: string;
  newValue?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const complaintTimelineSchema = new Schema<IComplaintTimelineDocument>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true },
    previousValue: { type: String },
    newValue: { type: String },
    comment: { type: String, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

complaintTimelineSchema.index({ complaintId: 1, createdAt: -1 });

export const ComplaintTimeline = mongoose.model<IComplaintTimelineDocument>(
  'ComplaintTimeline',
  complaintTimelineSchema
);
