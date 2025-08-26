import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    },
    {
      name: 'mobile chrome',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 }
      }
    }
  ]
});
