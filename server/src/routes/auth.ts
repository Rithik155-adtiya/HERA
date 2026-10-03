import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, getMe, updateProfile } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/errorHandler';
import { loginSchema, registerSchema } from '../../../shared/src/schemas';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
});

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/', authLimiter, validateBody(loginSchema), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);

export default router;
