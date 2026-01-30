import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Society Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture society selector modal states', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Society selector trigger (in sidebar)
    const trigger = page.locator(SELECTORS.societyTrigger).first();

    if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Trigger button
      await screenshot(page, 'society-selector', 'society-selector-trigger');

      // Open modal
      await trigger.click();
      await page.waitForTimeout(300);

      // Modal open state
      const modal = page.locator(SELECTORS.societyModal).first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'society-selector', 'society-selector-open');

        // Hover on a society item
        const societyItem = modal.locator('[data-testid*="society-item"], [class*="society-card"], li').first();
        if (await societyItem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await societyItem.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'society-selector', 'society-selector-hover-item');

          // Selected state (if there's a visual indicator)
          await screenshot(page, 'society-selector', 'society-selector-selected');
        }

        // Three-dot menu on society card
        const menuTrigger = modal.locator('button[aria-label*="menu"], [data-testid*="menu"], button:has([class*="dots"])').first();
        if (await menuTrigger.isVisible({ timeout: 1000 }).catch(() => false)) {
          await menuTrigger.click();
          await page.waitForTimeout(200);
          await screenshot(page, 'society-selector', 'society-card-menu-open');

          // Hover menu item
          const menuItem = page.locator('[role="menuitem"], [data-testid*="menu-item"]').first();
          if (await menuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
            await menuItem.hover();
            await page.waitForTimeout(100);
            await screenshot(page, 'society-selector', 'society-card-menu-hover');
          }
          await page.keyboard.press('Escape');
        }

        await page.keyboard.press('Escape');
      }
    }
  });

  test('capture create society flow', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Open society selector
    const trigger = page.locator(SELECTORS.societyTrigger).first();
    if (!await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await trigger.click();
    await page.waitForTimeout(300);

    // Create button
    const createBtn = page.locator(SELECTORS.createSocietyBtn).first();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'society-selector', 'create-society-trigger');

      // Open create modal
      await createBtn.click();
      await page.waitForTimeout(300);

      // Create modal
      const createModal = page.locator('[role="dialog"]').last();
      if (await createModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'society-selector', 'create-society-modal');

        // Step 1: Name input
        const nameInput = createModal.locator('input[type="text"], input[name*="name"]').first();
        if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await screenshot(page, 'society-selector', 'create-society-step1');

          // Fill name and proceed (but don't actually create)
          await nameInput.fill('Test Society');
          await page.waitForTimeout(200);
          await screenshot(page, 'society-selector', 'create-society-name-filled');
        }
      }

      await page.keyboard.press('Escape');
    }

    await page.keyboard.press('Escape');
  });
});
