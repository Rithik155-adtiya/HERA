import mongoose, { Schema, Document } from 'mongoose';

export interface IComplaintCategoryDocument extends Document {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  defaultDepartmentId?: mongoose.Types.ObjectId;
}

const complaintCategorySchema = new Schema<IComplaintCategoryDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    defaultDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  },
  { timestamps: true }
);

complaintCategorySchema.index({ isActive: 1 });

export const ComplaintCategory = mongoose.model<IComplaintCategoryDocument>(
  'ComplaintCategory',
  complaintCategorySchema
);
