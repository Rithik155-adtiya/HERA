import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, teardownTestDB, clearTestDB, agent } from './setup';
import { User } from '../src/models/User';
import { Hostel } from '../src/models/Hostel';
import bcrypt from 'bcryptjs';

describe('Authentication & RBAC', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('registers a new student and returns a token', async () => {
    const res = await agent()
      .post('/api/auth/register')
      .send({ name: 'Test Student', email: 's@test.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email registration', async () => {
    await agent()
      .post('/api/auth/register')
      .send({ name: 'AA', email: 'dup@test.com', password: 'Password123' });

    const res = await agent()
      .post('/api/auth/register')
      .send({ name: 'BB', email: 'dup@test.com', password: 'Password123' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_EMAIL');
  });

  it('rejects weak passwords via validation', async () => {
    const res = await agent()
      .post('/api/auth/register')
      .send({ name: 'Weak User', email: 'weak@test.com', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with correct credentials', async () => {
    await User.create({
      name: 'Login User',
      email: 'login@test.com',
      passwordHash: await bcrypt.hash('Password123', 4),
      role: 'student',
    });

    const res = await agent()
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('rejects invalid credentials with generic message', async () => {
    const res = await agent()
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects deactivated accounts', async () => {
    await User.create({
      name: 'Inactive',
      email: 'inactive@test.com',
      passwordHash: await bcrypt.hash('Password123', 4),
      role: 'student',
      isActive: false,
    });

    const res = await agent()
      .post('/api/auth/login')
      .send({ email: 'inactive@test.com', password: 'Password123' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('returns current user from /me', async () => {
    const user = await User.create({
      name: 'Me User',
      email: 'me@test.com',
      passwordHash: await bcrypt.hash('Password123', 4),
      role: 'student',
    });

    const { tokenFor } = await import('./setup');
    const token = tokenFor({ id: user._id.toString(), email: user.email, role: 'student' });

    const res = await agent().get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@test.com');
  });

  it('rejects requests without a token', async () => {
    const res = await agent().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('rejects an invalid token', async () => {
    const res = await agent().get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('forbids students from admin endpoints', async () => {
    const user = await User.create({
      name: 'Student',
      email: 'stUDENT@test.com',
      passwordHash: await bcrypt.hash('Password123', 4),
      role: 'student',
    });
    const { tokenFor } = await import('./setup');
    const token = tokenFor({ id: user._id.toString(), email: user.email, role: 'student' });

    const res = await agent().get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('forbids students from warden dashboards', async () => {
    const user = await User.create({
      name: 'Student2',
      email: 's2@test.com',
      passwordHash: await bcrypt.hash('Password123', 4),
      role: 'student',
    });
    const { tokenFor } = await import('./setup');
    const token = tokenFor({ id: user._id.toString(), email: user.email, role: 'student' });

    const res = await agent().get('/api/dashboard/warden').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('blocks warden-only endpoints from anonymous callers', async () => {
    const res = await agent().get('/api/analytics/overview');
    expect(res.status).toBe(401);
  });
});
