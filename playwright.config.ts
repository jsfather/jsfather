import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3100',
    headless: true,
    trace: 'retain-on-failure',
  },
  reporter: 'list',
});
