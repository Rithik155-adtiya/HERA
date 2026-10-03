import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { UserRole } from '../../../shared/src/types';

export interface IUserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  hostelId?: mongoose.Types.ObjectId;
  blockId?: mongoose.Types.ObjectId;
  roomId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'warden', 'admin'], default: 'student' },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel' },
    blockId: { type: Schema.Types.ObjectId, ref: 'Block' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ hostelId: 1 });

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  // passwordHash is already hashed when set from auth service
  next();
});

export const User = mongoose.model<IUserDocument>('User', userSchema);
