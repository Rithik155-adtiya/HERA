import { Notification } from '../../models/Notification';
import type { NotificationType } from '../../../../shared/src/types';
import { logger } from '../../utils/logger';
import type { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function setSocketIO(socketServer: SocketServer): void {
  io = socketServer;
}

export interface CreateNotificationInput {
  recipientId: string;
  complaintId?: string;
  type: NotificationType;
  title: string;
  message: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const notification = await Notification.create({
      recipientId: input.recipientId,
      complaintId: input.complaintId,
      type: input.type,
      title: input.title,
      message: input.message,
    });

    // Emit via socket if available
    if (io) {
      io.to(`user:${input.recipientId}`).emit('notification', {
        _id: notification._id,
        type: input.type,
        title: input.title,
        message: input.message,
        complaintId: input.complaintId,
        isRead: false,
        createdAt: notification.createdAt,
      });
    }
  } catch (error) {
    logger.error('Failed to create notification:', error);
  }
}

export async function createBulkNotifications(
  inputs: CreateNotificationInput[]
): Promise<void> {
  try {
    const notifications = await Notification.insertMany(inputs);
    
    if (io) {
      for (const notification of notifications) {
        io.to(`user:${notification.recipientId.toString()}`).emit('notification', {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          complaintId: notification.complaintId,
          isRead: false,
          createdAt: notification.createdAt,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to create bulk notifications:', error);
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ recipientId: userId, isRead: false });
}
