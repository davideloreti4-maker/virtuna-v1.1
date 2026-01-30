import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

const VIDEOS_DIR = path.join(__dirname, '..', 'videos', 'flows');

test.describe('Simulation', () => {
  // Enable video recording for simulation tests
  test.use({
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 },
    },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture simulation loading phases with video', async ({ page }, testInfo) => {
    // Desktop only

    // Open test type selector and select TikTok (quick test type)
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select TikTok
    const tiktokBtn = page.locator('button:has-text("TikTok"), [data-testid*="tiktok"]').first();
    if (!await tiktokBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('TikTok type not found');
      return;
    }

    await tiktokBtn.click();
    await page.waitForTimeout(400);

    // Fill form
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('[Hook] Check this out! [Body] This is a sample TikTok script for testing. #test #demo');
    }

    // Submit form
    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Submit button not found');
      return;
    }

    await submitBtn.click();

    // Capture loading phases
    // Phase 1
    await page.waitForTimeout(500);
    await screenshot(page, 'simulation', 'simulation-phase1');

    // Wait for phase indicators and capture each
    for (let phase = 2; phase <= 4; phase++) {
      // Wait a bit for phase transition
      await page.waitForTimeout(2000);

      // Check if still loading
      const loader = page.locator('[class*="loading"], [class*="spinner"], [data-testid*="loading"]').first();
      if (await loader.isVisible({ timeout: 1000 }).catch(() => false)) {
        await screenshot(page, 'simulation', `simulation-phase${phase}`);
      }
    }

    // Wait for completion (results appear)
    try {
      await page.waitForSelector(
        SELECTORS.resultsPanel + ', [data-testid*="result"], [class*="result"]',
        { timeout: 60000 }
      );
      await screenshot(page, 'simulation', 'simulation-complete');
    } catch {
      console.log('Results did not appear within timeout');
    }

    // Capture specific loading state details
    await captureLoadingDetails(page);
  });

  test('capture loading states detail', async ({ page }) => {
    // Desktop only

    // This test captures static loading state screenshots if we can mock them
    // or if there's a way to pause during loading

    // Look for any visible loading elements
    const loadingSpinner = page.locator('[class*="spinner"], [class*="loading"], svg[class*="animate"]').first();
    if (await loadingSpinner.isVisible({ timeout: 1000 }).catch(() => false)) {
      await screenshot(page, 'simulation', 'loading-spinner');
    }

    const progressBar = page.locator('[role="progressbar"], [class*="progress"]').first();
    if (await progressBar.isVisible({ timeout: 1000 }).catch(() => false)) {
      await screenshot(page, 'simulation', 'loading-progress-bar');
    }
  });
});

async function captureLoadingDetails(page: import('@playwright/test').Page): Promise<void> {
  // Try to capture specific loading text phases
  const loadingTexts = page.locator('[class*="loading"] p, [data-testid*="loading-text"]');

  const count = await loadingTexts.count();
  for (let i = 0; i < Math.min(count, 4); i++) {
    const textEl = loadingTexts.nth(i);
    if (await textEl.isVisible({ timeout: 500 }).catch(() => false)) {
      const text = await textEl.textContent();
      console.log(`Loading text ${i + 1}: ${text}`);
    }
  }
}

test.describe('Simulation Video Flow', () => {
  // Record full simulation flow as video
  test.use({
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 },
    },
  });

  test('record complete simulation flow', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForStable(page);

    // Open test type selector
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(600);

    // Select a test type
    const emailBtn = page.locator('button:has-text("Email Subject"), [data-testid*="email-subject"]').first();
    if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBtn.click();
    } else {
      // Fallback to any available type
      const anyType = page.locator('[role="dialog"] button').first();
      await anyType.click();
    }
    await page.waitForTimeout(400);

    // Fill and submit
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('Your exclusive early access is here! Limited time offer.');
    }

    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();

      // Wait for results
      try {
        await page.waitForSelector(
          '[data-testid*="result"], [class*="result"], [class*="score"]',
          { timeout: 90000 }
        );
        await page.waitForTimeout(2000); // Let results fully render
      } catch {
        console.log('Results timeout');
      }
    }

    // Video will be saved automatically
    // Copy to designated location
    const video = page.video();
    if (video) {
      await testInfo.attach('simulation-loading-phases', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
