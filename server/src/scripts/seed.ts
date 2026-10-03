/**
 * HERA Development Seed Script
 * Creates realistic demo data for development/testing
 * 
 * Usage: npm run seed --workspace=server
 * 
 * Demo accounts created:
 * student@hera.dev / Student@123
 * student2@hera.dev / Student@123
 * warden@hera.dev / Warden@123
 * admin@hera.dev / Admin@123
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Hostel, Block, Room } from '../models/Hostel';
import { Department } from '../models/Department';
import { ComplaintCategory } from '../models/ComplaintCategory';
import { Complaint } from '../models/Complaint';
import { ComplaintTimeline } from '../models/ComplaintTimeline';
import { Notification } from '../models/Notification';
import { Feedback } from '../models/Feedback';
import { SystemSettings } from '../models/SystemSettings';
import { generateComplaintId } from '../utils/helpers';

async function seed() {
  console.log('🌱 Starting HERA seed script...');

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env file');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data (dev only!)
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Hostel.deleteMany({}),
    Block.deleteMany({}),
    Room.deleteMany({}),
    Department.deleteMany({}),
    ComplaintCategory.deleteMany({}),
    Complaint.deleteMany({}),
    ComplaintTimeline.deleteMany({}),
    Notification.deleteMany({}),
    Feedback.deleteMany({}),
    SystemSettings.deleteMany({}),
  ]);
  console.log('✅ Cleared existing data');

  // ========== SYSTEM SETTINGS ==========
  await SystemSettings.create({
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
  console.log('✅ System settings created');

  // ========== DEPARTMENTS ==========
  const deptData = [
    { name: 'Plumbing Maintenance', code: 'PLUMB', description: 'Water supply, drainage, and plumbing repairs' },
    { name: 'Electrical Maintenance', code: 'ELEC', description: 'Electrical systems and lighting repairs' },
    { name: 'Housekeeping', code: 'HOUSE', description: 'Cleaning and sanitation services' },
    { name: 'IT Support', code: 'IT', description: 'Internet connectivity and tech support' },
    { name: 'Mess Management', code: 'MESS', description: 'Cafeteria and food quality management' },
    { name: 'Security', code: 'SEC', description: 'Hostel security and safety' },
    { name: 'General Maintenance', code: 'GEN', description: 'Furniture, infrastructure, and general repairs' },
    { name: 'Administration', code: 'ADMIN', description: 'Hostel administration and management' },
  ];
  const departments = await Department.insertMany(deptData);
  const deptMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const d of departments) {
    deptMap[d.code] = d._id as mongoose.Types.ObjectId;
  }
  console.log('✅ Departments created');

  // ========== COMPLAINT CATEGORIES ==========
  const categoryData = [
    { name: 'Plumbing', code: 'PLUMB', description: 'Water leakage, tap issues, drainage problems', defaultDepartmentId: deptMap['PLUMB'] },
    { name: 'Electrical', code: 'ELEC', description: 'Power outage, lighting, wiring issues', defaultDepartmentId: deptMap['ELEC'] },
    { name: 'Cleaning', code: 'CLEAN', description: 'Room/bathroom cleanliness, garbage collection', defaultDepartmentId: deptMap['HOUSE'] },
    { name: 'Internet', code: 'NET', description: 'Wi-Fi connectivity, network issues', defaultDepartmentId: deptMap['IT'] },
    { name: 'Food & Mess', code: 'FOOD', description: 'Food quality, timing, mess management', defaultDepartmentId: deptMap['MESS'] },
    { name: 'Furniture', code: 'FURN', description: 'Damaged furniture, beds, study tables', defaultDepartmentId: deptMap['GEN'] },
    { name: 'Room Condition', code: 'ROOM', description: 'Walls, flooring, ceiling, doors, windows', defaultDepartmentId: deptMap['GEN'] },
    { name: 'Fan/AC', code: 'FANAC', description: 'Fan or AC not working, temperature issues', defaultDepartmentId: deptMap['ELEC'] },
    { name: 'Sanitation', code: 'SANIT', description: 'Washroom hygiene, toilet issues', defaultDepartmentId: deptMap['HOUSE'] },
    { name: 'Security', code: 'SEC', description: 'Gate, lock, safety concerns', defaultDepartmentId: deptMap['SEC'] },
    { name: 'Other', code: 'OTHER', description: 'Miscellaneous issues', defaultDepartmentId: deptMap['ADMIN'] },
  ];
  const categories = await ComplaintCategory.insertMany(categoryData);
  const catMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const c of categories) {
    catMap[c.code] = c._id as mongoose.Types.ObjectId;
  }
  console.log('✅ Complaint categories created');

  // ========== HOSTELS ==========
  const hostelA = await Hostel.create({ name: 'Boys Hostel Alpha', code: 'BHA' });
  const hostelB = await Hostel.create({ name: 'Boys Hostel Beta', code: 'BHB' });
  console.log('✅ Hostels created');

  // ========== BLOCKS ==========
  const blocks = await Block.insertMany([
    { hostelId: hostelA._id, name: 'Block A', code: 'A' },
    { hostelId: hostelA._id, name: 'Block B', code: 'B' },
    { hostelId: hostelA._id, name: 'Block C', code: 'C' },
    { hostelId: hostelB._id, name: 'Block D', code: 'D' },
    { hostelId: hostelB._id, name: 'Block E', code: 'E' },
  ]);
  const blockA = blocks[0];
  const blockB = blocks[1];
  console.log('✅ Blocks created');

  // ========== ROOMS ==========
  const rooms = await Room.insertMany([
    { blockId: blockA._id, roomNumber: '101', capacity: 2 },
    { blockId: blockA._id, roomNumber: '102', capacity: 2 },
    { blockId: blockA._id, roomNumber: '103', capacity: 3 },
    { blockId: blockB._id, roomNumber: '201', capacity: 2 },
    { blockId: blockB._id, roomNumber: '202', capacity: 2 },
    { blockId: blockB._id, roomNumber: '203', capacity: 2 },
    { blockId: blockB._id, roomNumber: '204', capacity: 3 },
    { blockId: blockB._id, roomNumber: '205', capacity: 2 },
  ]);
  const room204 = rooms[6];
  console.log('✅ Rooms created');

  // ========== USERS ==========
  const hashPassword = async (pw: string) => bcrypt.hash(pw, 12);

  const [wardenUser, student1, student2, maintenanceStaff, plumbingStaff, electricianStaff] =
    await Promise.all([
      User.create({
        name: 'Admin User',
        email: 'admin@hera.dev',
        passwordHash: await hashPassword('Admin@123'),
        role: 'admin',
        isActive: true,
      }),
      User.create({
        name: 'Rajesh Warden',
        email: 'warden@hera.dev',
        passwordHash: await hashPassword('Warden@123'),
        role: 'warden',
        hostelId: hostelA._id,
        isActive: true,
      }),
      User.create({
        name: 'Arjun Kumar',
        email: 'student@hera.dev',
        passwordHash: await hashPassword('Student@123'),
        role: 'student',
        hostelId: hostelA._id,
        blockId: blockB._id,
        roomId: room204._id,
        isActive: true,
      }),
      User.create({
        name: 'Priya Singh',
        email: 'student2@hera.dev',
        passwordHash: await hashPassword('Student@123'),
        role: 'student',
        hostelId: hostelA._id,
        blockId: blockB._id,
        roomId: rooms[4]._id,
        isActive: true,
      }),
      User.create({
        name: 'Suresh Maintenance',
        email: 'maintenance@hera.dev',
        passwordHash: await hashPassword('Staff@123'),
        role: 'warden',
        departmentId: deptMap['GEN'],
        isActive: true,
      }),
      User.create({
        name: 'Ramesh Plumber',
        email: 'plumber@hera.dev',
        passwordHash: await hashPassword('Staff@123'),
        role: 'warden',
        departmentId: deptMap['PLUMB'],
        isActive: true,
      }),
      User.create({
        name: 'Kiran Electrician',
        email: 'electrician@hera.dev',
        passwordHash: await hashPassword('Staff@123'),
        role: 'warden',
        departmentId: deptMap['ELEC'],
        isActive: true,
      }),
      User.create({
        name: 'Meena Housekeeping',
        email: 'housekeeping@hera.dev',
        passwordHash: await hashPassword('Staff@123'),
        role: 'warden',
        departmentId: deptMap['HOUSE'],
        isActive: true,
      }),
    ]);
  console.log('✅ Users created');

  // ========== COMPLAINTS ==========
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

  // Complaint 1: Water leakage - Closed with feedback (demo story)
  const complaint1 = await Complaint.create({
    complaintId: generateComplaintId(),
    studentId: student1._id,
    title: 'Water leaking from bathroom ceiling',
    description: 'There is water leaking from the bathroom ceiling in Block B Room 204. The floor is getting flooded and it is becoming very slippery. Please fix it urgently.',
    location: 'Block B, Room 204, Bathroom',
    hostelId: hostelA._id,
    blockId: blockB._id,
    roomId: room204._id,
    aiAnalysis: {
      summary: 'Bathroom ceiling water leakage causing floor flooding in Block B Room 204, creating a slip hazard.',
      categoryId: catMap['PLUMB'],
      subCategory: 'Water Leakage',
      priority: 'high',
      departmentId: deptMap['PLUMB'],
      possibleSafetyRisk: true,
      safetyReason: 'Wet floor creates a significant slip hazard for residents.',
      confidence: 0.94,
      priorityReason: 'Active water leakage causing flooding with safety implications.',
      analyzedAt: daysAgo(5),
      failed: false,
    },
    finalClassification: {
      categoryId: catMap['PLUMB'],
      priority: 'high',
      departmentId: deptMap['PLUMB'],
      approvedBy: wardenUser._id,
      approvedAt: daysAgo(5),
    },
    status: 'closed',
    assignedStaffId: plumbingStaff._id,
    assignedDepartmentId: deptMap['PLUMB'],
    assignedBy: wardenUser._id,
    assignedAt: daysAgo(4),
    isOverdue: false,
    escalationLevel: 0,
    resolvedAt: daysAgo(3),
    closedAt: daysAgo(2),
    createdAt: daysAgo(5),
  });

  // Complaint 1 Timeline
  await ComplaintTimeline.insertMany([
    { complaintId: complaint1._id, actorId: student1._id, action: 'complaint_submitted', newValue: 'submitted', comment: 'Complaint submitted by student', createdAt: daysAgo(5) },
    { complaintId: complaint1._id, actorId: student1._id, action: 'ai_analysis_completed', newValue: 'ai_analyzed', comment: 'AI Analysis: Category=Plumbing, Priority=high, Confidence=94%', createdAt: new Date(daysAgo(5).getTime() + 30000) },
    { complaintId: complaint1._id, actorId: wardenUser._id, action: 'ai_classification_approved', previousValue: 'ai_analyzed', newValue: 'pending_review', comment: 'AI classification approved', createdAt: daysAgo(5) },
    { complaintId: complaint1._id, actorId: wardenUser._id, action: 'complaint_assigned', previousValue: 'pending_review', newValue: 'assigned', comment: `Assigned to ${plumbingStaff.name}`, createdAt: daysAgo(4) },
    { complaintId: complaint1._id, actorId: plumbingStaff._id, action: 'status_changed', previousValue: 'assigned', newValue: 'in_progress', comment: 'Work started on the issue', createdAt: daysAgo(4) },
    { complaintId: complaint1._id, actorId: plumbingStaff._id, action: 'status_changed', previousValue: 'in_progress', newValue: 'pending_confirmation', comment: 'Pipe repaired. Leakage fixed.', createdAt: daysAgo(3) },
    { complaintId: complaint1._id, actorId: student1._id, action: 'status_changed', previousValue: 'pending_confirmation', newValue: 'closed', comment: 'Issue confirmed as resolved', createdAt: daysAgo(2) },
  ]);

  // Feedback for complaint 1
  await Feedback.create({
    complaintId: complaint1._id,
    studentId: student1._id,
    rating: 4,
    comment: 'Issue was resolved quickly. Good response from the plumbing team.',
    satisfaction: 'satisfied',
    createdAt: daysAgo(2),
  });

  // Complaint 2: Possible duplicate of complaint 1
  await Complaint.create({
    complaintId: generateComplaintId(),
    studentId: student2._id,
    title: 'Water leakage in B204 bathroom',
    description: 'B204 bathroom is flooding because of water leakage from the ceiling.',
    location: 'Block B, Room 204',
    hostelId: hostelA._id,
    blockId: blockB._id,
    roomId: room204._id,
    aiAnalysis: {
      summary: 'Water leakage from ceiling in Block B Room 204 bathroom.',
      categoryId: catMap['PLUMB'],
      subCategory: 'Water Leakage',
      priority: 'high',
      departmentId: deptMap['PLUMB'],
      possibleSafetyRisk: true,
      safetyReason: 'Active flooding creates slip hazard.',
      confidence: 0.91,
      analyzedAt: daysAgo(5),
      failed: false,
    },
    finalClassification: {
      categoryId: catMap['PLUMB'],
      priority: 'high',
      departmentId: deptMap['PLUMB'],
      approvedBy: wardenUser._id,
      approvedAt: daysAgo(5),
    },
    status: 'closed',
    linkedComplaints: [complaint1._id as mongoose.Types.ObjectId],
    assignedStaffId: plumbingStaff._id,
    assignedDepartmentId: deptMap['PLUMB'],
    assignedBy: wardenUser._id,
    assignedAt: daysAgo(4),
    resolvedAt: daysAgo(3),
    closedAt: daysAgo(2),
    isOverdue: false,
    escalationLevel: 0,
    createdAt: daysAgo(5),
  });

  // Complaint 3: Fan not working - In Progress
  const complaint3 = await Complaint.create({
    complaintId: generateComplaintId(),
    studentId: student1._id,
    title: 'Fan in room making loud noise and stopped working',
    description: 'From yesterday night the fan is making a weird sound and it stopped twice. Today morning it was running slowly and now it is completely not working. Room is very hot.',
    location: 'Block B, Room 204',
    hostelId: hostelA._id,
    blockId: blockB._id,
    roomId: room204._id,
    aiAnalysis: {
      summary: 'Fan malfunction in Block B Room 204 after repeated noise and reduced speed, now completely non-functional.',
      categoryId: catMap['FANAC'],
      subCategory: 'Fan Malfunction',
      priority: 'medium',
      departmentId: deptMap['ELEC'],
      possibleSafetyRisk: false,
      confidence: 0.89,
      priorityReason: 'Fan failure causing discomfort but no immediate safety risk.',
      analyzedAt: daysAgo(1),
      failed: false,
    },
    finalClassification: {
      categoryId: catMap['FANAC'],
      priority: 'medium',
      departmentId: deptMap['ELEC'],
      approvedBy: wardenUser._id,
      approvedAt: daysAgo(1),
    },
    status: 'in_progress',
    assignedStaffId: maintenanceStaff._id,
    assignedDepartmentId: deptMap['ELEC'],
    assignedBy: wardenUser._id,
    assignedAt: daysAgo(1),
    isOverdue: false,
    escalationLevel: 0,
    createdAt: daysAgo(2),
  });

  await ComplaintTimeline.insertMany([
    { complaintId: complaint3._id, actorId: student1._id, action: 'complaint_submitted', newValue: 'submitted', comment: 'Complaint submitted', createdAt: daysAgo(2) },
    { complaintId: complaint3._id, actorId: student1._id, action: 'ai_analysis_completed', newValue: 'ai_analyzed', comment: 'AI Analysis completed', createdAt: new Date(daysAgo(2).getTime() + 30000) },
    { complaintId: complaint3._id, actorId: wardenUser._id, action: 'complaint_assigned', previousValue: 'pending_review', newValue: 'assigned', comment: 'Assigned to electrical team', createdAt: daysAgo(1) },
    { complaintId: complaint3._id, actorId: maintenanceStaff._id, action: 'status_changed', previousValue: 'assigned', newValue: 'in_progress', comment: 'Inspecting fan', createdAt: daysAgo(1) },
  ]);

  // Complaint 4: Internet issue - Pending Review
  const complaint4 = await Complaint.create({
    complaintId: generateComplaintId(),
    studentId: student2._id,
    title: 'Wi-Fi not working since 2 days',
    description: 'The Wi-Fi in Block B has been extremely slow for the past 2 days. Sometimes it completely disconnects. I have online classes and this is causing major problems.',
    location: 'Block B',
    hostelId: hostelA._id,
    blockId: blockB._id,
    aiAnalysis: {
      summary: 'Wi-Fi connectivity issues in Block B for 2 days, affecting academic online activities.',
      categoryId: catMap['NET'],
      subCategory: 'Wi-Fi Connectivity',
      priority: 'high',
      departmentId: deptMap['IT'],
      possibleSafetyRisk: false,
      confidence: 0.92,
      priorityReason: 'Prolonged internet outage affecting academic performance of multiple students.',
      analyzedAt: new Date(),
      failed: false,
    },
    status: 'pending_review',
    isOverdue: false,
    escalationLevel: 0,
    createdAt: daysAgo(1),
  });

  // Complaint 5: Critical - Exposed wire
  const complaint5 = await Complaint.create({
    complaintId: generateComplaintId(),
    studentId: student1._id,
    title: 'Exposed electrical wire sparking in corridor',
    description: 'There is an exposed electrical wire near the corridor in Block A that is sparking. It is extremely dangerous. Please fix this immediately.',
    location: 'Block A, Ground Floor Corridor',
    hostelId: hostelA._id,
    blockId: blockA._id,
    aiAnalysis: {
      summary: 'Exposed sparking electrical wire in Block A corridor creating an immediate electrocution and fire hazard.',
      categoryId: catMap['ELEC'],
      subCategory: 'Exposed Wiring',
      priority: 'critical',
      departmentId: deptMap['ELEC'],
      possibleSafetyRisk: true,
      safetyReason: 'Sparking exposed wire poses immediate risk of electrocution and potential fire outbreak.',
      confidence: 0.98,
      priorityReason: 'Immediate safety hazard affecting all residents in the vicinity.',
      analyzedAt: new Date(),
      failed: false,
    },
    finalClassification: {
      categoryId: catMap['ELEC'],
      priority: 'critical',
      departmentId: deptMap['ELEC'],
      approvedBy: wardenUser._id,
      approvedAt: new Date(),
    },
    status: 'assigned',
    assignedStaffId: electricianStaff._id,
    assignedDepartmentId: deptMap['ELEC'],
    assignedBy: wardenUser._id,
    assignedAt: new Date(),
    isOverdue: false,
    escalationLevel: 0,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  });

  // More complaints for analytics
  const complaintBatch = [];
  const statuses = ['closed', 'closed', 'resolved', 'in_progress', 'pending_review'];
  const priorityLevels = ['low', 'medium', 'medium', 'high', 'low'] as const;
  const catKeys = ['CLEAN', 'ROOM', 'FURN', 'FOOD', 'SANIT'];
  const deptKeys = ['HOUSE', 'GEN', 'GEN', 'MESS', 'HOUSE'];

  for (let i = 0; i < 15; i++) {
    const idx = i % 5;
    const daysBack = Math.floor(Math.random() * 30) + 1;
    complaintBatch.push({
      complaintId: generateComplaintId(),
      studentId: i % 2 === 0 ? student1._id : student2._id,
      title: `Issue ${i + 1}: ${['Room not clean', 'Window broken', 'Chair damaged', 'Food quality poor', 'Toilet clogged'][idx]}`,
      description: `Detailed description of issue ${i + 1} in the hostel.`,
      location: `Block ${['A', 'B', 'C'][i % 3]}, Room ${100 + i}`,
      hostelId: hostelA._id,
      blockId: i % 2 === 0 ? blockA._id : blockB._id,
      aiAnalysis: {
        summary: `Summary of issue ${i + 1}`,
        categoryId: catMap[catKeys[idx]],
        priority: priorityLevels[idx],
        departmentId: deptMap[deptKeys[idx]],
        possibleSafetyRisk: false,
        confidence: 0.75 + Math.random() * 0.2,
        analyzedAt: daysAgo(daysBack),
        failed: false,
      },
      finalClassification: {
        categoryId: catMap[catKeys[idx]],
        priority: priorityLevels[idx],
        departmentId: deptMap[deptKeys[idx]],
        approvedBy: wardenUser._id,
        approvedAt: daysAgo(daysBack),
      },
      status: statuses[idx],
      assignedStaffId: maintenanceStaff._id,
      assignedDepartmentId: deptMap[deptKeys[idx]],
      assignedBy: wardenUser._id,
      assignedAt: daysAgo(daysBack - 1),
      resolvedAt: ['closed', 'resolved'].includes(statuses[idx]) ? daysAgo(Math.max(0, daysBack - 2)) : undefined,
      closedAt: statuses[idx] === 'closed' ? daysAgo(Math.max(0, daysBack - 2)) : undefined,
      isOverdue: Math.random() > 0.7,
      escalationLevel: 0,
      createdAt: daysAgo(daysBack),
    });
  }

  await Complaint.insertMany(complaintBatch);
  console.log('✅ Complaints created');

  // ========== NOTIFICATIONS ==========
  await Notification.insertMany([
    {
      recipientId: student1._id,
      complaintId: complaint3._id,
      type: 'complaint_assigned',
      title: 'Your Complaint Has Been Assigned',
      message: 'Your complaint "Fan in room making loud noise" has been assigned to a team for resolution.',
      isRead: false,
      createdAt: daysAgo(1),
    },
    {
      recipientId: student1._id,
      complaintId: complaint5._id,
      type: 'complaint_status_changed',
      title: 'Work Started on Your Complaint',
      message: 'Your critical complaint has been assigned and the team is on the way.',
      isRead: false,
      createdAt: new Date(),
    },
    {
      recipientId: wardenUser._id,
      complaintId: complaint4._id,
      type: 'complaint_submitted',
      title: 'New Complaint Needs Review',
      message: 'A new high-priority complaint about Wi-Fi connectivity requires your review.',
      isRead: false,
      createdAt: daysAgo(1),
    },
  ]);
  console.log('✅ Notifications created');

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DEMO ACCOUNTS (for development only):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Admin:    admin@hera.dev     / Admin@123');
  console.log('  Warden:   warden@hera.dev    / Warden@123');
  console.log('  Student:  student@hera.dev   / Student@123');
  console.log('  Student:  student2@hera.dev  / Student@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
