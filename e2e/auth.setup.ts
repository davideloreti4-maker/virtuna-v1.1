import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_STATE_PATH = path.join(__dirname, 'auth', 'state.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing E2E_USER_EMAIL or E2E_USER_PASSWORD env vars. ' +
      'Set them in .env.local or pass inline: E2E_USER_EMAIL=x E2E_USER_PASSWORD=y pnpm e2e'
    );
  }

  const authDir = path.dirname(AUTH_STATE_PATH);
  fs.mkdirSync(authDir, { recursive: true });

  // Navigate to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill credentials
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);

  // Submit
  await page.locator('button[type="submit"]:has-text("Sign in")').click();

  // Wait for redirect to dashboard (or welcome for first-time users)
  await page.waitForURL(url => {
    const pathname = url.pathname;
    return pathname.includes('dashboard') || pathname.includes('welcome');
  }, { timeout: 30000 });

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Save auth state
  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log(`Auth state saved to: ${AUTH_STATE_PATH}`);
});
