import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartmentDocument extends Document {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
}

const departmentSchema = new Schema<IDepartmentDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Department = mongoose.model<IDepartmentDocument>('Department', departmentSchema);
