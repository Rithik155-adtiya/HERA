import { Router, RequestHandler } from 'express';
import {
  getHostels, createHostel, updateHostel,
  getBlocks, createBlock,
  getRooms, createRoom,
  getDepartments, createDepartment, updateDepartment,
  getCategories, createCategory, updateCategory,
  getStaff,
  getUsers, updateUser,
  getSettings, updateSettings,
} from '../controllers/configController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Auth is attached per-route (not router.use) so that unknown /api paths
// fall through to the global 404 handler instead of an auth error.
const auth: RequestHandler[] = [authenticate];
const staffOnly: RequestHandler[] = [authenticate, requireRole('warden', 'admin')];
const adminOnly: RequestHandler[] = [authenticate, requireRole('admin')];

// Public (authenticated) config endpoints
router.get('/hostels', ...auth, getHostels);
router.get('/blocks', ...auth, getBlocks);
router.get('/rooms', ...auth, getRooms);
router.get('/departments', ...auth, getDepartments);
router.get('/categories', ...auth, getCategories);
router.get('/staff', ...staffOnly, getStaff);
router.get('/settings', ...auth, getSettings);

// Admin-only
router.post('/hostels', ...adminOnly, createHostel);
router.patch('/hostels/:id', ...adminOnly, updateHostel);
router.post('/blocks', ...adminOnly, createBlock);
router.post('/rooms', ...adminOnly, createRoom);
router.post('/departments', ...adminOnly, createDepartment);
router.patch('/departments/:id', ...adminOnly, updateDepartment);
router.post('/categories', ...adminOnly, createCategory);
router.patch('/categories/:id', ...adminOnly, updateCategory);
router.get('/users', ...adminOnly, getUsers);
router.patch('/users/:id', ...adminOnly, updateUser);
router.patch('/settings', ...adminOnly, updateSettings);

export default router;
