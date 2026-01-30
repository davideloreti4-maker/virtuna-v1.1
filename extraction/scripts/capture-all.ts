/**
 * All-in-One Extraction Script
 *
 * Captures all screenshots in a single session with one manual login.
 *
 * Usage: npx tsx extraction/scripts/capture-all.ts
 */
import { chromium, Page } from 'playwright';
import { VIEWPORTS, ViewportName, ensureDir, scrollToBottom, waitForEnter, SCREENSHOTS_DIR } from './utils';
import * as path from 'path';

async function capture(page: Page, viewport: ViewportName, category: string, name: string): Promise<void> {
  const dir = path.join(SCREENSHOTS_DIR, viewport, category);
  ensureDir(dir);
  const filepath = path.join(dir, `${name}.png`);

  await scrollToBottom(page);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  ✓ ${filepath}`);
}

async function captureDashboard(page: Page, viewport: ViewportName): Promise<void> {
  console.log(`\n📸 Dashboard (${viewport})...`);

  await page.goto('https://app.societies.io');
  await page.waitForLoadState('networkidle');
  await capture(page, viewport, 'dashboard', 'default');
}

async function captureNavigation(page: Page, viewport: ViewportName): Promise<void> {
  console.log(`\n📸 Navigation (${viewport})...`);

  await page.goto('https://app.societies.io');
  await page.waitForLoadState('networkidle');

  // Sidebar
  await capture(page, viewport, 'navigation', 'sidebar-default');

  // Mobile drawer
  if (viewport === 'mobile') {
    const hamburger = page.locator('button[aria-label*="menu"], [class*="hamburger"], [class*="menu-toggle"]').first();
    if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hamburger.click();
      await page.waitForTimeout(300);
      await capture(page, viewport, 'navigation', 'drawer-open');
      await page.keyboard.press('Escape');
    }
  }
}

async function captureSelectors(page: Page, viewport: ViewportName): Promise<void> {
  console.log(`\n📸 Selectors (${viewport})...`);

  await page.goto('https://app.societies.io');
  await page.waitForLoadState('networkidle');

  // Society selector - look for it in sidebar
  const societyBtn = page.locator('[class*="society"], [data-testid*="society"]').first();
  if (await societyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await capture(page, viewport, 'selectors', 'society-selector-closed');
    await societyBtn.click();
    await page.waitForTimeout(300);
    await capture(page, viewport, 'selectors', 'society-selector-open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  // Test type selector - "New Test" button
  const newTestBtn = page.locator('button:has-text("New Test"), button:has-text("Create Test"), [class*="new-test"]').first();
  if (await newTestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await capture(page, viewport, 'selectors', 'test-type-closed');
    await newTestBtn.click();
    await page.waitForTimeout(300);
    await capture(page, viewport, 'selectors', 'test-type-open');
    await page.keyboard.press('Escape');
  }
}

async function captureForms(page: Page, viewport: ViewportName): Promise<void> {
  console.log(`\n📸 Forms (${viewport})...`);

  await page.goto('https://app.societies.io');
  await page.waitForLoadState('networkidle');

  // Try to open a test form
  const newTestBtn = page.locator('button:has-text("New Test"), button:has-text("Create Test")').first();
  if (await newTestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newTestBtn.click();
    await page.waitForTimeout(300);

    // Try TikTok option
    const tiktokOption = page.locator('button:has-text("TikTok"), [data-testid*="tiktok"]').first();
    if (await tiktokOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tiktokOption.click();
      await page.waitForTimeout(300);
      await capture(page, viewport, 'forms', 'tiktok-empty');

      // Fill form
      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.fill('Sample content for testing purposes. #test #demo');
        await capture(page, viewport, 'forms', 'tiktok-filled');
      }

      await page.keyboard.press('Escape');
    }
  }
}

async function captureSettings(page: Page, viewport: ViewportName): Promise<void> {
  console.log(`\n📸 Settings (${viewport})...`);

  // Try direct URL first
  await page.goto('https://app.societies.io/settings');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Check if we're on settings page
  if (page.url().includes('settings')) {
    await capture(page, viewport, 'settings', 'default');

    // Try each tab
    const tabs = ['profile', 'account', 'notifications', 'billing', 'team'];
    for (const tab of tabs) {
      const tabBtn = page.locator(`button:has-text("${tab}"), a:has-text("${tab}"), [data-testid*="${tab}"]`).first();
      if (await tabBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tabBtn.click();
        await page.waitForTimeout(300);
        await capture(page, viewport, 'settings', tab);
      }
    }
  }
}

async function captureModals(page: Page, viewport: ViewportName): Promise<void> {
  console.log(`\n📸 Modals (${viewport})...`);

  await page.goto('https://app.societies.io');
  await page.waitForLoadState('networkidle');

  // Feedback modal
  const feedbackBtn = page.locator('button:has-text("Feedback"), [data-testid*="feedback"]').first();
  if (await feedbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await feedbackBtn.click();
    await page.waitForTimeout(300);
    await capture(page, viewport, 'modals', 'feedback');
    await page.keyboard.press('Escape');
  }
}

async function main() {
  console.log('🚀 Starting extraction...');
  console.log('This script captures all screens with ONE manual login.\n');

  const browser = await chromium.launch({ headless: false });

  try {
    // Desktop captures
    console.log('\n═══════════════════════════════════════');
    console.log('  DESKTOP (1440x900)');
    console.log('═══════════════════════════════════════');

    const desktopContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto('https://app.societies.io');
    await waitForEnter('Log in via the browser, then press ENTER...');

    await captureDashboard(desktopPage, 'desktop');
    await captureNavigation(desktopPage, 'desktop');
    await captureSelectors(desktopPage, 'desktop');
    await captureForms(desktopPage, 'desktop');
    await captureSettings(desktopPage, 'desktop');
    await captureModals(desktopPage, 'desktop');

    // Save cookies for mobile session
    const cookies = await desktopContext.cookies();
    await desktopContext.close();

    // Mobile captures (reuse session)
    console.log('\n═══════════════════════════════════════');
    console.log('  MOBILE (375x812)');
    console.log('═══════════════════════════════════════');

    const mobileContext = await browser.newContext({ viewport: VIEWPORTS.mobile });
    await mobileContext.addCookies(cookies);
    const mobilePage = await mobileContext.newPage();

    await captureDashboard(mobilePage, 'mobile');
    await captureNavigation(mobilePage, 'mobile');
    await captureSelectors(mobilePage, 'mobile');
    await captureForms(mobilePage, 'mobile');
    await captureSettings(mobilePage, 'mobile');
    await captureModals(mobilePage, 'mobile');

    await mobileContext.close();

  } finally {
    await browser.close();
  }

  console.log('\n✅ Extraction complete!');
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}/`);
}

main().catch(console.error);
