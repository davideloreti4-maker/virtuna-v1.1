import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Plan 03 Comparison Screenshots
 * Captures Virtuna modals and results for Phase 12 comparison
 */

const COMPARISON_SCREENSHOTS = path.join(
  process.cwd(),
  '.planning/phases/12-comparison/virtuna-screenshots'
);

// Common selectors
const SELECTORS = {
  sidebar: '[data-testid="sidebar"], aside, nav',
  societyTrigger: 'button:has-text("Switzerland"), [data-testid="society-selector"], button[class*="society"]',
  createSocietyBtn: 'button:has-text("Create"), button:has-text("New Society"), button:has-text("Create Target Society")',
  feedbackTrigger: 'button:has-text("Feedback"), button:has-text("Leave Feedback"), a:has-text("Feedback")',
  newTestBtn: 'button:has-text("New Test"), button:has-text("Create Test"), [data-testid="new-test"]',
  modal: '[role="dialog"], [data-state="open"]',
  textarea: 'textarea',
  submitBtn: 'button:has-text("Simulate"), button:has-text("Submit"), button[type="submit"], button:has-text("Run")',
  resultsPanel: '[data-testid="results"], [class*="results"], [class*="score"]',
  insightsTrigger: 'button:has-text("Insights"), [data-testid="insights"], [data-testid*="insight"]',
};

async function saveScreenshot(page: Page, subfolder: string, filename: string): Promise<string> {
  const dir = path.join(COMPARISON_SCREENSHOTS, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

async function waitForStable(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

test.describe('Plan 03 - Modals Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Force dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('http://localhost:3000/dashboard');
    await waitForStable(page);
  });

  test('01-create-society-modal', async ({ page }) => {
    // Society selector is a button with society name and chevron icon
    // The selector component uses Radix Dialog, trigger is first button inside SocietySelector
    // Look for the society selector trigger - it contains text like "Switzerland" or "Select Society"
    const societyTrigger = page.locator('button:has(svg.lucide-chevron-down)').first();

    // Click to open society selector dialog
    await societyTrigger.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Society selector dialog should now be open
    // Look for "Create Target Society" button inside the dialog
    const createBtn = page.locator('[role="dialog"] button:has-text("Create Target Society")');

    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Now the Create Society modal should be open
      // Wait for it to fully appear
      await page.waitForTimeout(300);
    }

    // Capture the create society modal
    await saveScreenshot(page, 'modals', '01-create-society-modal.png');
  });

  test('02-leave-feedback-modal', async ({ page }) => {
    // Look for feedback trigger - usually in sidebar footer or main nav
    const feedbackBtn = page.locator(SELECTORS.feedbackTrigger).first();

    if (await feedbackBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await feedbackBtn.click();
      await page.waitForTimeout(400);
    } else {
      // Try scrolling sidebar to find it
      const sidebar = page.locator('aside, nav').first();
      if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sidebar.evaluate(el => el.scrollTo(0, el.scrollHeight));
        await page.waitForTimeout(300);

        // Try again after scroll
        const feedbackAfterScroll = page.locator(SELECTORS.feedbackTrigger).first();
        if (await feedbackAfterScroll.isVisible({ timeout: 2000 }).catch(() => false)) {
          await feedbackAfterScroll.click();
          await page.waitForTimeout(400);
        }
      }
    }

    // Capture the feedback modal
    await saveScreenshot(page, 'modals', '02-leave-feedback-modal.png');
  });
});

test.describe('Plan 03 - Results Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Force dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('http://localhost:3000/dashboard');
    await waitForStable(page);
  });

  async function runSimulationToResults(page: Page): Promise<boolean> {
    // Click new test button
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('New test button not found');
      return false;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select TikTok test type (or any available)
    const tiktokBtn = page.locator('button:has-text("TikTok"), [data-testid*="tiktok"]').first();
    const emailBtn = page.locator('button:has-text("Email Subject"), [data-testid*="email"]').first();

    if (await tiktokBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tiktokBtn.click();
    } else if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBtn.click();
    } else {
      // Try any test type button
      const anyType = page.locator('[role="dialog"] button:not(:has-text("Cancel"))').first();
      if (!await anyType.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('No test type found');
        return false;
      }
      await anyType.click();
    }
    await page.waitForTimeout(400);

    // Fill the form
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textarea.fill('Sample test content for simulation - testing the impact of marketing message.');
    }

    // Submit the form
    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Submit button not found');
      return false;
    }

    await submitBtn.click();

    // Wait for results
    try {
      await page.waitForSelector(
        SELECTORS.resultsPanel,
        { timeout: 120000 }
      );
      await page.waitForTimeout(2000); // Let results render
      return true;
    } catch {
      console.log('Results did not appear');
      return false;
    }
  }

  test('01-results-panel', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);

    if (hasResults) {
      await saveScreenshot(page, 'results', '01-results-panel.png');
    } else {
      // Capture current state for manual comparison
      await saveScreenshot(page, 'results', '01-results-panel.png');
    }
  });

  test('02-results-insights', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);

    if (hasResults) {
      // Click on insights to expand
      const insightsTrigger = page.locator(SELECTORS.insightsTrigger).first();

      if (await insightsTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await insightsTrigger.click();
        await page.waitForTimeout(400);
      }

      await saveScreenshot(page, 'results', '02-results-insights.png');
    } else {
      // Capture current state
      await saveScreenshot(page, 'results', '02-results-insights.png');
    }
  });
});
