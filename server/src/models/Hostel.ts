import mongoose, { Schema, Document } from 'mongoose';

export interface IHostelDocument extends Document {
  name: string;
  code: string;
  isActive: boolean;
}

const hostelSchema = new Schema<IHostelDocument>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Hostel = mongoose.model<IHostelDocument>('Hostel', hostelSchema);

// ========== BLOCK ==========
export interface IBlockDocument extends Document {
  hostelId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  isActive: boolean;
}

const blockSchema = new Schema<IBlockDocument>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

blockSchema.index({ hostelId: 1 });
blockSchema.index({ hostelId: 1, code: 1 }, { unique: true });

export const Block = mongoose.model<IBlockDocument>('Block', blockSchema);

// ========== ROOM ==========
export interface IRoomDocument extends Document {
  blockId: mongoose.Types.ObjectId;
  roomNumber: string;
  capacity: number;
  isActive: boolean;
}

const roomSchema = new Schema<IRoomDocument>(
  {
    blockId: { type: Schema.Types.ObjectId, ref: 'Block', required: true },
    roomNumber: { type: String, required: true, trim: true },
    capacity: { type: Number, default: 2, min: 1, max: 20 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ blockId: 1 });
roomSchema.index({ blockId: 1, roomNumber: 1 }, { unique: true });

export const Room = mongoose.model<IRoomDocument>('Room', roomSchema);
