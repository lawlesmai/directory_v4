import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000, // Increased timeout for complex mobile scenarios
  expect: {
    timeout: 10000 // More lenient timeout for mobile interactions
  },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/test-results.json' }]
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
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
      }
    },
    {
      name: 'mobile safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    },
    {
      name: 'mobile android',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 640 },
        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36'
      }
    }
  ]
});
