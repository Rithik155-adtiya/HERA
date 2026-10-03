import mongoose, { Schema, Document } from 'mongoose';
import type { NotificationType } from '../../../shared/src/types';

export interface INotificationDocument extends Document {
  recipientId: mongoose.Types.ObjectId;
  complaintId?: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint' },
    type: {
      type: String,
      enum: [
        'complaint_submitted',
        'complaint_assigned',
        'complaint_status_changed',
        'complaint_resolved',
        'complaint_reopened',
        'escalation',
        'duplicate_detected',
        'feedback_requested',
        'system',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 500 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>(
  'Notification',
  notificationSchema
);
