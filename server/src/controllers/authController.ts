import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../middleware/auth';

function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign({ id: userId, email, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function idOf(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id);
  return undefined;
}

function sanitizeUser(user: { _id: unknown; name: string; email: string; role: string; hostelId?: unknown; blockId?: unknown; roomId?: unknown; departmentId?: unknown; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    // Accept both populated documents and plain ObjectIds
    hostelId: idOf(user.hostelId),
    blockId: idOf(user.blockId),
    roomId: idOf(user.roomId),
    departmentId: idOf(user.departmentId),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role, hostelId, blockId, roomId } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError('An account with this email already exists', 409, 'DUPLICATE_EMAIL');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || 'student',
      hostelId,
      blockId,
      roomId,
    });

    const token = generateToken(user._id.toString(), user.email, user.role);

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
      },
      message: 'Account created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact admin.', 403, 'ACCOUNT_DEACTIVATED');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateToken(user._id.toString(), user.email, user.role);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
      },
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  // JWT is stateless: the client discards its token. Endpoint exists so the
  // client has an explicit logout contract (and future token revocation list).
  res.json({ success: true, message: 'Logged out successfully' });
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id)
      .populate('hostelId', 'name code')
      .populate('blockId', 'name code')
      .populate('roomId', 'roomNumber')
      .populate('departmentId', 'name code');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({ success: true, data: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, hostelId, blockId, roomId } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { name, hostelId, blockId, roomId },
      { new: true }
    );

    res.json({ success: true, data: sanitizeUser(user!), message: 'Profile updated' });
  } catch (error) {
    next(error);
  }
};
