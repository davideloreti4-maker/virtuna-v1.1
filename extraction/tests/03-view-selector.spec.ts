import { test, expect, screenshot, waitForStable } from './helpers';

test.describe('View Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture view selector dropdown states', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // View selector trigger (usually in toolbar or header)
    const viewTrigger = page.locator(
      '[data-testid="view-selector"], ' +
      'button:has-text("View"), ' +
      '[class*="view-selector"], ' +
      'select[name*="view"]'
    ).first();

    if (!await viewTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try alternate: look for dropdown with view-related text
      const altTrigger = page.locator('button:has-text("Country"), button:has-text("City"), button:has-text("Generation")').first();
      if (!await altTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('View selector not found, skipping');
        return;
      }
    }

    // Closed state
    await screenshot(page, 'navigation', 'view-selector-closed');

    // Open dropdown
    await viewTrigger.click();
    await page.waitForTimeout(300);

    // Open state
    const dropdown = page.locator('[role="listbox"], [role="menu"], [data-state="open"]').first();
    if (await dropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'navigation', 'view-selector-open');

      // Capture each submenu category
      const categories = ['Country', 'City', 'Generation', 'Role Level'];
      for (const category of categories) {
        const categoryOption = dropdown.locator(`button:has-text("${category}"), [role="option"]:has-text("${category}")`).first();
        if (await categoryOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await categoryOption.hover();
          await page.waitForTimeout(200);
          await screenshot(page, 'navigation', `view-selector-${category.toLowerCase().replace(' ', '-')}`);
        }
      }

      // Option hover state
      const anyOption = dropdown.locator('[role="option"], button').first();
      if (await anyOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await anyOption.hover();
        await page.waitForTimeout(100);
        await screenshot(page, 'navigation', 'view-selector-option-hover');

        // Select an option
        await anyOption.click();
        await page.waitForTimeout(300);
        await screenshot(page, 'navigation', 'view-selector-selected');
      }
    }

    await page.keyboard.press('Escape');
  });
});
