import { Router } from 'express';
import {
  getAnalyticsOverview,
  getCategoryDistribution,
  getMonthlyTrend,
  getDepartmentPerformance,
  getAIInsights,
} from '../controllers/analyticsController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('warden', 'admin'));

router.get('/overview', getAnalyticsOverview);
router.get('/categories', getCategoryDistribution);
router.get('/trends', getMonthlyTrend);
router.get('/departments', getDepartmentPerformance);
router.get('/insights', getAIInsights);

export default router;
