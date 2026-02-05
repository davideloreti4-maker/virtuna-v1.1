import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'reports/test-results',

  use: {
    baseURL: 'http://localhost:3000',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 375, height: 812 },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },
  ],
});
