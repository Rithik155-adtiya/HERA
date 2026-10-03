import { Response, NextFunction } from 'express';
import { Notification } from '../models/Notification';
import type { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const query: Record<string, unknown> = { recipientId: req.user!.id };
    if (unreadOnly) query.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('complaintId', 'complaintId title status'),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: req.user!.id, isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        items: notifications,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) throw new AppError('Notification not found', 404, 'NOT_FOUND');

    if (notification.recipientId.toString() !== req.user!.id) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipientId: req.user!.id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};
