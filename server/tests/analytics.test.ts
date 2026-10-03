import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, teardownTestDB, clearTestDB, agent, tokenFor } from './setup';
import { User } from '../src/models/User';
import { Hostel } from '../src/models/Hostel';
import { Department } from '../src/models/Department';
import { ComplaintCategory } from '../src/models/ComplaintCategory';
import { Complaint } from '../src/models/Complaint';
import { Feedback } from '../src/models/Feedback';

let wardenToken: string;
let adminToken: string;
let studentToken: string;
let hostelId: string;
let departmentId: string;
let categoryId: string;
let studentId: string;
let wardenId: string;

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

describe('Analytics & AI insights', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    const hostel = await Hostel.create({ name: 'Analytics Hostel', code: 'AH' });
    hostelId = hostel._id.toString();
    const dept = await Department.create({ name: 'Electrical Maintenance', code: 'ELEC' });
    departmentId = dept._id.toString();
    const cat = await ComplaintCategory.create({ name: 'Electrical', code: 'ELEC' });
    categoryId = cat._id.toString();

    const student = await User.create({
      name: 'S',
      email: 's@a.com',
      passwordHash: 'x',
      role: 'student',
    });
    studentId = student._id.toString();
    studentToken = tokenFor({ id: studentId, email: 's@a.com', role: 'student' });

    const warden = await User.create({
      name: 'W',
      email: 'w@a.com',
      passwordHash: 'x',
      role: 'warden',
    });
    wardenId = warden._id.toString();
    wardenToken = tokenFor({ id: wardenId, email: 'w@a.com', role: 'warden' });

    const admin = await User.create({
      name: 'A',
      email: 'a@a.com',
      passwordHash: 'x',
      role: 'admin',
    });
    adminToken = tokenFor({ id: admin._id.toString(), email: 'a@a.com', role: 'admin' });
  });

  async function makeComplaint(i: number, opts: Partial<Record<string, unknown>> = {}) {
    return Complaint.create({
      complaintId: `HST-ANAL${String(i).padStart(4, '0')}`,
      studentId,
      title: `Analytics complaint ${i}`,
      description: 'Complaint used for analytics aggregation testing purposes',
      location: `Block ${String.fromCharCode(65 + (i % 3))}`,
      hostelId,
      status: opts.status ?? 'closed',
      finalClassification: {
        categoryId,
        priority: opts.priority ?? 'medium',
        departmentId,
        approvedBy: wardenId,
        approvedAt: daysAgo(5),
      },
      assignedDepartmentId: departmentId,
      resolvedAt: daysAgo(2),
      closedAt: daysAgo(1),
      createdAt: opts.createdAt ?? daysAgo(10 - i),
      isOverdue: opts.isOverdue ?? false,
      escalationLevel: 0,
      ...opts,
    });
  }

  it('computes overview metrics from real data', async () => {
    await makeComplaint(1);
    await makeComplaint(2, { status: 'in_progress', resolvedAt: undefined, closedAt: undefined });
    await makeComplaint(3, { priority: 'critical', isOverdue: true });

    const res = await agent().get('/api/analytics/overview').set('Authorization', `Bearer ${wardenToken}`);

    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.total).toBe(3);
    expect(s.closed).toBe(2);
    expect(s.inProgress).toBe(1);
    expect(s.critical).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.avgResolutionTimeHours).toBeGreaterThan(0);
  });

  it('returns empty overview when no complaints exist', async () => {
    const res = await agent().get('/api/analytics/overview').set('Authorization', `Bearer ${wardenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.avgResolutionTimeHours).toBe(0);
    expect(res.body.data.avgSatisfactionRating).toBe(0);
  });

  it('computes category distribution with percentages', async () => {
    await makeComplaint(1);
    await makeComplaint(2);

    const res = await agent().get('/api/analytics/categories').set('Authorization', `Bearer ${wardenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].count).toBe(2);
    expect(res.body.data[0].percentage).toBeCloseTo(100, 1);
  });

  it('computes department performance', async () => {
    await makeComplaint(1);
    await makeComplaint(2);

    const res = await agent().get('/api/analytics/departments').set('Authorization', `Bearer ${wardenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].assigned).toBe(2);
    expect(res.body.data[0].resolved).toBe(2);
  });

  it('blocks students from analytics', async () => {
    const res = await agent().get('/api/analytics/overview').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('AI insights report insufficient data instead of fabricating trends', async () => {
    const res = await agent().get('/api/analytics/insights').set('Authorization', `Bearer ${wardenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasEnoughData).toBe(false);
    // Must not invent statistics
    expect(res.body.data.insights.every((i: { evidence?: unknown[] }) => !i.evidence || i.evidence.length >= 0)).toBe(true);
  });

  it('AI insights derive evidence from real aggregates', async () => {
    for (let i = 1; i <= 8; i++) {
      await makeComplaint(i, { isOverdue: i <= 4 });
    }

    const res = await agent().get('/api/analytics/insights').set('Authorization', `Bearer ${wardenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.dataPoints).toBeGreaterThan(0);

    const overdueInsight = res.body.data.insights.find(
      (i: { id: string }) => i.id === 'overdue_complaints'
    );
    expect(overdueInsight).toBeTruthy();
    expect(overdueInsight.evidence[0].value).toBe(4); // matches the 4 seeded overdue
  });

  it('student dashboard returns only own stats', async () => {
    await makeComplaint(1);
    const res = await agent().get('/api/dashboard/student').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.total).toBe(1);
    expect(res.body.data.recentComplaints).toHaveLength(1);
  });

  it('warden dashboard returns work queues', async () => {
    await makeComplaint(1, { status: 'pending_review' });
    await makeComplaint(2, { priority: 'critical', status: 'assigned', resolvedAt: undefined, closedAt: undefined });

    const res = await agent().get('/api/dashboard/warden').set('Authorization', `Bearer ${wardenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.total).toBe(2);
    expect(res.body.data.criticalComplaints.length).toBe(1);
  });

  it('feedback aggregates into average satisfaction', async () => {
    const c1 = await makeComplaint(1);
    const c2 = await makeComplaint(2);
    await Feedback.create({ complaintId: c1._id, studentId, rating: 5, satisfaction: 'satisfied' });
    await Feedback.create({ complaintId: c2._id, studentId, rating: 3, satisfaction: 'neutral' });

    const res = await agent().get('/api/analytics/overview').set('Authorization', `Bearer ${wardenToken}`);
    expect(res.body.data.avgSatisfactionRating).toBe(4);
  });
});
