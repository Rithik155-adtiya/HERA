import { Complaint, IComplaintDocument } from '../../models/Complaint';
import { ComplaintTimeline } from '../../models/ComplaintTimeline';
import { ComplaintCategory } from '../../models/ComplaintCategory';
import { Department } from '../../models/Department';
import { SystemSettings } from '../../models/SystemSettings';
import { User } from '../../models/User';
import { aiService } from '../ai/aiService';
import { createNotification, createBulkNotifications } from '../notification/notificationService';
import { generateComplaintId, cosineSimilarity } from '../../utils/helpers';
import type {
  ICreateComplaintInput,
  IApproveAIInput,
  IAssignComplaintInput,
} from '../../../../shared/src/types';
import type { ComplaintStatus, PriorityLevel } from '../../../../shared/src/types';
import { VALID_STATUS_TRANSITIONS } from '../../../../shared/src/constants';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import mongoose from 'mongoose';

export class ComplaintService {
  /**
   * Create a new complaint and trigger AI analysis
   */
  async createComplaint(
    input: ICreateComplaintInput,
    studentId: string
  ): Promise<IComplaintDocument> {
    const settings = await this.getSettings();

    // Check daily submission limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Complaint.countDocuments({
      studentId,
      createdAt: { $gte: today },
    });
    if (todayCount >= settings.maxComplaintsPerDay) {
      throw new AppError(
        `Daily complaint limit (${settings.maxComplaintsPerDay}) reached. Please try again tomorrow.`,
        429,
        "DAILY_LIMIT"
      );
    }

    const complaintId = generateComplaintId();

    const complaint = await Complaint.create({
      complaintId,
      studentId,
      title: input.title,
      description: input.description,
      location: input.location,
      hostelId: input.hostelId,
      blockId: input.blockId,
      roomId: input.roomId,
      status: 'submitted' as ComplaintStatus,
      isOverdue: false,
      escalationLevel: 0,
    });

    // Create timeline entry
    await ComplaintTimeline.create({
      complaintId: complaint._id,
      actorId: studentId,
      action: 'complaint_submitted',
      newValue: 'submitted',
      comment: 'Complaint submitted by student',
    });

    // Notify wardens
    const wardens = await User.find({ role: 'warden', isActive: true });
    if (wardens.length > 0) {
      await createBulkNotifications(
        wardens.map((w) => ({
          recipientId: w._id.toString(),
          complaintId: complaint._id.toString(),
          type: 'complaint_submitted' as const,
          title: 'New Complaint Submitted',
          message: `New complaint "${input.title}" has been submitted and needs review.`,
        }))
      );
    }

    // Trigger AI analysis asynchronously
    if (settings.aiAnalysisEnabled) {
      this.runAIAnalysis(complaint._id.toString(), input, settings).catch((err) => {
        logger.error('AI analysis background task failed:', err);
      });
    }

    return complaint;
  }

  /**
   * Run AI analysis on a complaint (can be called manually or automatically)
   */
  async runAIAnalysis(
    complaintId: string,
    input: { title: string; description: string; location: string },
    settings?: { duplicateDetectionEnabled?: boolean; duplicateSimilarityThreshold?: number }
  ): Promise<void> {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) return;

    try {
      // Load valid categories and departments for the AI
      const categories = await ComplaintCategory.find({ isActive: true });
      const departments = await Department.find({ isActive: true });

      const aiResult = await aiService.analyzeComplaint({
        title: input.title,
        description: input.description,
        location: input.location,
        categories: categories.map((c) => ({
          id: c._id.toString(),
          name: c.name,
          code: c.code,
        })),
        departments: departments.map((d) => ({
          id: d._id.toString(),
          name: d.name,
          code: d.code,
        })),
      });

      if (aiResult) {
        // Find category and department by name
        const categoryDoc = categories.find(
          (c) => c.name.toLowerCase() === aiResult.category.toLowerCase()
        );
        const departmentDoc = departments.find(
          (d) => d.name.toLowerCase() === aiResult.department.toLowerCase()
        );

        // Generate embedding for duplicate detection
        const embedding = await aiService.generateEmbedding(
          `${input.title} ${input.description} ${input.location}`
        );

        await Complaint.findByIdAndUpdate(complaintId, {
          aiAnalysis: {
            summary: aiResult.summary,
            categoryId: categoryDoc?._id,
            subCategory: aiResult.subCategory,
            priority: aiResult.priority,
            departmentId: departmentDoc?._id,
            possibleSafetyRisk: aiResult.possibleSafetyRisk,
            safetyReason: aiResult.safetyReason,
            confidence: aiResult.confidence,
            priorityReason: aiResult.priorityReason,
            analyzedAt: new Date(),
            failed: false,
          },
          textEmbedding: embedding,
          status: 'ai_analyzed' as ComplaintStatus,
        });

        await ComplaintTimeline.create({
          complaintId: complaint._id,
          actorId: complaint.studentId,
          action: 'ai_analysis_completed',
          newValue: 'ai_analyzed',
          comment: `AI Analysis: Category=${aiResult.category}, Priority=${aiResult.priority}, Confidence=${(aiResult.confidence * 100).toFixed(0)}%`,
          metadata: {
            category: aiResult.category,
            priority: aiResult.priority,
            confidence: aiResult.confidence,
          },
        });

        // Check for duplicates
        const effectiveSettings = settings || (await this.getSettings());
        if (effectiveSettings.duplicateDetectionEnabled) {
          await this.detectDuplicates(
            complaintId,
            embedding,
            effectiveSettings.duplicateSimilarityThreshold ?? 0.8
          );
        }

        // Update to pending_review
        await Complaint.findByIdAndUpdate(complaintId, { status: 'pending_review' });
        await ComplaintTimeline.create({
          complaintId: complaint._id,
          actorId: complaint.studentId,
          action: 'status_changed',
          previousValue: 'ai_analyzed',
          newValue: 'pending_review',
          comment: 'Complaint moved to pending review',
        });
      } else {
        // AI failed - mark as failed, set status for manual review
        await Complaint.findByIdAndUpdate(complaintId, {
          aiAnalysis: {
            failed: true,
            failureReason: 'AI service unavailable or returned invalid response',
            analyzedAt: new Date(),
          },
          status: 'pending_review',
        });

        await ComplaintTimeline.create({
          complaintId: complaint._id,
          actorId: complaint.studentId,
          action: 'ai_analysis_failed',
          newValue: 'pending_review',
          comment: 'AI analysis failed. Complaint requires manual classification.',
        });
      }
    } catch (error) {
      logger.error('Error in AI analysis:', error);
      await Complaint.findByIdAndUpdate(complaintId, {
        aiAnalysis: {
          failed: true,
          failureReason: 'Unexpected error during AI analysis',
          analyzedAt: new Date(),
        },
        status: 'pending_review',
      });
    }
  }

  /**
   * Detect duplicate complaints using text embeddings
   */
  private async detectDuplicates(
    complaintId: string,
    embedding: number[],
    threshold: number
  ): Promise<void> {
    try {
      // Get recent active complaints with embeddings
      const recentComplaints = await Complaint.find({
        _id: { $ne: new mongoose.Types.ObjectId(complaintId) },
        status: {
          $nin: ['closed', 'rejected'] as ComplaintStatus[],
        },
        textEmbedding: { $exists: true, $ne: [] },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      })
        .select('_id textEmbedding complaintId')
        .limit(50);

      const duplicates: string[] = [];

      for (const existing of recentComplaints) {
        if (existing.textEmbedding && existing.textEmbedding.length > 0) {
          const similarity = cosineSimilarity(embedding, existing.textEmbedding);
          if (similarity >= threshold) {
            duplicates.push(existing._id.toString());
          }
        }
      }

      if (duplicates.length > 0) {
        await Complaint.findByIdAndUpdate(complaintId, {
          possibleDuplicates: duplicates,
        });

        // Notify wardens about potential duplicate
        const wardens = await User.find({ role: 'warden', isActive: true });
        if (wardens.length > 0) {
          await createBulkNotifications(
            wardens.map((w) => ({
              recipientId: w._id.toString(),
              complaintId,
              type: 'duplicate_detected' as const,
              title: 'Possible Duplicate Complaint Detected',
              message: `A new complaint may be a duplicate of ${duplicates.length} existing complaint(s). Please review.`,
            }))
          );
        }
      }
    } catch (error) {
      logger.error('Duplicate detection failed:', error);
    }
  }

  /**
   * Approve or edit AI classification
   */
  async approveAIClassification(
    complaintId: string,
    input: IApproveAIInput,
    wardenId: string
  ): Promise<IComplaintDocument> {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw new AppError('Complaint not found', 404, 'NOT_FOUND');

    const previousStatus = complaint.status;

    await Complaint.findByIdAndUpdate(complaintId, {
      finalClassification: {
        categoryId: input.categoryId,
        priority: input.priority,
        departmentId: input.departmentId,
        approvedBy: wardenId,
        approvedAt: new Date(),
        reason: input.reason,
      },
      status: 'pending_review',
    });

    await ComplaintTimeline.create({
      complaintId: complaint._id,
      actorId: wardenId,
      action: 'ai_classification_approved',
      previousValue: previousStatus,
      newValue: 'pending_review',
      comment: input.reason || 'AI classification approved by warden',
      metadata: {
        categoryId: input.categoryId,
        priority: input.priority,
        departmentId: input.departmentId,
      },
    });

    return (await Complaint.findById(complaintId))!;
  }

  /**
   * Assign complaint to staff
   */
  async assignComplaint(
    complaintId: string,
    input: IAssignComplaintInput,
    wardenId: string
  ): Promise<IComplaintDocument> {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw new AppError('Complaint not found', 404, 'NOT_FOUND');

    const staff = await User.findById(input.staffId);
    if (!staff) throw new AppError('Staff member not found', 404, 'STAFF_NOT_FOUND');

    const previousStatus = complaint.status;

    await Complaint.findByIdAndUpdate(complaintId, {
      assignedStaffId: input.staffId,
      assignedDepartmentId: input.departmentId,
      assignedBy: wardenId,
      assignedAt: new Date(),
      status: 'assigned',
    });

    await ComplaintTimeline.create({
      complaintId: complaint._id,
      actorId: wardenId,
      action: 'complaint_assigned',
      previousValue: previousStatus,
      newValue: 'assigned',
      comment: input.note || `Assigned to ${staff.name}`,
      metadata: { staffId: input.staffId, departmentId: input.departmentId },
    });

    // Notify assigned staff
    await createNotification({
      recipientId: input.staffId,
      complaintId: complaint._id.toString(),
      type: 'complaint_assigned',
      title: 'Complaint Assigned to You',
      message: `Complaint "${complaint.title}" has been assigned to you.`,
    });

    // Notify student
    await createNotification({
      recipientId: complaint.studentId.toString(),
      complaintId: complaint._id.toString(),
      type: 'complaint_assigned',
      title: 'Your Complaint Has Been Assigned',
      message: `Your complaint "${complaint.title}" has been assigned to a team for resolution.`,
    });

    return (await Complaint.findById(complaintId))!;
  }

  /**
   * Update complaint status
   */
  async updateStatus(
    complaintId: string,
    newStatus: ComplaintStatus,
    actorId: string,
    comment?: string
  ): Promise<IComplaintDocument> {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw new AppError('Complaint not found', 404, 'NOT_FOUND');

    const validNextStatuses = VALID_STATUS_TRANSITIONS[complaint.status];
    if (!validNextStatuses.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from "${complaint.status}" to "${newStatus}"`,
        409,
        "INVALID_TRANSITION"
      );
    }

    const updates: Partial<{
      status: ComplaintStatus;
      resolvedAt: Date;
      closedAt: Date;
    }> = { status: newStatus };

    if (newStatus === 'resolved' || newStatus === 'pending_confirmation') {
      updates.resolvedAt = new Date();
    }
    if (newStatus === 'closed') {
      updates.closedAt = new Date();
    }

    await Complaint.findByIdAndUpdate(complaintId, updates);

    await ComplaintTimeline.create({
      complaintId: complaint._id,
      actorId,
      action: 'status_changed',
      previousValue: complaint.status,
      newValue: newStatus,
      comment: comment || `Status changed to ${newStatus}`,
    });

    // Send appropriate notifications
    await this.sendStatusNotifications(complaint, newStatus, actorId);

    return (await Complaint.findById(complaintId))!;
  }

  private async sendStatusNotifications(
    complaint: IComplaintDocument,
    newStatus: ComplaintStatus,
    _actorId: string
  ): Promise<void> {
    const studentId = complaint.studentId.toString();

    if (newStatus === 'resolved' || newStatus === 'pending_confirmation') {
      await createNotification({
        recipientId: studentId,
        complaintId: complaint._id.toString(),
        type: 'complaint_resolved',
        title: 'Your Complaint Has Been Resolved',
        message: `Your complaint "${complaint.title}" has been marked as resolved. Please confirm if the issue has been addressed.`,
      });
    } else if (newStatus === 'in_progress') {
      await createNotification({
        recipientId: studentId,
        complaintId: complaint._id.toString(),
        type: 'complaint_status_changed',
        title: 'Work Has Started on Your Complaint',
        message: `Work has started on your complaint "${complaint.title}".`,
      });
    } else if (newStatus === 'escalated') {
      const wardens = await User.find({ role: { $in: ['warden', 'admin'] }, isActive: true });
      if (wardens.length > 0) {
        await createBulkNotifications(
          wardens.map((w) => ({
            recipientId: w._id.toString(),
            complaintId: complaint._id.toString(),
            type: 'escalation' as const,
            title: 'Complaint Escalated',
            message: `Complaint "${complaint.title}" has been escalated and requires attention.`,
          }))
        );
      }
    }
  }

  /**
   * Reopen a resolved complaint
   */
  async reopenComplaint(
    complaintId: string,
    studentId: string,
    reason: string
  ): Promise<IComplaintDocument> {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) throw new AppError('Complaint not found', 404, 'NOT_FOUND');

    if (!['resolved', 'pending_confirmation', 'closed'].includes(complaint.status)) {
      throw new AppError('Only resolved, pending confirmation or closed complaints can be reopened', 409, 'INVALID_STATE');
    }

    await Complaint.findByIdAndUpdate(complaintId, {
      status: 'reopened',
      resolvedAt: undefined,
    });

    await ComplaintTimeline.create({
      complaintId: complaint._id,
      actorId: studentId,
      action: 'complaint_reopened',
      previousValue: complaint.status,
      newValue: 'reopened',
      comment: reason,
    });

    // Notify wardens
    const wardens = await User.find({ role: 'warden', isActive: true });
    await createBulkNotifications(
      wardens.map((w) => ({
        recipientId: w._id.toString(),
        complaintId: complaint._id.toString(),
        type: 'complaint_reopened' as const,
        title: 'Complaint Reopened by Student',
        message: `Student has reopened complaint "${complaint.title}". Reason: ${reason}`,
      }))
    );

    return (await Complaint.findById(complaintId))!;
  }

  /**
   * Run escalation check for overdue complaints
   */
  async runEscalationCheck(): Promise<void> {
    const settings = await this.getSettings();
    const now = new Date();

    for (const rule of settings.escalationRules) {
      const firstThresholdMs = rule.firstEscalationHours * 60 * 60 * 1000;
      const secondThresholdMs = rule.secondEscalationHours * 60 * 60 * 1000;

      // Find complaints that need escalation
      const complaintsToEscalate = await Complaint.find({
        status: { $in: ['assigned', 'in_progress', 'pending_review'] },
        'finalClassification.priority': rule.priorityLevel as PriorityLevel,
        escalationLevel: 0,
        createdAt: { $lte: new Date(now.getTime() - firstThresholdMs) },
      });

      for (const complaint of complaintsToEscalate) {
        // Mark as overdue
        await Complaint.findByIdAndUpdate(complaint._id, {
          isOverdue: true,
          escalationLevel: 1,
        });

        const recipients = await User.find({
          role: { $in: rule.notifyRoles },
          isActive: true,
        });

        await createBulkNotifications(
          recipients.map((r) => ({
            recipientId: r._id.toString(),
            complaintId: complaint._id.toString(),
            type: 'escalation' as const,
            title: `Overdue ${rule.priorityLevel.toUpperCase()} Priority Complaint`,
            message: `Complaint "${complaint.title}" has exceeded its resolution target (${rule.firstEscalationHours}h) and needs attention.`,
          }))
        );
      }

      // Second escalation
      const secondEscalations = await Complaint.find({
        status: { $in: ['assigned', 'in_progress', 'pending_review'] },
        'finalClassification.priority': rule.priorityLevel as PriorityLevel,
        escalationLevel: 1,
        createdAt: { $lte: new Date(now.getTime() - secondThresholdMs) },
      });

      for (const complaint of secondEscalations) {
        await Complaint.findByIdAndUpdate(complaint._id, { escalationLevel: 2 });

        const admins = await User.find({ role: 'admin', isActive: true });
        await createBulkNotifications(
          admins.map((a) => ({
            recipientId: a._id.toString(),
            complaintId: complaint._id.toString(),
            type: 'escalation' as const,
            title: `URGENT: Severely Overdue Complaint`,
            message: `Complaint "${complaint.title}" has not been resolved after ${rule.secondEscalationHours} hours and requires immediate admin attention.`,
          }))
        );
      }
    }
  }

  private async getSettings() {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        escalationRules: [
          {
            priorityLevel: 'critical',
            firstEscalationHours: 2,
            secondEscalationHours: 4,
            notifyRoles: ['warden', 'admin'],
          },
          {
            priorityLevel: 'high',
            firstEscalationHours: 6,
            secondEscalationHours: 12,
            notifyRoles: ['warden'],
          },
          {
            priorityLevel: 'medium',
            firstEscalationHours: 24,
            secondEscalationHours: 48,
            notifyRoles: ['warden'],
          },
          {
            priorityLevel: 'low',
            firstEscalationHours: 72,
            secondEscalationHours: 168,
            notifyRoles: ['warden'],
          },
        ],
        defaultResolutionTargets: { critical: 4, high: 12, medium: 48, low: 168 },
        maxComplaintsPerDay: 10,
        aiAnalysisEnabled: true,
        duplicateDetectionEnabled: true,
        duplicateSimilarityThreshold: 0.80,
      });
    }
    return settings;
  }
}

export const complaintService = new ComplaintService();
