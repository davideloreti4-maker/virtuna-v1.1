---
phase: 11-extraction
plan: 04
type: execute
wave: 4
depends_on: [PLAN-03]
files_modified:
  - extraction/tests/07-results.spec.ts
  - extraction/tests/08-history.spec.ts
autonomous: true

must_haves:
  truths:
    - "Results panel sections captured: impact, attention, variants, insights, themes"
    - "Accordion expand/collapse states captured"
    - "History list states: empty, single, multiple items"
    - "Delete confirmation modal captured"
  artifacts:
    - path: "extraction/tests/07-results.spec.ts"
      provides: "Results panel section captures"
      contains: "test.describe('Results'"
    - path: "extraction/tests/08-history.spec.ts"
      provides: "Test history list and actions"
      contains: "test.describe('History'"
---

<objective>
Create Playwright tests for Parts 7-8 of EXTRACTION-PLAN.md: Results Panel and Test History.

Purpose: Capture all results panel sections and history management states.
Output: Test files for results and history with comprehensive section coverage.
</objective>

<context>
@.planning/phases/11-extraction/EXTRACTION-PLAN.md
@extraction/tests/helpers.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Results Panel Tests (Part 7)</name>
  <files>
    - extraction/tests/07-results.spec.ts
  </files>
  <action>
Create extraction/tests/07-results.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Results Panel', () => {
  // Helper to run a quick simulation and get to results
  async function runSimulation(page: import('@playwright/test').Page) {
    await page.goto('/');
    await waitForStable(page);

    // Open test type selector
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      return false;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Select email subject line (fastest)
    const typeBtn = page.locator('button:has-text("Email Subject"), button:has-text("Email")').first();
    if (!await typeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      return false;
    }

    await typeBtn.click();
    await page.waitForTimeout(400);

    // Fill form
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('Get 50% off your first order - Limited time!');
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
        SELECTORS.resultsPanel + ', [data-testid*="result"], [class*="result"], [class*="score"]',
        { timeout: 90000 }
      );
      await page.waitForTimeout(1000);
      return true;
    } catch {
      return false;
    }
  }

  test('capture results overview', async ({ page }, testInfo) => {
    // Desktop only

    const hasResults = await runSimulation(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // Results panel default state
    await screenshot(page, 'results', 'results-panel-default');

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(200);
    await screenshot(page, 'results', 'results-panel-scrolled');
  });

  test('capture impact score section', async ({ page }, testInfo) => {
    // Desktop only

    const hasResults = await runSimulation(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // Impact score
    const scoreSection = page.locator('[data-testid*="impact"], [class*="impact"], [class*="score"]').first();
    if (await scoreSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoreSection.scrollIntoViewIfNeeded();
      await screenshot(page, 'results', 'results-impact-score');

      // Labels (Poor, Average, Good, Excellent) - capture current state
      const label = page.locator('[class*="label"], [data-testid*="label"]').first();
      if (await label.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = await label.textContent();
        const labelName = text?.toLowerCase().replace(/\s+/g, '-') || 'label';
        await screenshot(page, 'results', `results-impact-label-${labelName}`);
      }
    }
  });

  test('capture attention breakdown section', async ({ page }, testInfo) => {
    // Desktop only

    const hasResults = await runSimulation(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // Find attention section
    const attentionSection = page.locator(SELECTORS.accordionSection('Attention')).first();
    const altSection = page.locator('[data-testid*="attention"], [class*="attention"]').first();

    const section = await attentionSection.isVisible({ timeout: 2000 }).catch(() => false)
      ? attentionSection
      : altSection;

    if (await section.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Collapsed state
      await screenshot(page, 'results', 'results-attention-collapsed');

      // Expand
      await section.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'results', 'results-attention-expanded');

      // Chart if visible
      const chart = page.locator('svg, canvas, [class*="chart"]').first();
      if (await chart.isVisible({ timeout: 1000 }).catch(() => false)) {
        await screenshot(page, 'results', 'results-attention-chart');

        // Hover on chart segment
        await chart.hover();
        await page.waitForTimeout(150);
        await screenshot(page, 'results', 'results-attention-hover');
      }
    }
  });

  test('capture variants section', async ({ page }, testInfo) => {
    // Desktop only

    const hasResults = await runSimulation(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    // Find variants section
    const variantsSection = page.locator(SELECTORS.accordionSection('Variant')).first();
    const altSection = page.locator('[data-testid*="variant"], [class*="variant"]').first();

    const section = await variantsSection.isVisible({ timeout: 2000 }).catch(() => false)
      ? variantsSection
      : altSection;

    if (await section.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Collapsed
      await screenshot(page, 'results', 'results-variants-collapsed');

      // Expand
      await section.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'results', 'results-variants-expanded');

      // Individual variants
      const variants = page.locator('[data-testid*="variant-card"], [class*="variant-card"]');
      const count = await variants.count();

      if (count > 0) {
        // Original
        await screenshot(page, 'results', 'results-variant-original');

        // AI variants
        for (let i = 1; i < Math.min(count, 3); i++) {
          await variants.nth(i).scrollIntoViewIfNeeded();
          await screenshot(page, 'results', `results-variant-ai-${i}`);
        }

        // Hover state
        await variants.first().hover();
        await page.waitForTimeout(100);
        await screenshot(page, 'results', 'results-variant-hover');

        // Copy button hover
        const copyBtn = page.locator('button:has-text("Copy"), [data-testid*="copy"]').first();
        if (await copyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await copyBtn.hover();
          await page.waitForTimeout(100);
          await screenshot(page, 'results', 'results-variant-copy');
        }
      }
    }
  });

  test('capture insights section', async ({ page }, testInfo) => {
    // Desktop only

    const hasResults = await runSimulation(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    const insightsSection = page.locator(SELECTORS.accordionSection('Insight')).first();
    const altSection = page.locator('[data-testid*="insight"], [class*="insight"]').first();

    const section = await insightsSection.isVisible({ timeout: 2000 }).catch(() => false)
      ? insightsSection
      : altSection;

    if (await section.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'results', 'results-insights-collapsed');

      await section.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'results', 'results-insights-expanded');

      // Individual insight item
      const item = page.locator('[data-testid*="insight-item"], [class*="insight-item"]').first();
      if (await item.isVisible({ timeout: 1000 }).catch(() => false)) {
        await screenshot(page, 'results', 'results-insight-item');
      }
    }
  });

  test('capture themes section', async ({ page }, testInfo) => {
    // Desktop only

    const hasResults = await runSimulation(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    const themesSection = page.locator(SELECTORS.accordionSection('Theme')).first();
    const altSection = page.locator('[data-testid*="theme"], [class*="theme"]').first();

    const section = await themesSection.isVisible({ timeout: 2000 }).catch(() => false)
      ? themesSection
      : altSection;

    if (await section.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'results', 'results-themes-collapsed');

      await section.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'results', 'results-themes-expanded');

      // Theme card
      const themeCard = page.locator('[data-testid*="theme-card"], [class*="theme-card"]').first();
      if (await themeCard.isVisible({ timeout: 1000 }).catch(() => false)) {
        await screenshot(page, 'results', 'results-theme-card');

        // Click for quotes
        await themeCard.click();
        await page.waitForTimeout(200);
        await screenshot(page, 'results', 'results-theme-quotes');
      }
    }
  });

  test('capture share button', async ({ page }, testInfo) => {
    // Desktop only

    const hasResults = await runSimulation(page);
    if (!hasResults) {
      test.skip();
      return;
    }

    const shareBtn = page.locator('button:has-text("Share"), [data-testid*="share"]').first();
    if (await shareBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'results', 'results-share-button');

      await shareBtn.hover();
      await page.waitForTimeout(100);
      await screenshot(page, 'results', 'results-share-hover');

      await shareBtn.click();
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'results-share-menu');
    }
  });
});
```
  </action>
  <verify>
- All results sections captured
- Accordion expand/collapse states
- Hover states for interactive elements
  </verify>
</task>

<task type="auto">
  <name>Task 2: Test History Tests (Part 8)</name>
  <files>
    - extraction/tests/08-history.spec.ts
  </files>
  <action>
Create extraction/tests/08-history.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Test History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture history list states', async ({ page }, testInfo) => {
    // Desktop only

    // Navigate to history (might be in sidebar or separate page)
    const historyLink = page.locator(
      'a:has-text("History"), ' +
      'button:has-text("History"), ' +
      '[data-testid*="history"]'
    ).first();

    // Or history might be visible on dashboard
    const historySection = page.locator(
      '[data-testid="history"], ' +
      '[class*="history"], ' +
      '[aria-label*="history"]'
    ).first();

    if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyLink.click();
      await page.waitForTimeout(500);
    }

    // History list
    const historyList = page.locator('[data-testid*="history-list"], [class*="history-list"], ul').first();

    if (await historyList.isVisible({ timeout: 3000 }).catch(() => false) ||
        await historySection.isVisible({ timeout: 2000 }).catch(() => false)) {

      // Check if empty or has items
      const items = page.locator('[data-testid*="history-item"], [class*="history-item"], li');
      const count = await items.count();

      if (count === 0) {
        await screenshot(page, 'history', 'history-empty');
      } else if (count === 1) {
        await screenshot(page, 'history', 'history-single-item');
      } else {
        await screenshot(page, 'history', 'history-multiple-items');
      }

      // Hover state on item
      if (count > 0) {
        const firstItem = items.first();
        await firstItem.hover();
        await page.waitForTimeout(100);
        await screenshot(page, 'history', 'history-item-hover');

        // Click to select
        await firstItem.click();
        await page.waitForTimeout(200);
        await screenshot(page, 'history', 'history-item-selected');
      }
    }
  });

  test('capture history item actions', async ({ page }, testInfo) => {
    // Desktop only

    // Navigate to history
    const historyLink = page.locator('a:has-text("History"), button:has-text("History")').first();
    if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyLink.click();
      await page.waitForTimeout(500);
    }

    // Find history items
    const items = page.locator('[data-testid*="history-item"], [class*="history-item"]');
    const count = await items.count();

    if (count === 0) {
      console.log('No history items found');
      return;
    }

    const firstItem = items.first();

    // Menu trigger (three dots)
    const menuTrigger = firstItem.locator(
      'button[aria-label*="menu"], ' +
      '[data-testid*="menu"], ' +
      'button:has([class*="dots"])'
    ).first();

    if (await menuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'history', 'history-item-menu-trigger');

      // Open menu
      await menuTrigger.click();
      await page.waitForTimeout(200);
      await screenshot(page, 'history', 'history-item-menu-open');

      // Hover menu item
      const menuItem = page.locator('[role="menuitem"], [data-testid*="menu-item"]').first();
      if (await menuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await menuItem.hover();
        await page.waitForTimeout(100);
        await screenshot(page, 'history', 'history-item-menu-hover');
      }

      await page.keyboard.press('Escape');
    }
  });

  test('capture delete flow', async ({ page }, testInfo) => {
    // Desktop only

    // Navigate to history
    const historyLink = page.locator('a:has-text("History"), button:has-text("History")').first();
    if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyLink.click();
      await page.waitForTimeout(500);
    }

    // Find delete trigger
    const items = page.locator('[data-testid*="history-item"], [class*="history-item"]');
    const count = await items.count();

    if (count === 0) {
      console.log('No history items for delete test');
      return;
    }

    // Open item menu
    const menuTrigger = items.first().locator('button[aria-label*="menu"]').first();
    if (await menuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuTrigger.click();
      await page.waitForTimeout(200);
    }

    // Click delete option
    const deleteOption = page.locator(
      '[role="menuitem"]:has-text("Delete"), ' +
      'button:has-text("Delete")'
    ).first();

    if (await deleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteOption.click();
      await page.waitForTimeout(300);

      // Confirmation modal
      const modal = page.locator('[role="alertdialog"], [role="dialog"]').first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'history', 'delete-modal-open');

        // Cancel button hover
        const cancelBtn = modal.locator('button:has-text("Cancel")').first();
        if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelBtn.hover();
          await page.waitForTimeout(100);
          await screenshot(page, 'history', 'delete-modal-hover-cancel');
        }

        // Confirm button hover
        const confirmBtn = modal.locator('button:has-text("Delete"), button:has-text("Confirm")').last();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.hover();
          await page.waitForTimeout(100);
          await screenshot(page, 'history', 'delete-modal-hover-confirm');
        }

        // Cancel (don't actually delete)
        await page.keyboard.press('Escape');
      }
    }
  });
});

test.describe('History Video Flow', () => {
  test.use({
    video: { mode: 'on', size: { width: 1440, height: 900 } },
  });

  test('record history management flow', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForStable(page);

    // Navigate to history
    const historyLink = page.locator('a:has-text("History"), button:has-text("History")').first();
    if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyLink.click();
      await page.waitForTimeout(1000);
    }

    // Interact with items
    const items = page.locator('[data-testid*="history-item"], [class*="history-item"]');
    const count = await items.count();

    if (count > 0) {
      // Select first item
      await items.first().click();
      await page.waitForTimeout(500);

      // Open menu
      const menuTrigger = items.first().locator('button[aria-label*="menu"]').first();
      if (await menuTrigger.isVisible({ timeout: 1000 }).catch(() => false)) {
        await menuTrigger.click();
        await page.waitForTimeout(300);

        // Hover options
        const menuItems = page.locator('[role="menuitem"]');
        for (let i = 0; i < await menuItems.count(); i++) {
          await menuItems.nth(i).hover();
          await page.waitForTimeout(200);
        }

        await page.keyboard.press('Escape');
      }
    }

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('history-management', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
```
  </action>
  <verify>
- History list states captured
- Item actions and menu states
- Delete confirmation modal captured
- Video for history flow
  </verify>
</task>

</tasks>

<verification>
- [ ] `extraction/tests/07-results.spec.ts` captures all result sections
- [ ] `extraction/tests/08-history.spec.ts` captures history states and actions
- [ ] Accordion expand/collapse states for results
- [ ] Delete modal with hover states
</verification>

<success_criteria>
- All results panel sections captured per EXTRACTION-PLAN.md Part 7
- History list and action states captured per Part 8
- Videos recorded for both flows
</success_criteria>
