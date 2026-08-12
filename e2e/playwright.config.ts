import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  outputDir: 'test-results',

  use: {
    // Port 3000 stays the default, but slot/milestone worktrees each run their own dev
    // server on their own port (one server per port is a house rule) — a hardcoded 3000
    // meant this suite silently targeted whatever OTHER worktree happened to own it.
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    colorScheme: 'dark',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: './e2e/auth/state.json',
      },
      dependencies: ['setup'],
    },
  ],
});
