import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

/**
 * Part 8: Test History - Capture history list and actions
 * Per EXTRACTION-PLAN.md sections 8.1-8.3
 */

test.describe('History', () => {
  // Enable video recording for history tests
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

  /**
   * Navigate to history section
   */
  async function navigateToHistory(page: import('@playwright/test').Page): Promise<boolean> {
    // Try direct navigation first
    const historyNav = page.locator(
      SELECTORS.sidebarItem('History') + ', ' +
      SELECTORS.sidebarItem('history') + ', ' +
      'a:has-text("History"), [data-testid*="history"]'
    ).first();

    if (await historyNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyNav.click();
      await page.waitForTimeout(500);
      return true;
    }

    // History might be visible in sidebar by default
    const historySection = page.locator(
      '[data-testid="history-list"], [class*="history"], ' +
      '[aria-label*="history"]'
    ).first();

    return await historySection.isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * Helper to run a quick simulation to populate history
   */
  async function runSimulation(page: import('@playwright/test').Page): Promise<boolean> {
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select quick test type
    const emailBtn = page.locator('button:has-text("Email Subject"), [data-testid*="email-subject"]').first();
    if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBtn.click();
    } else {
      const anyType = page.locator('[role="dialog"] button:not(:has-text("Cancel"))').first();
      if (!await anyType.isVisible({ timeout: 1000 }).catch(() => false)) {
        return false;
      }
      await anyType.click();
    }
    await page.waitForTimeout(400);

    // Fill form
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill(`Test content for history - ${Date.now()}`);
    }

    // Submit
    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      return false;
    }

    await submitBtn.click();

    // Wait for results
    try {
      await page.waitForSelector(
        SELECTORS.resultsPanel + ', [data-testid*="result"], [class*="result"]',
        { timeout: 90000 }
      );
      await page.waitForTimeout(1000);
      return true;
    } catch {
      return false;
    }
  }

  test('capture history list states', async ({ page }) => {
    // 8.1 History List

    // Try to capture empty state first (if localStorage is clear)
    const hasHistory = await navigateToHistory(page);

    // History empty state (might need to clear localStorage first)
    const emptyState = page.locator(
      ':has-text("No tests"), :has-text("empty"), ' +
      '[data-testid*="empty"], [class*="empty"]'
    ).first();

    if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'history', 'history-empty');
    }

    // Run one simulation to create history item
    await page.goto('/');
    await waitForStable(page);

    const ranFirst = await runSimulation(page);
    if (!ranFirst) {
      test.skip();
      return;
    }

    // Navigate to history
    await navigateToHistory(page);
    await page.waitForTimeout(500);

    // Single item state
    const historyItem = page.locator(
      '[data-testid*="history-item"], [class*="history-item"], ' +
      '[role="listitem"], li:has([class*="test"])'
    ).first();

    if (await historyItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'history', 'history-single-item');
    }

    // Run more simulations for multiple items
    await page.goto('/');
    await waitForStable(page);
    await runSimulation(page);

    await page.goto('/');
    await waitForStable(page);
    await runSimulation(page);

    // Navigate back to history
    await navigateToHistory(page);
    await page.waitForTimeout(500);

    // Multiple items state
    await screenshot(page, 'history', 'history-multiple-items');
  });

  test('capture history item interactions', async ({ page }) => {
    // Ensure we have history items
    const ranFirst = await runSimulation(page);

    await navigateToHistory(page);
    await page.waitForTimeout(500);

    // History item hover
    const historyItem = page.locator(
      '[data-testid*="history-item"], [class*="history-item"], ' +
      '[role="listitem"], li:has([class*="test"])'
    ).first();

    if (await historyItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyItem.hover();
      await page.waitForTimeout(150);
      await screenshot(page, 'history', 'history-item-hover');

      // Click to select
      await historyItem.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'history', 'history-item-selected');
    }
  });

  test('capture history item actions menu', async ({ page }) => {
    // 8.2 History Item Actions

    // Ensure we have history items
    await runSimulation(page);

    await navigateToHistory(page);
    await page.waitForTimeout(500);

    // Find menu trigger (three-dot menu)
    const menuTrigger = page.locator(
      'button[aria-label*="menu"], button[aria-label*="actions"], ' +
      '[data-testid*="menu-trigger"], [class*="menu-trigger"], ' +
      'button:has(svg[class*="dots"]), button:has([class*="ellipsis"])'
    ).first();

    if (await menuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'history', 'history-item-menu-trigger');

      // Open menu
      await menuTrigger.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'history', 'history-item-menu-open');

      // Hover on menu item
      const menuItem = page.locator(
        '[role="menuitem"], [class*="menu-item"], ' +
        'button:has-text("Delete"), button:has-text("View")'
      ).first();

      if (await menuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await menuItem.hover();
        await page.waitForTimeout(150);
        await screenshot(page, 'history', 'history-item-menu-hover');
      }

      await page.keyboard.press('Escape');
    } else {
      // Alternative: hover to reveal actions
      const historyItem = page.locator(
        '[data-testid*="history-item"], [class*="history-item"]'
      ).first();

      if (await historyItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await historyItem.hover();
        await page.waitForTimeout(300);

        // Look for action buttons that appear on hover
        const actionBtn = page.locator(
          'button:has-text("Delete"), button:has-text("View"), ' +
          '[data-testid*="action"]'
        ).first();

        if (await actionBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await screenshot(page, 'history', 'history-item-actions-visible');
        }
      }
    }
  });

  test('capture delete flow with modal', async ({ page }) => {
    // 8.3 Delete Flow

    // Ensure we have history items
    await runSimulation(page);

    await navigateToHistory(page);
    await page.waitForTimeout(500);

    // Find delete button (either in menu or directly visible)
    const menuTrigger = page.locator(
      'button[aria-label*="menu"], [data-testid*="menu-trigger"]'
    ).first();

    let deleteBtn = page.locator('button:has-text("Delete"), [data-testid*="delete"]').first();

    if (await menuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuTrigger.click();
      await page.waitForTimeout(300);

      deleteBtn = page.locator(
        '[role="menuitem"]:has-text("Delete"), ' +
        'button:has-text("Delete")'
      ).first();
    } else {
      // Hover on item to reveal delete button
      const historyItem = page.locator(
        '[data-testid*="history-item"], [class*="history-item"]'
      ).first();

      if (await historyItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await historyItem.hover();
        await page.waitForTimeout(300);
      }
    }

    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(300);

      // Delete confirmation modal
      const modal = page.locator(SELECTORS.modal);
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'history', 'delete-modal-open');

        // Hover cancel button
        const cancelBtn = page.locator(
          'button:has-text("Cancel"), button:has-text("No")'
        ).first();

        if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelBtn.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'history', 'delete-modal-hover-cancel');
        }

        // Hover confirm/delete button
        const confirmBtn = page.locator(
          'button:has-text("Delete"):not(:has-text("Cancel")), ' +
          'button:has-text("Confirm"), button:has-text("Yes")'
        ).first();

        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'history', 'delete-modal-hover-confirm');
        }

        // Cancel to close modal
        if (await cancelBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await cancelBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('record history management flow', async ({ page }, testInfo) => {
    // Record the complete history management flow per EXTRACTION-PLAN.md Part 12.4

    // Run a simulation to ensure history has items
    await runSimulation(page);

    // Navigate to history
    await navigateToHistory(page);
    await page.waitForTimeout(1000);

    // Select an item
    const historyItem = page.locator(
      '[data-testid*="history-item"], [class*="history-item"], ' +
      '[role="listitem"]'
    ).first();

    if (await historyItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyItem.click();
      await page.waitForTimeout(500);

      // View results (should show results for selected item)
      await page.waitForTimeout(1000);

      // Open menu
      const menuTrigger = page.locator(
        'button[aria-label*="menu"], [data-testid*="menu-trigger"]'
      ).first();

      if (await menuTrigger.isVisible({ timeout: 1000 }).catch(() => false)) {
        await menuTrigger.click();
        await page.waitForTimeout(500);

        // Click delete
        const deleteBtn = page.locator(
          '[role="menuitem"]:has-text("Delete"), button:has-text("Delete")'
        ).first();

        if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await deleteBtn.click();
          await page.waitForTimeout(500);

          // Show modal then cancel
          await page.waitForTimeout(1000);
          await page.keyboard.press('Escape');
        }
      }
    }

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('test-history-flow', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
