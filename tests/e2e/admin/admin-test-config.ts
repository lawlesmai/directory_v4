import { PlaywrightTestConfig } from '@playwright/test';

export const adminTestConfig: PlaywrightTestConfig = {
  testDir: './tests/e2e/admin',
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/admin-test-results.json' }],
    ['html', { open: 'never' }]
  ],
  use: {
    actionTimeout: 0,
    baseURL: process.env.ADMIN_TEST_URL || 'http://localhost:3000/admin',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
};
