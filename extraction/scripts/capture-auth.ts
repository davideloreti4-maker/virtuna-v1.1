/**
 * Authentication State Capture Script
 *
 * Run this script to save authentication state from a manual login.
 * Opens a browser window, waits for you to log in, then saves the session.
 *
 * Usage: npx ts-node extraction/scripts/capture-auth.ts
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { AUTH_STATE_PATH, VIEWPORTS } from './utils';

async function captureAuthState() {
  console.log('Starting authentication capture...');
  console.log('A browser window will open. Please log in manually.');
  console.log('Once logged in and on the dashboard, the session will be saved.');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
  });
  const page = await context.newPage();

  await page.goto('https://app.societies.io');

  console.log('\n--- Waiting for login completion ---');
  console.log('Please log in via the browser window.');
  console.log('Script will continue once you reach a page containing "/dashboard" or the main app.\n');

  // Wait for user to complete login (2 minute timeout)
  await page.waitForURL('**/*', { timeout: 120000 });

  // Give time for the app to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Ensure auth directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  fs.mkdirSync(authDir, { recursive: true });

  // Save authentication state
  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`\nAuthentication state saved to: ${AUTH_STATE_PATH}`);

  await browser.close();
  console.log('Browser closed. Auth capture complete!');
}

captureAuthState().catch(console.error);
