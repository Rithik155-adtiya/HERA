import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint';
import { ComplaintTimeline } from '../models/ComplaintTimeline';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { analyticsService } from '../services/analytics/analyticsService';
import type { AuthenticatedRequest } from '../middleware/auth';

export const getStudentDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.user!.id;

    const [statusCounts, recentComplaints, unreadNotifications] = await Promise.all([
      Complaint.aggregate([
        { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Complaint.find({ studentId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('hostelId', 'name')
        .populate('blockId', 'name')
        .populate('finalClassification.categoryId', 'name'),
      Notification.countDocuments({ recipientId: studentId, isRead: false }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of statusCounts) {
      statusMap[s._id] = s.count;
    }

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const pending =
      (statusMap['submitted'] || 0) +
      (statusMap['ai_analyzed'] || 0) +
      (statusMap['pending_review'] || 0);
    const inProgress =
      (statusMap['assigned'] || 0) +
      (statusMap['in_progress'] || 0) +
      (statusMap['escalated'] || 0);
    const resolved =
      (statusMap['resolved'] || 0) +
      (statusMap['pending_confirmation'] || 0);
    const closed = statusMap['closed'] || 0;

    res.json({
      success: true,
      data: {
        stats: { total, pending, inProgress, resolved, closed },
        recentComplaints,
        unreadNotifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getWardenDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [stats, criticalComplaints, overdueComplaints, pendingReview, recentActivity] =
      await Promise.all([
        analyticsService.getOverview(),
        Complaint.find({
          'finalClassification.priority': 'critical',
          status: { $nin: ['closed', 'rejected'] },
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('studentId', 'name email')
          .populate('finalClassification.categoryId', 'name'),
        Complaint.find({ isOverdue: true, status: { $nin: ['closed', 'rejected'] } })
          .sort({ createdAt: 1 })
          .limit(10)
          .populate('studentId', 'name email')
          .populate('finalClassification.departmentId', 'name'),
        Complaint.find({ status: 'pending_review' })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('studentId', 'name email')
          .populate('hostelId', 'name')
          .populate('blockId', 'name'),
        ComplaintTimeline.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('actorId', 'name role')
          .populate('complaintId', 'complaintId title'),
      ]);

    res.json({
      success: true,
      data: {
        stats,
        criticalComplaints,
        overdueComplaints,
        pendingReview,
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [stats, userCounts, recentActivity] = await Promise.all([
      analyticsService.getOverview(),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      ComplaintTimeline.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('actorId', 'name role')
        .populate('complaintId', 'complaintId title'),
    ]);

    const userMap: Record<string, number> = {};
    for (const u of userCounts) {
      userMap[u._id] = u.count;
    }

    res.json({
      success: true,
      data: {
        stats,
        userCounts: userMap,
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};
