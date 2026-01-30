import { chromium } from 'playwright';
import { ViewportName, captureScreen, createAuthContext, ensureDir } from './utils';

/**
 * Capture all selector states from app.societies.io
 * - Society Selector (EXT-02): closed, open, hover, create modal
 * - View Selector (EXT-03): closed, open, dropdown options
 * - Test Type Selector (EXT-04): closed, open, hover states
 */
async function captureSelectors(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  for (const viewport of ['desktop', 'mobile'] as ViewportName[]) {
    console.log(`\n=== Capturing selectors for ${viewport} ===`);
    const context = await createAuthContext(browser, viewport);
    const page = await context.newPage();

    await page.goto('https://app.societies.io/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const outputDir = `./extraction/screenshots/${viewport}/selectors`;
    ensureDir(outputDir);

    // ===== SOCIETY SELECTOR (EXT-02) =====
    console.log('Capturing society selector...');

    // Look for society selector in sidebar - typically a dropdown or button with society name
    // Common patterns: sidebar dropdown, avatar with dropdown, branded header button
    const societySelectors = [
      '[data-testid="society-selector"]',
      '[data-testid="society-dropdown"]',
      '[aria-label*="society"]',
      '[aria-label*="Society"]',
      'button[class*="society"]',
      'div[class*="society-select"]',
      '.sidebar button:first-child',
      'nav button:has-text("Society")',
      '[class*="SocietySwitcher"]',
      '[class*="society-switcher"]',
    ];

    let societyTrigger = null;
    for (const selector of societySelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible().catch(() => false)) {
        societyTrigger = el;
        console.log(`Found society selector: ${selector}`);
        break;
      }
    }

    if (societyTrigger) {
      // Closed state
      await captureScreen(page, viewport, 'selectors', 'society-selector', 'closed');

      // Open state
      await societyTrigger.click();
      await page.waitForTimeout(500);
      await captureScreen(page, viewport, 'selectors', 'society-selector', 'open');

      // Look for society items to hover
      const societyItems = page.locator('[role="menuitem"], [role="option"], li[class*="society"], div[class*="society-item"]');
      const itemCount = await societyItems.count();
      if (itemCount > 0) {
        await societyItems.first().hover();
        await page.waitForTimeout(200);
        await captureScreen(page, viewport, 'selectors', 'society-selector', 'hover-item');
      }

      // Look for create society button
      const createBtns = [
        'button:has-text("Create")',
        'button:has-text("New Society")',
        'button:has-text("Add Society")',
        '[data-testid*="create"]',
        '[aria-label*="Create"]',
      ];

      for (const createSelector of createBtns) {
        const createBtn = page.locator(createSelector).first();
        if (await createBtn.isVisible().catch(() => false)) {
          await createBtn.click();
          await page.waitForTimeout(500);
          await captureScreen(page, viewport, 'selectors', 'society-create', 'modal');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          break;
        }
      }

      // Close society selector
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      console.log('Society selector not found - capturing page state for reference');
      await captureScreen(page, viewport, 'selectors', 'society-selector', 'not-found');
    }

    // ===== VIEW SELECTOR (EXT-03) =====
    console.log('Capturing view selector...');

    const viewSelectors = [
      '[data-testid="view-selector"]',
      '[data-testid="view-dropdown"]',
      '[aria-label*="View"]',
      'button:has-text("View")',
      '[class*="view-select"]',
      '[class*="ViewSelector"]',
      'select[name*="view"]',
    ];

    let viewTrigger = null;
    for (const selector of viewSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible().catch(() => false)) {
        viewTrigger = el;
        console.log(`Found view selector: ${selector}`);
        break;
      }
    }

    if (viewTrigger) {
      await captureScreen(page, viewport, 'selectors', 'view-selector', 'closed');

      await viewTrigger.click();
      await page.waitForTimeout(500);
      await captureScreen(page, viewport, 'selectors', 'view-selector', 'open');

      // Try to capture each dropdown option (Country, City, Generation, Role Level)
      const viewOptions = ['country', 'city', 'generation', 'role', 'level'];
      for (const option of viewOptions) {
        const optionPatterns = [
          `[data-testid*="${option}"]`,
          `button:has-text("${option}")`,
          `[role="option"]:has-text("${option}")`,
          `li:has-text("${option}")`,
        ];

        for (const pattern of optionPatterns) {
          const optionEl = page.locator(pattern).first();
          if (await optionEl.isVisible().catch(() => false)) {
            await optionEl.click();
            await page.waitForTimeout(300);
            await captureScreen(page, viewport, 'selectors', 'view-selector', option);
            break;
          }
        }
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      console.log('View selector not found - capturing page state for reference');
      await captureScreen(page, viewport, 'selectors', 'view-selector', 'not-found');
    }

    // ===== TEST TYPE SELECTOR (EXT-04) =====
    console.log('Capturing test type selector...');

    const testTypeTriggers = [
      '[data-testid="new-test"]',
      '[data-testid="create-test"]',
      'button:has-text("New Test")',
      'button:has-text("Create Test")',
      'button:has-text("Add Test")',
      '[aria-label*="New Test"]',
      '[aria-label*="Create Test"]',
      'a[href*="/new"]',
      'a[href*="/create"]',
    ];

    let testTrigger = null;
    for (const selector of testTypeTriggers) {
      const el = page.locator(selector).first();
      if (await el.isVisible().catch(() => false)) {
        testTrigger = el;
        console.log(`Found test type trigger: ${selector}`);
        break;
      }
    }

    if (testTrigger) {
      await captureScreen(page, viewport, 'selectors', 'test-type', 'closed');

      await testTrigger.click();
      await page.waitForTimeout(500);
      await captureScreen(page, viewport, 'selectors', 'test-type', 'open');

      // Capture hover states on test types
      const testTypes = ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook', 'linkedin'];
      for (const type of testTypes) {
        const typePatterns = [
          `[data-testid*="${type}"]`,
          `button:has-text("${type}")`,
          `[class*="${type}"]`,
          `div:has-text("${type}")`,
        ];

        for (const pattern of typePatterns) {
          const typeEl = page.locator(pattern).first();
          if (await typeEl.isVisible().catch(() => false)) {
            await typeEl.hover();
            await page.waitForTimeout(200);
            await captureScreen(page, viewport, 'selectors', 'test-type', `hover-${type}`);
            break;
          }
        }
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      console.log('Test type trigger not found - capturing page state for reference');
      await captureScreen(page, viewport, 'selectors', 'test-type', 'not-found');
    }

    await context.close();
  }

  await browser.close();
  console.log('\n=== Selectors capture complete! ===');
}

captureSelectors().catch(console.error);
