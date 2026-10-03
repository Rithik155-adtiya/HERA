import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/hera_test_placeholder',
      JWT_SECRET: 'test-secret-key-for-vitest-only-0123456789',
      CLIENT_URL: 'http://localhost:5173',
      LOG_LEVEL: 'error',
      GEMINI_API_KEY: '',
      RATE_LIMIT_MAX_REQUESTS: '10000',
    },
  },
});
