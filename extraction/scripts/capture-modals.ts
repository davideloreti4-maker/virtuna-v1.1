/**
 * Modal Capture Script
 *
 * Captures:
 * - Feedback modal
 * - Create society modal
 * - Delete confirmation modal
 *
 * Usage: npx tsx extraction/scripts/capture-modals.ts
 */
import { chromium } from 'playwright';
import {
  VIEWPORTS,
  AUTH_STATE_PATH,
  SCREENSHOTS_DIR,
  ensureDir,
  ViewportName,
} from './utils';
import * as path from 'path';

const BASE_URL = 'https://app.societies.io';

async function captureModals() {
  console.log('Starting modal capture...');

  const browser = await chromium.launch({ headless: false });

  for (const viewportName of ['desktop', 'mobile'] as ViewportName[]) {
    console.log(`\n=== Capturing ${viewportName} viewport ===`);

    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: VIEWPORTS[viewportName],
    });
    const page = await context.newPage();

    // Ensure modals directory exists
    const modalsDir = path.join(SCREENSHOTS_DIR, viewportName, 'modals');
    ensureDir(modalsDir);

    // Navigate to app
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // ========================================
    // FEEDBACK MODAL
    // ========================================
    console.log('\n--- Capturing Feedback Modal ---');
    try {
      // Look for feedback button/link
      const feedbackBtn = page.locator(
        'button:has-text("Feedback"), ' +
        'a:has-text("Feedback"), ' +
        'button:has-text("Leave Feedback"), ' +
        '[aria-label="Feedback"], ' +
        '[data-testid="feedback-button"]'
      ).first();

      if (await feedbackBtn.isVisible({ timeout: 3000 })) {
        await feedbackBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(modalsDir, 'feedback.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/modals/feedback.png`);

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        console.log('Note: Feedback button not found');
        // Try alternative - check in settings or help menu
        const helpBtn = page.locator('button:has-text("Help"), [aria-label="Help"]').first();
        if (await helpBtn.isVisible({ timeout: 1000 })) {
          await helpBtn.click();
          await page.waitForTimeout(500);
          const feedbackOption = page.locator('text=Feedback').first();
          if (await feedbackOption.isVisible({ timeout: 1000 })) {
            await feedbackOption.click();
            await page.waitForTimeout(1000);
            await page.screenshot({
              path: path.join(modalsDir, 'feedback.png'),
              fullPage: true,
            });
            console.log(`Captured: ${viewportName}/modals/feedback.png`);
            await page.keyboard.press('Escape');
          }
        }
      }
    } catch (e) {
      console.log('Note: Could not capture feedback modal');
    }

    // ========================================
    // CREATE SOCIETY MODAL
    // ========================================
    console.log('\n--- Capturing Create Society Modal ---');
    try {
      // Look for society selector or create button
      const societySelector = page.locator(
        '[data-testid="society-selector"], ' +
        'button:has-text("Society"), ' +
        '[aria-label*="society"], ' +
        '.society-selector'
      ).first();

      if (await societySelector.isVisible({ timeout: 3000 })) {
        await societySelector.click();
        await page.waitForTimeout(500);

        // Look for create new society option
        const createOption = page.locator(
          'button:has-text("Create"), ' +
          'text=Create Society, ' +
          'text=New Society, ' +
          '[data-testid="create-society"]'
        ).first();

        if (await createOption.isVisible({ timeout: 2000 })) {
          await createOption.click();
          await page.waitForTimeout(1000);
          await page.screenshot({
            path: path.join(modalsDir, 'create-society.png'),
            fullPage: true,
          });
          console.log(`Captured: ${viewportName}/modals/create-society.png`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } else {
          console.log('Note: Create society option not found in selector');
        }
      } else {
        console.log('Note: Society selector not found');
        // Try alternative - look in sidebar or menu
        const sidebarCreate = page.locator('button:has-text("Create Society"), a:has-text("Create Society")').first();
        if (await sidebarCreate.isVisible({ timeout: 1000 })) {
          await sidebarCreate.click();
          await page.waitForTimeout(1000);
          await page.screenshot({
            path: path.join(modalsDir, 'create-society.png'),
            fullPage: true,
          });
          console.log(`Captured: ${viewportName}/modals/create-society.png`);
          await page.keyboard.press('Escape');
        }
      }
    } catch (e) {
      console.log('Note: Could not capture create society modal');
    }

    // ========================================
    // DELETE CONFIRMATION MODAL
    // ========================================
    console.log('\n--- Capturing Delete Confirmation Modal ---');
    try {
      // Navigate to history or a view with deletable items
      const historyNav = page.locator(
        'a[href*="history"], ' +
        'button:has-text("History"), ' +
        '[data-testid="history-nav"]'
      ).first();

      if (await historyNav.isVisible({ timeout: 2000 })) {
        await historyNav.click();
        await page.waitForTimeout(1500);
      }

      // Find a deletable item
      const deleteBtn = page.locator(
        'button:has-text("Delete"), ' +
        '[aria-label="Delete"], ' +
        '[data-testid="delete-button"], ' +
        'button[title*="Delete"]'
      ).first();

      if (await deleteBtn.isVisible({ timeout: 2000 })) {
        await deleteBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(modalsDir, 'delete-confirmation.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/modals/delete-confirmation.png`);

        // Cancel the delete
        const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
        if (await cancelBtn.isVisible({ timeout: 1000 })) {
          await cancelBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
      } else {
        console.log('Note: Delete button not found - trying settings');
        // Try account deletion modal in settings
        await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);

        const dangerZone = page.locator('text=Delete Account, text=Danger Zone').first();
        if (await dangerZone.isVisible({ timeout: 2000 })) {
          const accountDeleteBtn = page.locator('button:has-text("Delete Account"), button:has-text("Delete")').first();
          if (await accountDeleteBtn.isVisible({ timeout: 1000 })) {
            await accountDeleteBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({
              path: path.join(modalsDir, 'delete-confirmation.png'),
              fullPage: true,
            });
            console.log(`Captured: ${viewportName}/modals/delete-confirmation.png`);
            await page.keyboard.press('Escape');
          }
        }
      }
    } catch (e) {
      console.log('Note: Could not capture delete confirmation modal');
    }

    await context.close();
  }

  await browser.close();
  console.log('\n=== Modal capture complete! ===');
}

captureModals().catch(console.error);
