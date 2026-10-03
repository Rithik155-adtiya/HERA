import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics/analyticsService';
import type { AuthenticatedRequest } from '../middleware/auth';

export const getAnalyticsOverview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hostelId, fromDate, toDate } = req.query;
    const data = await analyticsService.getOverview({
      hostelId: hostelId as string | undefined,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCategoryDistribution = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hostelId, fromDate, toDate } = req.query;
    const data = await analyticsService.getCategoryDistribution({
      hostelId: hostelId as string | undefined,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getMonthlyTrend = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hostelId } = req.query;
    const data = await analyticsService.getMonthlyTrend(hostelId as string | undefined);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await analyticsService.getDepartmentPerformance();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getAIInsights = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { hostelId } = req.query;
    const data = await analyticsService.generateAIInsights(hostelId as string | undefined);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
