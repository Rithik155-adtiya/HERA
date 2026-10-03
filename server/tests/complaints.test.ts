import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB, clearTestDB, agent, tokenFor } from './setup';
import { User } from '../src/models/User';
import { Hostel, Block } from '../src/models/Hostel';
import { Department } from '../src/models/Department';
import { ComplaintCategory } from '../src/models/ComplaintCategory';
import { Complaint } from '../src/models/Complaint';
import { Feedback } from '../src/models/Feedback';
import { Notification } from '../src/models/Notification';
import { SystemSettings } from '../src/models/SystemSettings';
import { VALID_STATUS_TRANSITIONS } from '../../shared/src/constants';

let studentToken: string;
let studentId: string;
let wardenToken: string;
let wardenId: string;
let hostelId: string;
let departmentId: string;
let categoryId: string;

async function seedBasics() {
  const hostel = await Hostel.create({ name: 'Test Hostel', code: 'TH' });
  hostelId = hostel._id.toString();
  const dept = await Department.create({ name: 'Plumbing Maintenance', code: 'PLUMB' });
  departmentId = dept._id.toString();
  const cat = await ComplaintCategory.create({
    name: 'Plumbing',
    code: 'PLUMB',
    defaultDepartmentId: dept._id,
  });
  categoryId = cat._id.toString();

  const student = await User.create({
    name: 'Student',
    email: 'student@test.com',
    passwordHash: 'x',
    role: 'student',
    hostelId: hostel._id,
  });
  studentId = student._id.toString();
  studentToken = tokenFor({ id: studentId, email: student.email, role: 'student' });

  const warden = await User.create({
    name: 'Warden',
    email: 'warden@test.com',
    passwordHash: 'x',
    role: 'warden',
    hostelId: hostel._id,
  });
  wardenId = warden._id.toString();
  wardenToken = tokenFor({ id: wardenId, email: warden.email, role: 'warden' });
}

async function createComplaint(overrides: Record<string, unknown> = {}) {
  const res = await agent()
    .post('/api/complaints')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      title: 'Water leaking from bathroom ceiling',
      description:
        'There is water leaking from the bathroom ceiling in Block B Room 204 and the floor is getting flooded.',
      location: 'Block B, Room 204, Bathroom',
      hostelId,
      ...overrides,
    });
  return res;
}

describe('Complaint workflow', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await seedBasics();
  });

  it('student creates a complaint with a server-generated HST ID', async () => {
    const res = await createComplaint();

    expect(res.status).toBe(201);
    expect(res.body.data.complaintId).toMatch(/^HST-/);
    expect(res.body.data.status).toBe('submitted');

    const stored = await Complaint.findById(res.body.data._id);
    expect(stored).toBeTruthy();
    expect(stored!.complaintId).toMatch(/^HST-/);
  });

  it('rejects complaints with invalid payloads', async () => {
    const res = await agent()
      .post('/api/complaints')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'x', description: 'y', location: '', hostelId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication to create complaints', async () => {
    const res = await agent().post('/api/complaints').send({
      title: 'No auth here at all',
      description: 'This should be rejected before any validation happens',
      location: 'Nowhere',
      hostelId,
    });
    expect(res.status).toBe(401);
  });

  it('creates a timeline event on submission', async () => {
    const res = await createComplaint();
    const { ComplaintTimeline } = await import('../src/models/ComplaintTimeline');
    const events = await ComplaintTimeline.find({ complaintId: res.body.data._id });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].action).toBe('complaint_submitted');
  });

  it('student can only see their own complaints in list', async () => {
    const other = await User.create({
      name: 'Other',
      email: 'other@test.com',
      passwordHash: 'x',
      role: 'student',
    });
    await Complaint.create({
      complaintId: 'HST-OTHER01',
      studentId: other._id,
      title: 'Other student problem here',
      description: 'This belongs to a different student entirely',
      location: 'Block C',
      hostelId,
      status: 'submitted',
    });

    await createComplaint();

    const res = await agent()
      .get('/api/complaints')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].studentId).toBeDefined();
  });

  it('student can view their own complaint details with timeline', async () => {
    const created = await createComplaint();
    const res = await agent()
      .get(`/api/complaints/${created.body.data._id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.complaint.complaintId).toMatch(/^HST-/);
    expect(res.body.data.timeline.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.feedback).toBeNull();
  });

  it("student cannot open another student's complaint by ID", async () => {
    const other = await User.create({
      name: 'Other2',
      email: 'other2@test.com',
      passwordHash: 'x',
      role: 'student',
    });
    const foreign = await Complaint.create({
      complaintId: 'HST-FOREIGN',
      studentId: other._id,
      title: 'Foreign complaint title',
      description: 'Belongs to someone else entirely ok',
      location: 'Block D',
      hostelId,
      status: 'submitted',
    });

    const res = await agent()
      .get(`/api/complaints/${foreign._id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a non-existent complaint ID', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await agent()
      .get(`/api/complaints/${fakeId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(404);
  });

  it('warden can approve AI classification (human-in-the-loop)', async () => {
    const created = await createComplaint();
    const id = created.body.data._id;

    const res = await agent()
      .post(`/api/complaints/${id}/approve-ai`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({
        categoryId,
        priority: 'high',
        departmentId,
        reason: 'Confirmed water leakage is high priority',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.finalClassification.priority).toBe('high');
    expect(res.body.data.finalClassification.approvedBy).toBeDefined();

    const { ComplaintTimeline } = await import('../src/models/ComplaintTimeline');
    const events = await ComplaintTimeline.find({ complaintId: id });
    expect(events.some((e) => e.action === 'ai_classification_approved')).toBe(true);
  });

  it('students cannot approve AI classification', async () => {
    const created = await createComplaint();
    const res = await agent()
      .post(`/api/complaints/${created.body.data._id}/approve-ai`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ categoryId, priority: 'high', departmentId });
    expect(res.status).toBe(403);
  });

  it('enforces the status state machine (closed -> assigned is rejected)', async () => {
    const complaint = await Complaint.create({
      complaintId: 'HST-CLOSED1',
      studentId,
      title: 'Already closed complaint here',
      description: 'This complaint has already been closed previously',
      location: 'Block A',
      hostelId,
      status: 'closed',
      finalClassification: { categoryId, priority: 'low', departmentId, approvedBy: wardenId, approvedAt: new Date() },
    });

    const res = await agent()
      .post(`/api/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ status: 'assigned' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('allows valid transitions (assigned -> in_progress)', async () => {
    const complaint = await Complaint.create({
      complaintId: 'HST-ASSIGN1',
      studentId,
      title: 'Assigned complaint for transition',
      description: 'This complaint is currently in assigned status',
      location: 'Block A',
      hostelId,
      status: 'assigned',
      finalClassification: { categoryId, priority: 'low', departmentId, approvedBy: wardenId, approvedAt: new Date() },
    });

    const res = await agent()
      .post(`/api/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ status: 'in_progress', comment: 'Work started' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('students cannot set arbitrary statuses', async () => {
    const created = await createComplaint();
    const res = await agent()
      .post(`/api/complaints/${created.body.data._id}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(403);
  });

  it('staff assigns a complaint and notifies staff + student', async () => {
    const created = await createComplaint();
    const id = created.body.data._id;

    const staff = await User.create({
      name: 'Plumber',
      email: 'plumber@test.com',
      passwordHash: 'x',
      role: 'warden',
      departmentId,
    });

    const res = await agent()
      .post(`/api/complaints/${id}/assign`)
      .set('Authorization', `Bearer ${wardenToken}`)
      .send({ staffId: staff._id.toString(), departmentId, note: 'Urgent leak' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('assigned');
    expect(res.body.data.assignedStaffId).toBeDefined();

    const notifs = await Notification.find({ complaintId: id });
    expect(notifs.length).toBeGreaterThanOrEqual(2); // staff + student
  });

  it('student reopens a closed complaint with a reason', async () => {
    const complaint = await Complaint.create({
      complaintId: 'HST-REOPEN1',
      studentId,
      title: 'Complaint to be reopened now',
      description: 'This complaint will be reopened by the student',
      location: 'Block A',
      hostelId,
      status: 'closed',
    });

    const res = await agent()
      .post(`/api/complaints/${complaint._id}/reopen`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ reason: 'The leak started again after two days' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reopened');
  });

  it('reopen requires a meaningful reason', async () => {
    const complaint = await Complaint.create({
      complaintId: 'HST-REOPEN2',
      studentId,
      title: 'Complaint with short reopen reason',
      description: 'This complaint reopen attempt uses a short reason',
      location: 'Block A',
      hostelId,
      status: 'closed',
    });

    const res = await agent()
      .post(`/api/complaints/${complaint._id}/reopen`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ reason: 'no' });

    expect(res.status).toBe(400);
  });

  it('student submits feedback for a resolved complaint and it closes', async () => {
    const complaint = await Complaint.create({
      complaintId: 'HST-FEEDBK1',
      studentId,
      title: 'Resolved complaint for feedback',
      description: 'This complaint has been resolved and awaits feedback',
      location: 'Block A',
      hostelId,
      status: 'pending_confirmation',
      resolvedAt: new Date(),
    });

    const res = await agent()
      .post(`/api/complaints/${complaint._id}/feedback`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rating: 5, comment: 'Great work!', satisfaction: 'satisfied' });

    expect(res.status).toBe(201);
    const stored = await Feedback.findOne({ complaintId: complaint._id });
    expect(stored!.rating).toBe(5);

    const after = await Complaint.findById(complaint._id);
    expect(after!.status).toBe('closed');
  });

  it("cannot submit feedback for another student's complaint", async () => {
    const other = await User.create({
      name: 'Other3',
      email: 'other3@test.com',
      passwordHash: 'x',
      role: 'student',
    });
    const complaint = await Complaint.create({
      complaintId: 'HST-FEEDBK2',
      studentId: other._id,
      title: 'Not my complaint at all',
      description: 'This complaint belongs to a different student',
      location: 'Block A',
      hostelId,
      status: 'resolved',
      resolvedAt: new Date(),
    });

    const res = await agent()
      .post(`/api/complaints/${complaint._id}/feedback`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rating: 3, satisfaction: 'neutral' });

    expect(res.status).toBe(403);
  });

  it('rejects duplicate feedback', async () => {
    const complaint = await Complaint.create({
      complaintId: 'HST-FEEDBK3',
      studentId,
      title: 'Complaint with existing feedback',
      description: 'Feedback has already been submitted for this one',
      location: 'Block A',
      hostelId,
      status: 'resolved',
      resolvedAt: new Date(),
    });
    await Feedback.create({
      complaintId: complaint._id,
      studentId,
      rating: 4,
      satisfaction: 'satisfied',
    });

    const res = await agent()
      .post(`/api/complaints/${complaint._id}/feedback`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rating: 2, satisfaction: 'unsatisfied' });

    expect(res.status).toBe(409);
  });

  it('server-side filters and pagination work', async () => {
    for (let i = 0; i < 3; i++) {
      await Complaint.create({
        complaintId: `HST-FILT0${i}`,
        studentId,
        title: `Filtered complaint number ${i}`,
        description: 'Complaint created for filter testing purposes',
        location: 'Block X',
        hostelId,
        status: i === 0 ? 'closed' : 'in_progress',
        finalClassification: {
          categoryId,
          priority: i === 0 ? 'low' : 'critical',
          departmentId,
          approvedBy: wardenId,
          approvedAt: new Date(),
        },
      });
    }

    const res = await agent()
      .get('/api/complaints?status=in_progress&limit=2&page=1&priority=critical')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.limit).toBe(2);
  });

  it('search matches complaint ID and title', async () => {
    await createComplaint({ title: 'Unique searchable fan issue title' });
    const res = await agent()
      .get('/api/complaints?search=Unique searchable')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
  });

  it('status transition table covers all statuses', () => {
    const statuses = Object.keys(VALID_STATUS_TRANSITIONS);
    expect(statuses).toContain('submitted');
    expect(statuses).toContain('closed');
    expect(statuses).toContain('escalated');
    expect(statuses).toContain('reopened');
  });

  it('daily complaint limit is enforced from settings', async () => {
    await SystemSettings.create({
      escalationRules: [],
      defaultResolutionTargets: { critical: 4, high: 12, medium: 48, low: 168 },
      maxComplaintsPerDay: 2,
      aiAnalysisEnabled: false,
      duplicateDetectionEnabled: false,
      duplicateSimilarityThreshold: 0.8,
    });

    await createComplaint();
    await createComplaint();
    const third = await createComplaint();

    expect(third.status).toBe(429);
    expect(third.body.code).toBe('DAILY_LIMIT');
  });
});
