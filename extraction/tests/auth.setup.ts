import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_STATE_PATH = path.join(__dirname, '..', 'auth', 'state.json');

setup('authenticate', async ({ page }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  fs.mkdirSync(authDir, { recursive: true });

  // Navigate to app
  await page.goto('https://app.societies.io');

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Please log in via the browser window  ║');
  console.log('║  Navigate to the dashboard when done   ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Wait for user to login (check for dashboard or main app)
  await page.waitForURL(url => {
    const path = url.pathname;
    return path.includes('dashboard') ||
           path === '/' ||
           !path.includes('login') && !path.includes('auth');
  }, { timeout: 300000 }); // 5 minute timeout

  // Wait for app to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Save auth state
  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log(`\nAuth state saved to: ${AUTH_STATE_PATH}`);
});
