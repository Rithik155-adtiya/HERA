import { Complaint } from '../../models/Complaint';
import { Feedback } from '../../models/Feedback';
import type {
  IAnalyticsOverview,
  ICategoryDistribution,
  IMonthlyTrend,
  IDepartmentPerformance,
  IAIInsightsResponse,
} from '../../../../shared/src/types';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export class AnalyticsService {
  /**
   * Get complaint overview statistics
   */
  async getOverview(filter: { hostelId?: string; fromDate?: Date; toDate?: Date } = {}): Promise<IAnalyticsOverview> {
    const baseQuery: Record<string, unknown> = {};
    if (filter.hostelId) baseQuery.hostelId = new mongoose.Types.ObjectId(filter.hostelId);
    if (filter.fromDate || filter.toDate) {
      baseQuery.createdAt = {};
      if (filter.fromDate) (baseQuery.createdAt as Record<string, Date>)['$gte'] = filter.fromDate;
      if (filter.toDate) (baseQuery.createdAt as Record<string, Date>)['$lte'] = filter.toDate;
    }

    const [statusAgg, priorityAgg, resolutionAgg, satisfactionAgg, overdueCount] =
      await Promise.all([
        Complaint.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Complaint.aggregate([
          { $match: { ...baseQuery, 'finalClassification.priority': { $exists: true } } },
          { $group: { _id: '$finalClassification.priority', count: { $sum: 1 } } },
        ]),
        Complaint.aggregate([
          {
            $match: {
              ...baseQuery,
              status: { $in: ['resolved', 'closed'] },
              resolvedAt: { $exists: true },
            },
          },
          {
            $project: {
              resolutionHours: {
                $divide: [
                  { $subtract: ['$resolvedAt', '$createdAt'] },
                  3600000,
                ],
              },
            },
          },
          { $group: { _id: null, avg: { $avg: '$resolutionHours' } } },
        ]),
        Feedback.aggregate([
          { $group: { _id: null, avg: { $avg: '$rating' } } },
        ]),
        Complaint.countDocuments({ ...baseQuery, isOverdue: true }),
      ]);

    const statusMap: Record<string, number> = {};
    for (const s of statusAgg) {
      statusMap[s._id] = s.count;
    }

    const priorityMap: Record<string, number> = {};
    for (const p of priorityAgg) {
      if (p._id) priorityMap[p._id] = p.count;
    }

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

    return {
      total,
      submitted: statusMap['submitted'] || 0,
      inProgress:
        (statusMap['in_progress'] || 0) +
        (statusMap['assigned'] || 0) +
        (statusMap['escalated'] || 0),
      resolved: (statusMap['resolved'] || 0) + (statusMap['pending_confirmation'] || 0),
      closed: statusMap['closed'] || 0,
      escalated: statusMap['escalated'] || 0,
      overdue: overdueCount,
      critical: priorityMap['critical'] || 0,
      high: priorityMap['high'] || 0,
      medium: priorityMap['medium'] || 0,
      low: priorityMap['low'] || 0,
      avgResolutionTimeHours:
        resolutionAgg.length > 0
          ? Math.round((resolutionAgg[0].avg || 0) * 10) / 10
          : 0,
      avgSatisfactionRating:
        satisfactionAgg.length > 0
          ? Math.round((satisfactionAgg[0].avg || 0) * 10) / 10
          : 0,
    };
  }

  /**
   * Get category distribution
   */
  async getCategoryDistribution(filter: { hostelId?: string; fromDate?: Date; toDate?: Date } = {}): Promise<ICategoryDistribution[]> {
    const baseQuery: Record<string, unknown> = {
      'finalClassification.categoryId': { $exists: true },
    };
    if (filter.hostelId) baseQuery.hostelId = new mongoose.Types.ObjectId(filter.hostelId);
    if (filter.fromDate || filter.toDate) {
      baseQuery.createdAt = {};
      if (filter.fromDate) (baseQuery.createdAt as Record<string, Date>)['$gte'] = filter.fromDate;
      if (filter.toDate) (baseQuery.createdAt as Record<string, Date>)['$lte'] = filter.toDate;
    }

    const agg = await Complaint.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$finalClassification.categoryId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'complaintcategories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { count: -1 } },
    ]);

    const total = agg.reduce((sum, item) => sum + item.count, 0);

    return agg.map((item) => ({
      categoryId: item._id?.toString() || 'unknown',
      categoryName: item.category?.name || 'Unknown',
      count: item.count,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }

  /**
   * Get monthly complaint trend for the past 12 months
   */
  async getMonthlyTrend(hostelId?: string): Promise<IMonthlyTrend[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const baseQuery: Record<string, unknown> = {
      createdAt: { $gte: twelveMonthsAgo },
    };
    if (hostelId) baseQuery.hostelId = new mongoose.Types.ObjectId(hostelId);

    const agg = await Complaint.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    return agg.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      monthName: monthNames[item._id.month - 1],
      count: item.count,
      resolved: item.resolved,
    }));
  }

  /**
   * Get department performance metrics
   */
  async getDepartmentPerformance(): Promise<IDepartmentPerformance[]> {
    const agg = await Complaint.aggregate([
      {
        $match: {
          assignedDepartmentId: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$assignedDepartmentId',
          assigned: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0],
            },
          },
          overdue: {
            $sum: { $cond: ['$isOverdue', 1, 0] },
          },
          avgResolution: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['resolved', 'closed']] },
                    { $ne: ['$resolvedAt', null] },
                  ],
                },
                {
                  $divide: [
                    { $subtract: ['$resolvedAt', '$createdAt'] },
                    3600000,
                  ],
                },
                null,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $sort: { assigned: -1 } },
    ]);

    return agg.map((item) => ({
      departmentId: item._id?.toString() || 'unknown',
      departmentName: item.department?.name || 'Unknown',
      assigned: item.assigned,
      resolved: item.resolved,
      avgResolutionHours: item.avgResolution ? Math.round(item.avgResolution * 10) / 10 : 0,
      overdue: item.overdue,
    }));
  }

  /**
   * Get recurring issue data with trend analysis
   */
  async getRecurringIssueData(): Promise<{
    categories: Array<{ name: string; count: number; trend: 'increasing' | 'stable' | 'decreasing' }>;
    topLocations: Array<{ location: string; count: number }>;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Current period category counts
    const currentPeriod = await Complaint.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$finalClassification.categoryId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'complaintcategories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    ]);

    // Previous period category counts for trend comparison
    const previousPeriod = await Complaint.aggregate([
      {
        $match: {
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        },
      },
      { $group: { _id: '$finalClassification.categoryId', count: { $sum: 1 } } },
    ]);

    const prevMap: Record<string, number> = {};
    for (const p of previousPeriod) {
      if (p._id) prevMap[p._id.toString()] = p.count;
    }

    const categories = currentPeriod
      .filter((c) => c._id)
      .map((c) => {
        const prevCount = prevMap[c._id.toString()] || 0;
        let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
        if (c.count > prevCount * 1.2) trend = 'increasing';
        else if (c.count < prevCount * 0.8) trend = 'decreasing';

        return {
          name: c.category?.name || 'Unknown',
          count: c.count as number,
          trend,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Top complaint locations
    const locationAgg = await Complaint.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return {
      categories,
      topLocations: locationAgg.map((l) => ({
        location: l._id || 'Unknown',
        count: l.count,
      })),
    };
  }

  /**
   * Generate AI-powered insights from real analytics data
   */
  async generateAIInsights(hostelId?: string): Promise<IAIInsightsResponse> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const filter = {
        hostelId,
        fromDate: thirtyDaysAgo,
        toDate: new Date(),
      };

      const [overview, categoryDistribution, recurringData] = await Promise.all([
        this.getOverview(filter),
        this.getCategoryDistribution(filter),
        this.getRecurringIssueData(),
      ]);

      return aiService.generateInsights({
        overview,
        categoryDistribution,
        topLocations: recurringData.topLocations,
        recurringCategories: recurringData.categories,
        overdueCount: overview.overdue,
        period: {
          from: thirtyDaysAgo.toISOString(),
          to: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to generate AI insights:', error);
      return {
        insights: [],
        generatedAt: new Date().toISOString(),
        dataPoints: 0,
        hasEnoughData: false,
      };
    }
  }
}

export const analyticsService = new AnalyticsService();
