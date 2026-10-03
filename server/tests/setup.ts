/**
 * Test harness: spins up an in-memory MongoDB (mongodb-memory-server) and
 * exposes a supertest agent bound to the Express app. No local mongod required.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';

let mongod: MongoMemoryServer | null = null;

export async function setupTestDB(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('hera_test'));
}

export async function teardownTestDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export function agent() {
  return request(app);
}

export function tokenFor(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

/** Authenticated request helper */
export function authed(token: string) {
  const req = request(app);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req as any).set('Authorization', `Bearer ${token}`);
}
