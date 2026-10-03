import { Response, NextFunction } from 'express';
import { Complaint } from '../models/Complaint';
import { ComplaintTimeline } from '../models/ComplaintTimeline';
import { Feedback } from '../models/Feedback';
import { complaintService } from '../services/complaint/complaintService';
import { aiService } from '../services/ai/aiService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { ComplaintStatus } from '../../../shared/src/types';
import { complaintFilterSchema } from '../../../shared/src/schemas';
import mongoose from 'mongoose';

const populateComplaint = (query: mongoose.Query<unknown, unknown>) => {
  return query
    .populate('studentId', 'name email role hostelId blockId roomId')
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('roomId', 'roomNumber')
    .populate('assignedStaffId', 'name email')
    .populate('assignedDepartmentId', 'name code')
    .populate('aiAnalysis.categoryId', 'name code')
    .populate('aiAnalysis.departmentId', 'name code')
    .populate('finalClassification.categoryId', 'name code')
    .populate('finalClassification.departmentId', 'name code')
    .populate('finalClassification.approvedBy', 'name email');
};

export const getComplaints = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = complaintFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('Invalid filter parameters', 400, 'VALIDATION_ERROR');
    }

    const {
      page,
      limit,
      status,
      priority,
      categoryId,
      departmentId,
      hostelId,
      blockId,
      assignedStaffId,
      isOverdue,
      search,
      sortBy,
      sortOrder,
      fromDate,
      toDate,
    } = parsed.data;

    const query: Record<string, unknown> = {};

    // Role-based scoping
    if (req.user!.role === 'student') {
      query.studentId = req.user!.id;
    }

    if (status) query.status = status;
    if (priority) query['finalClassification.priority'] = priority;
    if (categoryId) query['finalClassification.categoryId'] = categoryId;
    if (departmentId) query['finalClassification.departmentId'] = departmentId;
    if (hostelId) query.hostelId = hostelId;
    if (blockId) query.blockId = blockId;
    if (assignedStaffId) query.assignedStaffId = assignedStaffId;
    if (isOverdue !== undefined) query.isOverdue = isOverdue;

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) (query.createdAt as Record<string, Date>)['$gte'] = new Date(fromDate);
      if (toDate) (query.createdAt as Record<string, Date>)['$lte'] = new Date(toDate);
    }

    if (search) {
      query['$or'] = [
        { complaintId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {};
    sortOptions[sortBy || 'createdAt'] = sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      populateComplaint(
        Complaint.find(query)
          .sort(sortOptions)
          .skip((page - 1) * limit)
          .limit(limit) as unknown as mongoose.Query<unknown, unknown>
      ),
      Complaint.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaint = await populateComplaint(
      Complaint.findById(req.params.id) as unknown as mongoose.Query<unknown, unknown>
    );

    if (!complaint) {
      throw new AppError('Complaint not found', 404, 'NOT_FOUND');
    }

    const c = complaint as InstanceType<typeof Complaint>;

    // Authorization: students can only see their own complaints.
    // studentId may be a populated document at this point, so resolve its _id.
    if (req.user!.role === 'student') {
      const ref = c.studentId as unknown;
      const ownerId =
        ref && typeof ref === 'object' && '_id' in ref
          ? String((ref as { _id: unknown })._id)
          : String(ref);
      if (ownerId !== req.user!.id) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
    }

    // Fetch timeline
    const timeline = await ComplaintTimeline.find({ complaintId: c._id })
      .populate('actorId', 'name role')
      .sort({ createdAt: 1 });

    // Fetch feedback if exists
    const feedback = await Feedback.findOne({ complaintId: c._id });

    res.json({
      success: true,
      data: { complaint: c, timeline, feedback },
    });
  } catch (error) {
    next(error);
  }
};

export const createComplaint = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaint = await complaintService.createComplaint(req.body, req.user!.id);

    res.status(201).json({
      success: true,
      data: complaint,
      message: `Complaint ${complaint.complaintId} submitted successfully. AI analysis is in progress.`,
    });
  } catch (error) {
    next(error);
  }
};

export const reAnalyzeComplaint = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new AppError('Complaint not found', 404, 'NOT_FOUND');

    // Trigger re-analysis
    complaintService.runAIAnalysis(complaint._id.toString(), {
      title: complaint.title,
      description: complaint.description,
      location: complaint.location,
    }).catch((err) => logger.error('Re-analysis failed:', err));

    res.json({
      success: true,
      message: 'AI re-analysis triggered. Results will be available shortly.',
    });
  } catch (error) {
    next(error);
  }
};

export const approveAIClassification = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaint = await complaintService.approveAIClassification(
      req.params.id,
      req.body,
      req.user!.id
    );

    res.json({
      success: true,
      data: complaint,
      message: 'Classification approved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const assignComplaint = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaint = await complaintService.assignComplaint(
      req.params.id,
      req.body,
      req.user!.id
    );

    res.json({
      success: true,
      data: complaint,
      message: 'Complaint assigned successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, comment } = req.body;

    // Role restrictions on status changes
    const role = req.user!.role;
    const studentOnlyStatuses: ComplaintStatus[] = ['closed', 'reopened'];

    if (role === 'student' && !studentOnlyStatuses.includes(status)) {
      throw new AppError('Students can only confirm or reopen complaints', 403, 'FORBIDDEN');
    }

    const complaint = await complaintService.updateStatus(
      req.params.id,
      status,
      req.user!.id,
      comment
    );

    res.json({
      success: true,
      data: complaint,
      message: `Complaint status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

export const reopenComplaint = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reason } = req.body;
    const complaint = await complaintService.reopenComplaint(
      req.params.id,
      req.user!.id,
      reason
    );

    res.json({
      success: true,
      data: complaint,
      message: 'Complaint reopened successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const submitFeedback = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new AppError('Complaint not found', 404, 'NOT_FOUND');

    if (complaint.studentId.toString() !== req.user!.id) {
      throw new AppError('You can only submit feedback for your own complaints', 403, 'FORBIDDEN');
    }

    if (!['resolved', 'closed', 'pending_confirmation'].includes(complaint.status)) {
      throw new AppError('Feedback can only be submitted for resolved complaints', 400, 'INVALID_STATE');
    }

    const existingFeedback = await Feedback.findOne({ complaintId: complaint._id });
    if (existingFeedback) {
      throw new AppError('Feedback has already been submitted for this complaint', 409, 'DUPLICATE');
    }

    const feedback = await Feedback.create({
      complaintId: complaint._id,
      studentId: req.user!.id,
      rating: req.body.rating,
      comment: req.body.comment,
      satisfaction: req.body.satisfaction,
    });

    // Mark as closed if pending confirmation
    if (complaint.status === 'pending_confirmation') {
      await complaintService.updateStatus(
        req.params.id,
        'closed',
        req.user!.id,
        'Student confirmed resolution and submitted feedback'
      );
    }

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    next(error);
  }
};

export const getDuplicateCandidates = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw new AppError('Complaint not found', 404, 'NOT_FOUND');

    if (req.user!.role === 'student' && complaint.studentId.toString() !== req.user!.id) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const ids = complaint.possibleDuplicates ?? [];
    if (ids.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const candidates = await Complaint.find({ _id: { $in: ids } })
      .select('complaintId title description location status createdAt textEmbedding')
      .populate('studentId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    const cosine = (a: number[] = [], b: number[] = []): number => {
      if (a.length === 0 || a.length !== b.length) return 0;
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      if (na === 0 || nb === 0) return 0;
      return dot / (Math.sqrt(na) * Math.sqrt(nb));
    };

    res.json({
      success: true,
      data: candidates.map((c) => ({
        complaint: c,
        similarity: Number(cosine(complaint.textEmbedding, c.textEmbedding).toFixed(4)),
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const linkComplaints = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { targetComplaintId } = req.body;

    await Complaint.findByIdAndUpdate(req.params.id, {
      $addToSet: { linkedComplaints: targetComplaintId },
      $pull: { possibleDuplicates: new mongoose.Types.ObjectId(targetComplaintId) },
    });

    await ComplaintTimeline.create({
      complaintId: req.params.id,
      actorId: req.user!.id,
      action: 'complaints_linked',
      newValue: targetComplaintId,
      comment: 'Complaint linked as related/duplicate',
    });

    res.json({ success: true, message: 'Complaints linked successfully' });
  } catch (error) {
    next(error);
  }
};

export const chatQuery = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      throw new AppError('Query is required', 400, 'VALIDATION_ERROR');
    }

    // Get student's complaints for context
    const complaints = await Complaint.find({ studentId: req.user!.id })
      .select('complaintId title status createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    const response = await aiService.answerChatQuery(query, {
      name: req.user!.name,
      complaints: complaints.map((c) => ({
        id: c.complaintId,
        title: c.title,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    });

    res.json({ success: true, data: { response } });
  } catch (error) {
    next(error);
  }
};
