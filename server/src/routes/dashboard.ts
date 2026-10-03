import { Router } from 'express';
import {
  getStudentDashboard,
  getWardenDashboard,
  getAdminDashboard,
} from '../controllers/dashboardController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/student', requireRole('student'), getStudentDashboard);
router.get('/warden', requireRole('warden', 'admin'), getWardenDashboard);
router.get('/admin', requireRole('admin'), getAdminDashboard);

export default router;
