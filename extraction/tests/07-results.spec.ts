import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

/**
 * Part 7: Results Panel - Capture all result sections
 * Per EXTRACTION-PLAN.md sections 7.1-7.7
 */

// Result section names per EXTRACTION-PLAN.md
const RESULT_SECTIONS = [
  'impact',
  'attention',
  'variants',
  'insights',
  'themes',
] as const;

test.describe('Results', () => {
  // Enable video recording for results tests
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
   * Helper to run a simulation and get to results panel
   */
  async function runSimulationToResults(page: import('@playwright/test').Page): Promise<boolean> {
    // Open test type selector
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select Email Subject Line (quick test type)
    const emailBtn = page.locator('button:has-text("Email Subject"), [data-testid*="email-subject"]').first();
    if (await emailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBtn.click();
    } else {
      // Fallback to any available type
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
      await textarea.fill('Your exclusive early access starts now - limited spots available!');
    }

    // Submit form
    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      return false;
    }

    await submitBtn.click();

    // Wait for results to appear
    try {
      await page.waitForSelector(
        SELECTORS.resultsPanel + ', [data-testid*="result"], [class*="result"], [class*="score"]',
        { timeout: 90000 }
      );
      await page.waitForTimeout(2000); // Let results fully render
      return true;
    } catch {
      console.log('Results did not appear within timeout');
      return false;
    }
  }

  test('capture results panel overview', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // 7.1 Results Overview
    await screenshot(page, 'results', 'results-panel-default');

    // Scroll the results panel
    const resultsPanel = page.locator(SELECTORS.resultsPanel + ', [class*="result"]').first();
    if (await resultsPanel.isVisible({ timeout: 1000 }).catch(() => false)) {
      await resultsPanel.evaluate(el => el.scrollTo(0, el.scrollHeight / 2));
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'results-panel-scrolled');
    }
  });

  test('capture impact score section', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // 7.2 Impact Score Section
    const impactSection = page.locator(
      '[data-testid*="impact"], [class*="impact"], ' +
      '[class*="score"]:has-text("Impact"), ' +
      'h2:has-text("Impact"), h3:has-text("Impact")'
    ).first();

    if (await impactSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await impactSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'results-impact-score');

      // Try to capture different labels if visible
      const labelSelectors = ['Poor', 'Average', 'Good', 'Excellent'];
      for (const label of labelSelectors) {
        const labelEl = page.locator(`text="${label}", :has-text("${label}")`).first();
        if (await labelEl.isVisible({ timeout: 500 }).catch(() => false)) {
          await screenshot(page, 'results', `results-impact-label-${label.toLowerCase()}`);
          break; // Only capture the current state
        }
      }
    }
  });

  test('capture attention breakdown section', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // 7.3 Attention Breakdown
    const attentionTrigger = page.locator(
      SELECTORS.accordionSection('Attention') + ', ' +
      'button:has-text("Attention"), [data-testid*="attention"]'
    ).first();

    if (await attentionTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Collapsed state
      await attentionTrigger.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'results-attention-collapsed');

      // Expand
      await attentionTrigger.click();
      await page.waitForTimeout(400);
      await screenshot(page, 'results', 'results-attention-expanded');

      // Chart if visible
      const chart = page.locator(
        '[data-testid*="chart"], [class*="chart"], ' +
        'svg:has(path), canvas'
      ).first();

      if (await chart.isVisible({ timeout: 1000 }).catch(() => false)) {
        await screenshot(page, 'results', 'results-attention-chart');

        // Hover on chart segment
        await chart.hover();
        await page.waitForTimeout(200);
        await screenshot(page, 'results', 'results-attention-hover');
      }
    }
  });

  test('capture variants section', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // 7.4 Variants Section
    const variantsTrigger = page.locator(
      SELECTORS.accordionSection('Variants') + ', ' +
      'button:has-text("Variant"), [data-testid*="variant"]'
    ).first();

    if (await variantsTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Collapsed state
      await variantsTrigger.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'results-variants-collapsed');

      // Expand
      await variantsTrigger.click();
      await page.waitForTimeout(400);
      await screenshot(page, 'results', 'results-variants-expanded');

      // Original content
      const original = page.locator(
        '[data-testid*="original"], [class*="original"], ' +
        ':has-text("Original"):not(button)'
      ).first();

      if (await original.isVisible({ timeout: 1000 }).catch(() => false)) {
        await original.scrollIntoViewIfNeeded();
        await screenshot(page, 'results', 'results-variant-original');
      }

      // AI variants
      const variants = page.locator('[data-testid*="variant"], [class*="variant-card"]');
      const variantCount = await variants.count();

      for (let i = 0; i < Math.min(variantCount, 2); i++) {
        const variant = variants.nth(i);
        if (await variant.isVisible({ timeout: 500 }).catch(() => false)) {
          await variant.scrollIntoViewIfNeeded();
          await screenshot(page, 'results', `results-variant-ai-${i + 1}`);
        }
      }

      // Hover on variant card
      const variantCard = page.locator('[class*="variant"], [data-testid*="variant"]').first();
      if (await variantCard.isVisible({ timeout: 1000 }).catch(() => false)) {
        await variantCard.hover();
        await page.waitForTimeout(150);
        await screenshot(page, 'results', 'results-variant-hover');

        // Copy button hover
        const copyBtn = page.locator(
          'button:has-text("Copy"), button[aria-label*="copy"], [data-testid*="copy"]'
        ).first();

        if (await copyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await copyBtn.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'results', 'results-variant-copy');
        }
      }
    }
  });

  test('capture insights section', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // 7.5 Insights Section
    const insightsTrigger = page.locator(
      SELECTORS.accordionSection('Insights') + ', ' +
      'button:has-text("Insight"), [data-testid*="insight"]'
    ).first();

    if (await insightsTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Collapsed state
      await insightsTrigger.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'results-insights-collapsed');

      // Expand
      await insightsTrigger.click();
      await page.waitForTimeout(400);
      await screenshot(page, 'results', 'results-insights-expanded');

      // Individual insight item
      const insightItem = page.locator('[class*="insight-item"], [data-testid*="insight-item"]').first();
      if (await insightItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await insightItem.scrollIntoViewIfNeeded();
        await screenshot(page, 'results', 'results-insight-item');
      }
    }
  });

  test('capture themes section', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // 7.6 Themes Section
    const themesTrigger = page.locator(
      SELECTORS.accordionSection('Themes') + ', ' +
      'button:has-text("Theme"), [data-testid*="theme"]'
    ).first();

    if (await themesTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Collapsed state
      await themesTrigger.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'results-themes-collapsed');

      // Expand
      await themesTrigger.click();
      await page.waitForTimeout(400);
      await screenshot(page, 'results', 'results-themes-expanded');

      // Theme card
      const themeCard = page.locator('[class*="theme-card"], [data-testid*="theme-card"]').first();
      if (await themeCard.isVisible({ timeout: 1000 }).catch(() => false)) {
        await themeCard.scrollIntoViewIfNeeded();
        await screenshot(page, 'results', 'results-theme-card');

        // Click theme to show quotes
        await themeCard.click();
        await page.waitForTimeout(300);
        await screenshot(page, 'results', 'results-theme-quotes');
      }
    }
  });

  test('capture share button', async ({ page }) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // 7.7 Share Button
    const shareBtn = page.locator(
      'button:has-text("Share"), button[aria-label*="share"], [data-testid*="share"]'
    ).first();

    if (await shareBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await shareBtn.scrollIntoViewIfNeeded();
      await screenshot(page, 'results', 'results-share-button');

      // Hover state
      await shareBtn.hover();
      await page.waitForTimeout(150);
      await screenshot(page, 'results', 'results-share-hover');

      // Click to open menu
      await shareBtn.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'results', 'results-share-menu');

      await page.keyboard.press('Escape');
    }
  });

  test('record results expansion flow', async ({ page }, testInfo) => {
    const hasResults = await runSimulationToResults(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // Expand each section for video recording
    for (const section of RESULT_SECTIONS) {
      const trigger = page.locator(
        SELECTORS.accordionSection(section) + ', ' +
        `button:has-text("${section}"), [data-testid*="${section}"]`
      ).first();

      if (await trigger.isVisible({ timeout: 1000 }).catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await trigger.click();
        await page.waitForTimeout(500);
      }
    }

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('results-expand', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
