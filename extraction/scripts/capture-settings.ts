/**
 * Settings Pages Capture Script
 *
 * Captures all settings tabs:
 * - Profile
 * - Account
 * - Notifications
 * - Billing
 * - Team
 * - Default/Overview
 *
 * Usage: npx tsx extraction/scripts/capture-settings.ts
 */
import { chromium } from 'playwright';
import {
  VIEWPORTS,
  AUTH_STATE_PATH,
  SCREENSHOTS_DIR,
  ensureDir,
  scrollToBottom,
  ViewportName,
} from './utils';
import * as path from 'path';

const BASE_URL = 'https://app.societies.io';

async function captureSettings() {
  console.log('Starting settings capture...');

  const browser = await chromium.launch({ headless: false });

  for (const viewportName of ['desktop', 'mobile'] as ViewportName[]) {
    console.log(`\n=== Capturing ${viewportName} viewport ===`);

    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: VIEWPORTS[viewportName],
    });
    const page = await context.newPage();

    // Ensure settings directory exists
    const settingsDir = path.join(SCREENSHOTS_DIR, viewportName, 'settings');
    ensureDir(settingsDir);

    // Navigate to settings
    console.log('\n--- Navigating to Settings ---');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Capture default settings page
    await scrollToBottom(page);
    await page.screenshot({
      path: path.join(settingsDir, 'default.png'),
      fullPage: true,
    });
    console.log(`Captured: ${viewportName}/settings/default.png`);

    // Define settings tabs to capture
    const tabs = [
      { name: 'profile', selectors: ['text=Profile', 'a[href*="profile"]', '[data-testid="profile-tab"]'] },
      { name: 'account', selectors: ['text=Account', 'a[href*="account"]', '[data-testid="account-tab"]'] },
      { name: 'notifications', selectors: ['text=Notifications', 'a[href*="notifications"]', '[data-testid="notifications-tab"]'] },
      { name: 'billing', selectors: ['text=Billing', 'a[href*="billing"]', '[data-testid="billing-tab"]'] },
      { name: 'team', selectors: ['text=Team', 'a[href*="team"]', '[data-testid="team-tab"]'] },
    ];

    for (const tab of tabs) {
      console.log(`\n--- Capturing ${tab.name} tab ---`);
      try {
        let tabFound = false;

        for (const selector of tab.selectors) {
          const tabElement = page.locator(selector).first();
          if (await tabElement.isVisible({ timeout: 1000 })) {
            await tabElement.click();
            await page.waitForTimeout(1500);
            await scrollToBottom(page);
            await page.screenshot({
              path: path.join(settingsDir, `${tab.name}.png`),
              fullPage: true,
            });
            console.log(`Captured: ${viewportName}/settings/${tab.name}.png`);
            tabFound = true;
            break;
          }
        }

        if (!tabFound) {
          // Try navigating directly via URL
          const tabUrl = `${BASE_URL}/settings/${tab.name}`;
          await page.goto(tabUrl, { waitUntil: 'networkidle' });
          await page.waitForTimeout(1500);

          // Check if we're on a valid page (not 404)
          const is404 = await page.locator('text=404, text=Not Found').isVisible({ timeout: 1000 }).catch(() => false);
          if (!is404) {
            await scrollToBottom(page);
            await page.screenshot({
              path: path.join(settingsDir, `${tab.name}.png`),
              fullPage: true,
            });
            console.log(`Captured: ${viewportName}/settings/${tab.name}.png (via URL)`);
          } else {
            console.log(`Note: ${tab.name} tab not found`);
          }
        }
      } catch (e) {
        console.log(`Note: Could not capture ${tab.name} tab`);
      }
    }

    // Check for additional settings sections
    console.log('\n--- Checking for additional settings sections ---');
    const additionalSections = [
      { name: 'security', selector: 'text=Security, a[href*="security"]' },
      { name: 'api', selector: 'text=API, text=API Keys, a[href*="api"]' },
      { name: 'integrations', selector: 'text=Integrations, a[href*="integrations"]' },
    ];

    for (const section of additionalSections) {
      try {
        const sectionElement = page.locator(section.selector).first();
        if (await sectionElement.isVisible({ timeout: 1000 })) {
          await sectionElement.click();
          await page.waitForTimeout(1500);
          await scrollToBottom(page);
          await page.screenshot({
            path: path.join(settingsDir, `${section.name}.png`),
            fullPage: true,
          });
          console.log(`Captured: ${viewportName}/settings/${section.name}.png`);
        }
      } catch {
        // Section not found, skip
      }
    }

    await context.close();
  }

  await browser.close();
  console.log('\n=== Settings capture complete! ===');
}

captureSettings().catch(console.error);
