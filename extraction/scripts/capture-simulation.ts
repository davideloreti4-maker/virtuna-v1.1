/**
 * Simulation, Results, and Test History Capture Script
 *
 * Captures:
 * - Simulation loading phases (1-4 plus complete)
 * - Results panel states (default, expanded sections)
 * - Test history states (empty, with items, delete modal)
 *
 * Usage: npx tsx extraction/scripts/capture-simulation.ts
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

async function captureSimulation() {
  console.log('Starting simulation and results capture...');

  const browser = await chromium.launch({ headless: false });

  for (const viewportName of ['desktop', 'mobile'] as ViewportName[]) {
    console.log(`\n=== Capturing ${viewportName} viewport ===`);

    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: VIEWPORTS[viewportName],
    });
    const page = await context.newPage();

    // Navigate to app
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // ========================================
    // SIMULATION LOADING PHASES
    // ========================================
    console.log('\n--- Capturing Simulation Loading Phases ---');

    // Ensure simulation directories exist
    ensureDir(path.join(SCREENSHOTS_DIR, viewportName, 'simulation'));

    // Start a new test to capture simulation phases
    // First, navigate to the test form / create test page
    try {
      // Look for "New Test" or similar button to start simulation
      const newTestBtn = page.locator('button:has-text("New Test"), button:has-text("Create Test"), a:has-text("New Test")').first();
      if (await newTestBtn.isVisible({ timeout: 3000 })) {
        await newTestBtn.click();
        await page.waitForTimeout(1000);
      }

      // Fill in test form fields if present
      const textInput = page.locator('textarea, input[type="text"]').first();
      if (await textInput.isVisible({ timeout: 2000 })) {
        await textInput.fill('Test content for simulation capture');
      }

      // Look for simulate button
      const simulateBtn = page.locator('button:has-text("Simulate"), button:has-text("Run"), button:has-text("Test")').first();
      if (await simulateBtn.isVisible({ timeout: 2000 })) {
        await simulateBtn.click();

        // Capture loading phases rapidly
        // Phase 1 - Initial loading
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, viewportName, 'simulation', 'loading-phase-1.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/simulation/loading-phase-1.png`);

        // Phase 2
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, viewportName, 'simulation', 'loading-phase-2.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/simulation/loading-phase-2.png`);

        // Phase 3
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, viewportName, 'simulation', 'loading-phase-3.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/simulation/loading-phase-3.png`);

        // Phase 4
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, viewportName, 'simulation', 'loading-phase-4.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/simulation/loading-phase-4.png`);

        // Wait for completion
        await page.waitForTimeout(5000);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, viewportName, 'simulation', 'loading-complete.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/simulation/loading-complete.png`);
      }
    } catch (e) {
      console.log('Note: Could not capture all simulation phases - proceeding with available states');
    }

    // ========================================
    // RESULTS PANEL
    // ========================================
    console.log('\n--- Capturing Results Panel ---');
    ensureDir(path.join(SCREENSHOTS_DIR, viewportName, 'results'));

    try {
      // Navigate to results or wait for simulation to complete
      await page.waitForTimeout(2000);

      // Capture default state
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, viewportName, 'results', 'panel-default.png'),
        fullPage: true,
      });
      console.log(`Captured: ${viewportName}/results/panel-default.png`);

      // Try to find and expand different sections
      const sections = [
        { name: 'impact-score', selector: 'text=Impact Score, text=Score, [data-testid="impact-score"]' },
        { name: 'attention', selector: 'text=Attention, [data-testid="attention"]' },
        { name: 'variants', selector: 'text=Variants, [data-testid="variants"]' },
        { name: 'insights', selector: 'text=Insights, [data-testid="insights"]' },
        { name: 'themes', selector: 'text=Themes, [data-testid="themes"]' },
      ];

      for (const section of sections) {
        try {
          const sectionElement = page.locator(section.selector).first();
          if (await sectionElement.isVisible({ timeout: 1000 })) {
            await sectionElement.click();
            await page.waitForTimeout(500);
            await page.screenshot({
              path: path.join(SCREENSHOTS_DIR, viewportName, 'results', `${section.name}.png`),
              fullPage: true,
            });
            console.log(`Captured: ${viewportName}/results/${section.name}.png`);
          }
        } catch {
          console.log(`Note: Section ${section.name} not found or not expandable`);
        }
      }

      // Capture attention expanded specifically
      try {
        const attentionExpand = page.locator('text=Attention').first();
        if (await attentionExpand.isVisible({ timeout: 1000 })) {
          await attentionExpand.click();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, viewportName, 'results', 'attention-expanded.png'),
            fullPage: true,
          });
          console.log(`Captured: ${viewportName}/results/attention-expanded.png`);
        }
      } catch {
        console.log('Note: Attention section expansion not captured');
      }
    } catch (e) {
      console.log('Note: Could not capture all results panel states');
    }

    // ========================================
    // TEST HISTORY
    // ========================================
    console.log('\n--- Capturing Test History ---');
    ensureDir(path.join(SCREENSHOTS_DIR, viewportName, 'history'));

    try {
      // Navigate to history section
      const historyNav = page.locator('text=History, a[href*="history"], button:has-text("History")').first();
      if (await historyNav.isVisible({ timeout: 2000 })) {
        await historyNav.click();
        await page.waitForTimeout(1500);
      }

      // Capture current history state (may be empty or with items)
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, viewportName, 'history', 'with-items.png'),
        fullPage: true,
      });
      console.log(`Captured: ${viewportName}/history/with-items.png`);

      // Try to select a history item
      const historyItem = page.locator('[data-testid="history-item"], .history-item, li:has-text("Test")').first();
      if (await historyItem.isVisible({ timeout: 1500 })) {
        await historyItem.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, viewportName, 'history', 'item-selected.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/history/item-selected.png`);

        // Try to trigger delete modal
        const deleteBtn = page.locator('button:has-text("Delete"), [aria-label="Delete"]').first();
        if (await deleteBtn.isVisible({ timeout: 1000 })) {
          await deleteBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, viewportName, 'history', 'delete-modal.png'),
            fullPage: true,
          });
          console.log(`Captured: ${viewportName}/history/delete-modal.png`);

          // Close the modal
          const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
          if (await cancelBtn.isVisible({ timeout: 1000 })) {
            await cancelBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }

      // Capture empty state if possible (navigate to empty society or clear filters)
      try {
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, viewportName, 'history', 'empty.png'),
          fullPage: true,
        });
        console.log(`Captured: ${viewportName}/history/empty.png (current state)`);
      } catch {
        console.log('Note: Empty history state capture skipped');
      }
    } catch (e) {
      console.log('Note: Could not capture all history states');
    }

    await context.close();
  }

  await browser.close();
  console.log('\n=== Simulation capture complete! ===');
}

captureSimulation().catch(console.error);
