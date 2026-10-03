import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Prefer project-root .env (workspaces), fall back to server/.env
const rootEnv = path.join(__dirname, '../../../.env');
const serverEnv = path.join(__dirname, '../../.env');
dotenv.config({ path: fs.existsSync(rootEnv) ? rootEnv : serverEnv });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // PORT=0 (some CI/dev harnesses) or non-numeric values fall back to 5000
  PORT: z.preprocess(
    (v) => (v === undefined || v === '' || Number(v) === 0 || Number.isNaN(Number(v)) ? undefined : v),
    z.coerce.number().min(1).max(65535).default(5000)
  ),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  GEMINI_API_KEY: parsed.data.GEMINI_API_KEY?.trim() || parsed.data.GOOGLE_API_KEY?.trim() || undefined,
};
export type Config = typeof config;
