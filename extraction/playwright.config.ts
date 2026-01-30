import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const VIDEOS_DIR = path.join(__dirname, 'videos');

export default defineConfig({
  testDir: './tests',
  timeout: 180000, // 3 minutes per test
  expect: { timeout: 10000 },
  fullyParallel: false, // Run sequentially for consistent captures
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker for sequential execution
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list'],
  ],
  outputDir: 'test-results',

  use: {
    baseURL: 'https://app.societies.io',
    trace: 'retain-on-failure',
    screenshot: 'off', // Manual screenshots only
    video: 'off', // Enable per-test for flow recordings
    colorScheme: 'dark',
    // Slow down for animation captures
    launchOptions: {
      slowMo: 100,
    },
  },

  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: './auth/state.json',
      },
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
  ],
});
