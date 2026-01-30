/**
 * Dashboard Capture Script
 *
 * Captures dashboard states at desktop (1440px) and mobile (375px) viewports:
 * - Default state (no test running)
 * - Society selected state
 * - Loading state (if observable)
 */

import { chromium } from 'playwright';
import {
  VIEWPORTS,
  ViewportName,
  captureScreen,
  createAuthContext,
  scrollToBottom,
  ensureDir,
  SCREENSHOTS_DIR,
} from './utils';

const BASE_URL = 'https://app.societies.io';

async function captureDashboard(): Promise<void> {
  console.log('Starting dashboard capture...');

  // Ensure directories exist
  ensureDir(`${SCREENSHOTS_DIR}/desktop/dashboard`);
  ensureDir(`${SCREENSHOTS_DIR}/mobile/dashboard`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Capture at both viewports
    for (const viewport of ['desktop', 'mobile'] as ViewportName[]) {
      console.log(`\nCapturing ${viewport} dashboard...`);

      const context = await createAuthContext(browser, viewport);
      const page = await context.newPage();

      // Navigate to dashboard
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });

      // Wait for dashboard to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Additional wait for animations

      // 1. Capture default state
      console.log(`Capturing ${viewport} default state...`);
      await captureScreen(page, viewport, 'dashboard', 'default');

      // 2. Try to capture society selected state
      // Look for society selector/dropdown
      try {
        const societySelector = await page.locator('[data-testid="society-selector"], .society-selector, select[name="society"], [class*="society"] select, [class*="Society"] select').first();

        if (await societySelector.isVisible({ timeout: 3000 })) {
          console.log(`Found society selector for ${viewport}...`);
          await societySelector.click();
          await page.waitForTimeout(500);

          // Try to select a different society option
          const options = await page.locator('[data-testid="society-option"], .society-option, option, [role="option"]').all();
          if (options.length > 1) {
            await options[1].click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            await captureScreen(page, viewport, 'dashboard', 'society-selected');
          } else {
            console.log(`Only one society available for ${viewport}, skipping society-selected`);
          }
        } else {
          console.log(`No society selector found for ${viewport}`);
        }
      } catch (e) {
        console.log(`Could not capture society-selected state for ${viewport}: ${e}`);
      }

      // 3. Try to capture loading state (reload and capture quickly)
      if (viewport === 'desktop') {
        console.log('Attempting to capture loading state...');
        try {
          // Use faster event to catch loading
          const loadingPromise = page.goto(BASE_URL, { waitUntil: 'commit' });
          await loadingPromise;
          await page.waitForTimeout(200); // Quick capture

          await captureScreen(page, viewport, 'dashboard', 'loading');
        } catch (e) {
          console.log(`Could not capture loading state: ${e}`);
        }
      }

      await context.close();
    }

    console.log('\nDashboard capture complete!');

  } finally {
    await browser.close();
  }
}

// Run the capture
captureDashboard().catch(console.error);
