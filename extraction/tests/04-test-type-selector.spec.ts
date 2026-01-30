import { test, expect, screenshot, waitForStable, SELECTORS, TEST_TYPES } from './helpers';

test.describe('Test Type Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture test type selector modal', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // New Test button
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();

    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('New Test button not found, skipping');
      return;
    }

    // Trigger button
    await screenshot(page, 'test-type-selector', 'test-type-trigger');

    // Open modal
    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Modal with all test types
    const modal = page.locator(SELECTORS.testTypeModal).first();
    if (!await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try any dialog
      const anyModal = page.locator('[role="dialog"]').first();
      if (!await anyModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Test type modal not visible');
        return;
      }
    }

    await screenshot(page, 'test-type-selector', 'test-type-modal-open');

    // Category screenshots
    const categories = [
      { name: 'Survey', file: 'category-survey' },
      { name: 'Marketing', file: 'category-marketing' },
      { name: 'Social', file: 'category-social' },
      { name: 'Communication', file: 'category-communication' },
      { name: 'Product', file: 'category-product' },
    ];

    for (const cat of categories) {
      const categoryHeader = page.locator(`h3:has-text("${cat.name}"), [class*="category"]:has-text("${cat.name}")`).first();
      if (await categoryHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
        await categoryHeader.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        await screenshot(page, 'test-type-selector', cat.file);
      }
    }

    await page.keyboard.press('Escape');
  });

  test('capture each test type hover and selection', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Open modal
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Capture hover/selected for each test type
    for (const testType of TEST_TYPES) {
      const typeButton = page.locator(SELECTORS.testTypeOption(testType)).first();

      // Also try alternate selectors
      const altSelectors = [
        `button:has-text("${testType.replace('-', ' ')}")`,
        `[data-testid*="${testType}"]`,
        `[class*="${testType}"]`,
      ];

      let found = await typeButton.isVisible({ timeout: 1000 }).catch(() => false);
      if (!found) {
        for (const sel of altSelectors) {
          const alt = page.locator(sel).first();
          if (await alt.isVisible({ timeout: 500 }).catch(() => false)) {
            await alt.hover();
            found = true;
            break;
          }
        }
      }

      if (found) {
        // Hover state
        await typeButton.hover();
        await page.waitForTimeout(150);
        await screenshot(page, 'test-type-selector', `test-type-${testType}-hover`);

        // Selected state (click but capture before form opens)
        // Note: Some UIs show selection before transitioning
      }
    }

    await page.keyboard.press('Escape');
  });
});
