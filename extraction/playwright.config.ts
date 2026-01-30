import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  timeout: 120000,
  use: {
    baseURL: 'https://app.societies.io',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});
