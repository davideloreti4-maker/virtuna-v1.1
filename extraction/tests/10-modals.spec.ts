import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

/**
 * Part 10: Modals - Capture feedback modal and alert dialogs
 * Per EXTRACTION-PLAN.md sections 10.1-10.4
 * Note: Create Society Modal (10.2), Delete Test Modal (10.3),
 * and Test Type Selector Modal (10.4) are covered in their respective test files
 */

test.describe('Modals', () => {
  // Enable video recording for modal interactions
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
   * Find and return the feedback trigger button
   */
  async function findFeedbackTrigger(page: import('@playwright/test').Page) {
    const feedbackBtn = page.locator(
      'button:has-text("Feedback"), button:has-text("Leave Feedback"), ' +
      '[data-testid*="feedback"], [aria-label*="feedback"], ' +
      'button:has-text("Help"), [class*="feedback-trigger"]'
    ).first();

    return feedbackBtn;
  }

  test('capture feedback modal trigger', async ({ page }) => {
    // 10.1 Leave Feedback Modal - Trigger state
    const feedbackBtn = await findFeedbackTrigger(page);

    if (await feedbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await feedbackBtn.scrollIntoViewIfNeeded();
      await screenshot(page, 'modals', 'modal-feedback-trigger');
    } else {
      // Try looking in footer or sidebar
      const footerFeedback = page.locator(
        'footer button:has-text("Feedback"), ' +
        'aside button:has-text("Feedback")'
      ).first();

      if (await footerFeedback.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'modals', 'modal-feedback-trigger');
      } else {
        test.skip();
      }
    }
  });

  test('capture feedback modal open state', async ({ page }) => {
    // 10.1 Leave Feedback Modal - Open state
    const feedbackBtn = await findFeedbackTrigger(page);

    if (!await feedbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await feedbackBtn.click();
    await page.waitForTimeout(400);

    // Verify modal opened
    const modal = page.locator(SELECTORS.modal);
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'modals', 'modal-feedback-open');
    }

    await page.keyboard.press('Escape');
  });

  test('capture feedback modal textarea interactions', async ({ page }) => {
    // 10.1 Leave Feedback Modal - Textarea states
    const feedbackBtn = await findFeedbackTrigger(page);

    if (!await feedbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await feedbackBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator(SELECTORS.modal);
    if (!await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }

    // Find textarea in modal
    const textarea = modal.locator(
      'textarea, [contenteditable="true"], input[type="text"]'
    ).first();

    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click to focus
      await textarea.click();
      await page.waitForTimeout(200);
      await screenshot(page, 'modals', 'modal-feedback-textarea-focus');

      // Fill with content
      await textarea.fill('Great product! I love using it for my marketing research. The AI suggestions are very helpful.');
      await page.waitForTimeout(200);
      await screenshot(page, 'modals', 'modal-feedback-filled');
    }

    await page.keyboard.press('Escape');
  });

  test('capture feedback modal submit hover', async ({ page }) => {
    // 10.1 Leave Feedback Modal - Submit hover state
    const feedbackBtn = await findFeedbackTrigger(page);

    if (!await feedbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await feedbackBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator(SELECTORS.modal);
    if (!await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }

    // Fill textarea first (may be required for submit to be enabled)
    const textarea = modal.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
      await textarea.fill('Test feedback content');
      await page.waitForTimeout(200);
    }

    // Find submit button
    const submitBtn = modal.locator(
      'button:has-text("Submit"), button:has-text("Send"), ' +
      'button[type="submit"], [data-testid*="submit"]'
    ).first();

    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.hover();
      await page.waitForTimeout(150);
      await screenshot(page, 'modals', 'modal-feedback-submit-hover');
    }

    await page.keyboard.press('Escape');
  });

  test('capture generic modal structure', async ({ page }) => {
    // Capture generic modal elements (close button, overlay, etc.)
    // Using any available modal trigger

    // Try feedback first
    let feedbackBtn = await findFeedbackTrigger(page);

    if (!await feedbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try New Test button as fallback
      feedbackBtn = page.locator(SELECTORS.newTestBtn).first();
    }

    if (!await feedbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await feedbackBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator(SELECTORS.modal);
    if (!await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }

    // Modal with all elements visible
    await screenshot(page, 'modals', 'modal-generic-structure');

    // Close button
    const closeBtn = modal.locator(
      'button[aria-label*="close"], button[aria-label*="Close"], ' +
      '[data-testid*="close"], button:has(svg[class*="x"]), ' +
      'button:has([class*="close"])'
    ).first();

    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.hover();
      await page.waitForTimeout(150);
      await screenshot(page, 'modals', 'modal-close-hover');
    }

    // Overlay/backdrop click to close
    await page.keyboard.press('Escape');
  });

  test('capture alert dialog confirmation states', async ({ page }) => {
    // Alert dialogs appear for destructive actions (delete, etc.)
    // We need to trigger one - try delete from history

    // First, run a quick simulation to have something in history
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select a quick test type
    const emailBtn = page.locator('button:has-text("Email Subject")').first();
    if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBtn.click();
    } else {
      const anyType = page.locator('[role="dialog"] button:not(:has-text("Cancel"))').first();
      if (!await anyType.isVisible({ timeout: 1000 }).catch(() => false)) {
        test.skip();
        return;
      }
      await anyType.click();
    }
    await page.waitForTimeout(400);

    // Fill and submit
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('Test content for alert dialog');
    }

    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click();

      // Wait for simulation to complete
      try {
        await page.waitForSelector(
          SELECTORS.resultsPanel + ', [data-testid*="result"]',
          { timeout: 90000 }
        );
        await page.waitForTimeout(1000);
      } catch {
        test.skip();
        return;
      }
    }

    // Navigate to history
    const historyNav = page.locator(
      SELECTORS.sidebarItem('History') + ', a:has-text("History")'
    ).first();

    if (await historyNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyNav.click();
      await page.waitForTimeout(500);
    }

    // Find delete button or menu
    const menuTrigger = page.locator(
      'button[aria-label*="menu"], [data-testid*="menu-trigger"]'
    ).first();

    if (await menuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuTrigger.click();
      await page.waitForTimeout(300);
    }

    const deleteBtn = page.locator(
      'button:has-text("Delete"), [role="menuitem"]:has-text("Delete")'
    ).first();

    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(400);

      // Alert dialog should appear
      const alertDialog = page.locator(
        '[role="alertdialog"], [role="dialog"]:has-text("Delete"), ' +
        '[role="dialog"]:has-text("Confirm"), [role="dialog"]:has-text("Are you sure")'
      );

      if (await alertDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'modals', 'alert-dialog-default');

        // Cancel button hover
        const cancelBtn = alertDialog.locator(
          'button:has-text("Cancel"), button:has-text("No")'
        ).first();

        if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelBtn.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'modals', 'alert-dialog-cancel-hover');
        }

        // Confirm/destructive button hover
        const confirmBtn = alertDialog.locator(
          'button:has-text("Delete"), button:has-text("Confirm"), ' +
          'button:has-text("Yes"), button[class*="destructive"]'
        ).first();

        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'modals', 'alert-dialog-confirm-hover');
        }

        // Cancel to close
        if (await cancelBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await cancelBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('record modal flow video', async ({ page }, testInfo) => {
    // Record a complete modal interaction flow

    // Try feedback modal
    const feedbackBtn = await findFeedbackTrigger(page);

    if (await feedbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Open feedback modal
      await feedbackBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator(SELECTORS.modal);
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Interact with textarea
        const textarea = modal.locator('textarea').first();
        if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
          await textarea.click();
          await page.waitForTimeout(300);
          await textarea.fill('This is great feedback!');
          await page.waitForTimeout(500);
        }

        // Hover submit
        const submitBtn = modal.locator('button:has-text("Submit"), button:has-text("Send")').first();
        if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitBtn.hover();
          await page.waitForTimeout(300);
        }

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // Also try test type selector modal
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (await newTestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newTestBtn.click();
      await page.waitForTimeout(500);

      // Hover a few options
      const options = page.locator('[role="dialog"] button:not(:has-text("Cancel"))');
      const optionCount = await options.count();

      for (let i = 0; i < Math.min(optionCount, 3); i++) {
        await options.nth(i).hover();
        await page.waitForTimeout(300);
      }

      await page.keyboard.press('Escape');
    }

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('modal-interactions', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
