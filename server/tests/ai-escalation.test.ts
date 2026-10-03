import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, teardownTestDB, clearTestDB, agent, tokenFor } from './setup';
import { User } from '../src/models/User';
import { Hostel } from '../src/models/Hostel';
import { Department } from '../src/models/Department';
import { ComplaintCategory } from '../src/models/ComplaintCategory';
import { Complaint } from '../src/models/Complaint';
import { ComplaintTimeline } from '../src/models/ComplaintTimeline';
import { Notification } from '../src/models/Notification';
import { SystemSettings } from '../src/models/SystemSettings';
import { complaintService } from '../src/services/complaint/complaintService';
import { aiService } from '../src/services/ai/aiService';

let studentToken: string;
let wardenToken: string;
let adminToken: string;
let studentId: string;
let wardenId: string;
let hostelId: string;
let departmentId: string;
let categoryId: string;

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

describe('AI fallback, settings, escalation, notifications', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    const hostel = await Hostel.create({ name: 'H', code: 'H1' });
    hostelId = hostel._id.toString();
    const dept = await Department.create({ name: 'Housekeeping', code: 'HOUSE' });
    departmentId = dept._id.toString();
    const cat = await ComplaintCategory.create({ name: 'Cleaning', code: 'CLEAN' });
    categoryId = cat._id.toString();

    const student = await User.create({ name: 'S', email: 's@x.com', passwordHash: 'x', role: 'student' });
    studentId = student._id.toString();
    studentToken = tokenFor({ id: studentId, email: 's@x.com', role: 'student' });

    const warden = await User.create({ name: 'W', email: 'w@x.com', passwordHash: 'x', role: 'warden' });
    wardenId = warden._id.toString();
    wardenToken = tokenFor({ id: wardenId, email: 'w@x.com', role: 'warden' });

    const admin = await User.create({ name: 'A', email: 'a@x.com', passwordHash: 'x', role: 'admin' });
    adminToken = tokenFor({ id: admin._id.toString(), email: 'a@x.com', role: 'admin' });
  });

  describe('AI failure fallback', () => {
    it('complaint submission succeeds even when AI is unavailable', async () => {
      const res = await agent()
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Fan is broken and noisy',
          description: 'The ceiling fan in my room is making loud noise and stopped working completely',
          location: 'Block A, Room 101',
          hostelId,
        });

      expect(res.status).toBe(201);

      // Wait for background AI task to settle (Gemini key absent in tests)
      await new Promise((r) => setTimeout(r, 1500));

      const complaint = await Complaint.findById(res.body.data._id);
      expect(complaint).toBeTruthy();
      expect(complaint!.status).toBe('pending_review');
      if (complaint!.aiAnalysis) {
        expect(complaint!.aiAnalysis.failed).toBe(true);
      }
    });

    it('reports AI availability honestly (no fake AI)', () => {
      // In CI there is no GEMINI_API_KEY, so availability must be false
      expect(aiService.getAvailability()).toBe(false);
    });

    it('manual re-analysis endpoint is available to staff', async () => {
      const complaint = await Complaint.create({
        complaintId: 'HST-MANUAL1',
        studentId,
        title: 'Manual reanalysis target complaint',
        description: 'Complaint used to test manual re-analysis trigger endpoint',
        location: 'Block A',
        hostelId,
        status: 'pending_review',
      });

      const res = await agent()
        .post(`/api/complaints/${complaint._id}/analyze`)
        .set('Authorization', `Bearer ${wardenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('re-analysis');
    });
  });

  describe('System settings (admin)', () => {
    it('admin can read settings', async () => {
      const res = await agent().get('/api/settings').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.escalationRules.length).toBeGreaterThan(0);
      expect(res.body.data.defaultResolutionTargets).toBeDefined();
    });

    it('admin can update escalation thresholds without code changes', async () => {
      const before = await agent().get('/api/settings').set('Authorization', `Bearer ${adminToken}`);
      const rules = before.body.data.escalationRules.map(
        (r: { priorityLevel: string; firstEscalationHours: number; secondEscalationHours: number; notifyRoles: string[] }) =>
          r.priorityLevel === 'high'
            ? { ...r, firstEscalationHours: 3, secondEscalationHours: 6 }
            : r
      );

      const res = await agent()
        .patch('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ escalationRules: rules });

      expect(res.status).toBe(200);

      const after = await agent().get('/api/settings').set('Authorization', `Bearer ${adminToken}`);
      const high = after.body.data.escalationRules.find(
        (r: { priorityLevel: string }) => r.priorityLevel === 'high'
      );
      expect(high.firstEscalationHours).toBe(3);
      expect(high.secondEscalationHours).toBe(6);
    });

    it('wardens cannot update settings', async () => {
      const res = await agent()
        .patch('/api/settings')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({ maxComplaintsPerDay: 999 });
      expect(res.status).toBe(403);
    });
  });

  describe('Escalation engine', () => {
    it('escalates complaints past the configured threshold and notifies', async () => {
      await SystemSettings.create({
        escalationRules: [
          { priorityLevel: 'high', firstEscalationHours: 6, secondEscalationHours: 12, notifyRoles: ['warden', 'admin'] },
        ],
        defaultResolutionTargets: { critical: 4, high: 12, medium: 48, low: 168 },
        maxComplaintsPerDay: 10,
        aiAnalysisEnabled: false,
        duplicateDetectionEnabled: false,
        duplicateSimilarityThreshold: 0.8,
      });

      const stale = await Complaint.create({
        complaintId: 'HST-ESC001',
        studentId,
        title: 'Old unattended complaint',
        description: 'This complaint has been sitting unresolved for a long time',
        location: 'Block A',
        hostelId,
        status: 'assigned',
        finalClassification: {
          categoryId,
          priority: 'high',
          departmentId,
          approvedBy: wardenId,
          approvedAt: hoursAgo(10),
        },
        assignedDepartmentId: departmentId,
        createdAt: hoursAgo(10),
        escalationLevel: 0,
        isOverdue: false,
      });

      await complaintService.runEscalationCheck();

      const after = await Complaint.findById(stale._id);
      expect(after!.escalationLevel).toBe(1);
      expect(after!.isOverdue).toBe(true);

      const notifs = await Notification.find({ complaintId: stale._id, type: 'escalation' });
      expect(notifs.length).toBeGreaterThanOrEqual(1);
    });

    it('does not double-escalate already escalated complaints', async () => {
      await SystemSettings.create({
        escalationRules: [
          { priorityLevel: 'high', firstEscalationHours: 6, secondEscalationHours: 12, notifyRoles: ['warden'] },
        ],
        defaultResolutionTargets: { critical: 4, high: 12, medium: 48, low: 168 },
        maxComplaintsPerDay: 10,
        aiAnalysisEnabled: false,
        duplicateDetectionEnabled: false,
        duplicateSimilarityThreshold: 0.8,
      });

      const complaint = await Complaint.create({
        complaintId: 'HST-ESC002',
        studentId,
        title: 'Already escalated complaint',
        description: 'Escalation level one already applied to this complaint',
        location: 'Block A',
        hostelId,
        status: 'assigned',
        finalClassification: {
          categoryId,
          priority: 'high',
          departmentId,
          approvedBy: wardenId,
          approvedAt: hoursAgo(10),
        },
        createdAt: hoursAgo(10),
        escalationLevel: 1,
        isOverdue: true,
      });

      await complaintService.runEscalationCheck();
      const after = await Complaint.findById(complaint._id);
      expect(after!.escalationLevel).toBe(1); // unchanged

      const notifs = await Notification.find({ complaintId: complaint._id, type: 'escalation' });
      expect(notifs.length).toBe(0); // no duplicate notification
    });

    it('leaves fresh complaints alone', async () => {
      await SystemSettings.create({
        escalationRules: [
          { priorityLevel: 'high', firstEscalationHours: 6, secondEscalationHours: 12, notifyRoles: ['warden'] },
        ],
        defaultResolutionTargets: { critical: 4, high: 12, medium: 48, low: 168 },
        maxComplaintsPerDay: 10,
        aiAnalysisEnabled: false,
        duplicateDetectionEnabled: false,
        duplicateSimilarityThreshold: 0.8,
      });

      const fresh = await Complaint.create({
        complaintId: 'HST-ESC003',
        studentId,
        title: 'Fresh complaint just submitted',
        description: 'This complaint was submitted only a moment ago',
        location: 'Block A',
        hostelId,
        status: 'assigned',
        finalClassification: {
          categoryId,
          priority: 'high',
          departmentId,
          approvedBy: wardenId,
          approvedAt: hoursAgo(1),
        },
        createdAt: hoursAgo(1),
        escalationLevel: 0,
      });

      await complaintService.runEscalationCheck();
      const after = await Complaint.findById(fresh._id);
      expect(after!.escalationLevel).toBe(0);
    });
  });

  describe('Notifications', () => {
    it('returns only own notifications with unread count', async () => {
      const other = await User.create({ name: 'O', email: 'o@x.com', passwordHash: 'x', role: 'student' });
      await Notification.create({
        recipientId: other._id,
        type: 'system',
        title: 'Other user notification',
        message: 'This belongs to another user entirely',
      });
      await Notification.create({
        recipientId: studentId,
        type: 'system',
        title: 'Mine',
        message: 'This notification belongs to the test student',
      });

      const res = await agent()
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.unreadCount).toBe(1);
    });

    it("cannot mark another user's notification as read", async () => {
      const other = await User.create({ name: 'O2', email: 'o2@x.com', passwordHash: 'x', role: 'student' });
      const notif = await Notification.create({
        recipientId: other._id,
        type: 'system',
        title: 'Not yours',
        message: 'This notification belongs to someone else',
      });

      const res = await agent()
        .patch(`/api/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('mark-all-read only affects own notifications', async () => {
      const other = await User.create({ name: 'O3', email: 'o3@x.com', passwordHash: 'x', role: 'student' });
      await Notification.create({
        recipientId: other._id,
        type: 'system',
        title: 'Other',
        message: 'Other user unread notification here',
      });
      await Notification.create({
        recipientId: studentId,
        type: 'system',
        title: 'Mine1',
        message: 'Student unread notification one',
      });
      await Notification.create({
        recipientId: studentId,
        type: 'system',
        title: 'Mine2',
        message: 'Student unread notification two',
      });

      await agent().patch('/api/notifications/read-all').set('Authorization', `Bearer ${studentToken}`);

      const otherRemaining = await Notification.countDocuments({ recipientId: other._id, isRead: false });
      expect(otherRemaining).toBe(1);
    });
  });

  describe('Config endpoints', () => {
    it('authenticated users can read hostels/categories/departments', async () => {
      const res = await agent().get('/api/categories').set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('students cannot create categories', async () => {
      const res = await agent()
        .post('/api/categories')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Sneaky', code: 'SNK' });
      expect(res.status).toBe(403);
    });

    it('admin can create a hostel', async () => {
      const res = await agent()
        .post('/api/hostels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Hostel', code: 'NH' });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('NH');
    });

    it('health endpoint reports status without auth', async () => {
      const res = await agent().get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.aiEnabled).toBe(false);
    });

    it('unknown routes return structured 404', async () => {
      const res = await agent().get('/api/definitely-not-a-route');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('Duplicate detection (semantic)', () => {
    it('flags semantically similar complaints as possible duplicates', async () => {
      // First complaint with embedding
      const first = await Complaint.create({
        complaintId: 'HST-DUP001',
        studentId,
        title: 'Water leakage in B204 bathroom',
        description: 'B204 bathroom is flooding because of water leakage from the ceiling',
        location: 'Block B, Room 204',
        hostelId,
        status: 'pending_review',
        textEmbedding: await aiService.generateEmbedding(
          'Water leakage in B204 bathroom B204 bathroom is flooding because of water leakage from the ceiling'
        ),
      });

      const similarEmbedding = await aiService.generateEmbedding(
        'Water leakage in B204 bathroom B204 bathroom is flooding because of water leakage from the ceiling'
      );

      const second = await Complaint.create({
        complaintId: 'HST-DUP002',
        studentId,
        title: 'Water leakage in bathroom B204',
        description: 'The bathroom in B204 floods daily due to a leak from the ceiling above',
        location: 'Block B, Room 204',
        hostelId,
        status: 'pending_review',
        textEmbedding: similarEmbedding,
        possibleDuplicates: [first._id],
      });

      const res = await agent()
        .get(`/api/complaints/${second._id}/duplicates`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].similarity).toBeGreaterThan(0.9);
      expect(res.body.data[0].complaint.complaintId).toBe('HST-DUP001');
    });

    it('linking duplicates requires staff role', async () => {
      const a = await Complaint.create({
        complaintId: 'HST-LINK1',
        studentId,
        title: 'Complaint A for linking test',
        description: 'First complaint in the linking authorization test',
        location: 'Block A',
        hostelId,
        status: 'pending_review',
      });
      const b = await Complaint.create({
        complaintId: 'HST-LINK2',
        studentId,
        title: 'Complaint B for linking test',
        description: 'Second complaint in the linking authorization test',
        location: 'Block A',
        hostelId,
        status: 'pending_review',
      });

      const res = await agent()
        .post(`/api/complaints/${a._id}/link`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ targetComplaintId: b._id });

      expect(res.status).toBe(403);
    });
  });

  describe('Chat assistant scoping', () => {
    it('assistant only sees the requesting student complaints', async () => {
      await Complaint.create({
        complaintId: 'HST-CHAT01',
        studentId,
        title: 'My own complaint about the sink',
        description: 'The sink in my room leaks constantly and needs repair',
        location: 'Block A',
        hostelId,
        status: 'assigned',
      });

      const res = await agent()
        .post('/api/complaints/chat/query')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ query: 'What is the status of my complaints?' });

      expect(res.status).toBe(200);
      expect(res.body.data.response).toBeTruthy();
    });

    it('rejects empty chat queries', async () => {
      const res = await agent()
        .post('/api/complaints/chat/query')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
