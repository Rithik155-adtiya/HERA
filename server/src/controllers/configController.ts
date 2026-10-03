import { Request, Response, NextFunction } from 'express';
import { Hostel, Block, Room } from '../models/Hostel';
import { Department } from '../models/Department';
import { ComplaintCategory } from '../models/ComplaintCategory';
import { User } from '../models/User';
import { SystemSettings } from '../models/SystemSettings';
import { AppError } from '../middleware/errorHandler';
import type { AuthenticatedRequest } from '../middleware/auth';

// ========== HOSTELS ==========
export const getHostels = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostels = await Hostel.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: hostels });
  } catch (error) { next(error); }
};

export const createHostel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostel = await Hostel.create(req.body);
    res.status(201).json({ success: true, data: hostel });
  } catch (error) { next(error); }
};

export const updateHostel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!hostel) throw new AppError('Hostel not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: hostel });
  } catch (error) { next(error); }
};

// ========== BLOCKS ==========
export const getBlocks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hostelId } = req.query;
    const query = { isActive: true, ...(hostelId ? { hostelId } : {}) };
    const blocks = await Block.find(query).populate('hostelId', 'name code').sort({ name: 1 });
    res.json({ success: true, data: blocks });
  } catch (error) { next(error); }
};

export const createBlock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const block = await Block.create(req.body);
    res.status(201).json({ success: true, data: block });
  } catch (error) { next(error); }
};

// ========== ROOMS ==========
export const getRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { blockId } = req.query;
    const query = { isActive: true, ...(blockId ? { blockId } : {}) };
    const rooms = await Room.find(query).populate('blockId', 'name code').sort({ roomNumber: 1 });
    res.json({ success: true, data: rooms });
  } catch (error) { next(error); }
};

export const createRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) { next(error); }
};

// ========== DEPARTMENTS ==========
export const getDepartments = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await Department.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: departments });
  } catch (error) { next(error); }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dept = await Department.create(req.body);
    res.status(201).json({ success: true, data: dept });
  } catch (error) { next(error); }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dept) throw new AppError('Department not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: dept });
  } catch (error) { next(error); }
};

// ========== CATEGORIES ==========
export const getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await ComplaintCategory.find({ isActive: true })
      .populate('defaultDepartmentId', 'name code')
      .sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) { next(error); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await ComplaintCategory.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) { next(error); }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await ComplaintCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: category });
  } catch (error) { next(error); }
};

// ========== STAFF ==========
export const getStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { departmentId, role } = req.query;
    // Active wardens/admins. When a department is selected, include members of
    // that department plus general staff (no department) who can take any job.
    const roleFilter = typeof role === 'string' && role ? role : { $in: ['warden', 'admin'] };
    const query: Record<string, unknown> = {
      isActive: true,
      role: roleFilter,
      ...(typeof departmentId === 'string' && departmentId
        ? { $or: [{ departmentId }, { departmentId: null }] }
        : {}),
    };

    const staff = await User.find(query)
      .select('name email role departmentId')
      .populate('departmentId', 'name code')
      .sort({ name: 1 });
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
};

// ========== USERS (Admin) ==========
export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;

    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    if (search) {
      query['$or'] = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .populate('hostelId', 'name code')
        .populate('blockId', 'name code')
        .populate('roomId', 'roomNumber')
        .populate('departmentId', 'name code')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { items: users, page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, role, isActive, departmentId, hostelId, blockId, roomId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, role, isActive, departmentId, hostelId, blockId, roomId },
      { new: true }
    ).select('-passwordHash');
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: user, message: 'User updated successfully' });
  } catch (error) { next(error); }
};

// ========== SETTINGS ==========
export const getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        escalationRules: [
          { priorityLevel: 'critical', firstEscalationHours: 2, secondEscalationHours: 4, notifyRoles: ['warden', 'admin'] },
          { priorityLevel: 'high', firstEscalationHours: 6, secondEscalationHours: 12, notifyRoles: ['warden'] },
          { priorityLevel: 'medium', firstEscalationHours: 24, secondEscalationHours: 48, notifyRoles: ['warden'] },
          { priorityLevel: 'low', firstEscalationHours: 72, secondEscalationHours: 168, notifyRoles: ['warden'] },
        ],
        defaultResolutionTargets: { critical: 4, high: 12, medium: 48, low: 168 },
        maxComplaintsPerDay: 10,
        aiAnalysisEnabled: true,
        duplicateDetectionEnabled: true,
        duplicateSimilarityThreshold: 0.80,
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({ ...req.body, updatedBy: req.user!.id });
    } else {
      settings = await SystemSettings.findByIdAndUpdate(
        settings._id,
        { ...req.body, updatedBy: req.user!.id },
        { new: true }
      );
    }
    res.json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (error) { next(error); }
};
