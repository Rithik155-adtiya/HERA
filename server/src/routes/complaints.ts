import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getComplaints,
  getComplaintById,
  createComplaint,
  reAnalyzeComplaint,
  approveAIClassification,
  assignComplaint,
  updateStatus,
  reopenComplaint,
  submitFeedback,
  linkComplaints,
  getDuplicateCandidates,
  chatQuery,
} from '../controllers/complaintController';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/errorHandler';
import {
  createComplaintSchema,
  approveAISchema,
  assignComplaintSchema,
  statusUpdateSchema,
  feedbackSchema,
  reopenSchema,
} from '../../../shared/src/schemas';

const router = Router();

// Rate limits
const createComplaintLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'Too many complaints submitted. Please try again later.', code: 'RATE_LIMITED' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many chat requests.', code: 'RATE_LIMITED' },
});

// All complaint routes require authentication
router.use(authenticate);

router.get('/', getComplaints);
router.post('/', createComplaintLimiter, validateBody(createComplaintSchema), createComplaint);
router.get('/:id', getComplaintById);

// AI Analysis
router.post('/:id/analyze', requireRole('warden', 'admin'), reAnalyzeComplaint);
router.post('/:id/approve-ai', requireRole('warden', 'admin'), validateBody(approveAISchema), approveAIClassification);

// Assignment
router.post('/:id/assign', requireRole('warden', 'admin'), validateBody(assignComplaintSchema), assignComplaint);

// Status
router.post('/:id/status', validateBody(statusUpdateSchema), updateStatus);

// Reopen
router.post('/:id/reopen', requireRole('student'), validateBody(reopenSchema), reopenComplaint);

// Feedback
router.post('/:id/feedback', requireRole('student'), validateBody(feedbackSchema), submitFeedback);

// Link duplicates
router.post('/:id/link', requireRole('warden', 'admin'), linkComplaints);
router.get('/:id/duplicates', getDuplicateCandidates);
router.post('/:id/duplicates', requireRole('warden', 'admin'), linkComplaints);

// Chat assistant
router.post('/chat/query', chatLimiter, chatQuery);

export default router;
