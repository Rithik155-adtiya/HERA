import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { User } from '../models/User';
import type { UserRole } from '../../../shared/src/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const token = authHeader.substring(7);
    let decoded: { id: string; email: string; role: UserRole };

    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as { id: string; email: string; role: UserRole };
    } catch {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.id).select('name email role isActive');
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account not found or deactivated',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
};

export const requireAnyRole = requireRole;
