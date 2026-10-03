import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedbackDocument extends Document {
  complaintId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  satisfaction: 'satisfied' | 'neutral' | 'unsatisfied';
  createdAt: Date;
}

const feedbackSchema = new Schema<IFeedbackDocument>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    satisfaction: {
      type: String,
      enum: ['satisfied', 'neutral', 'unsatisfied'],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

feedbackSchema.index({ studentId: 1 });

export const Feedback = mongoose.model<IFeedbackDocument>('Feedback', feedbackSchema);
