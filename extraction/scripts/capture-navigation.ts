/**
 * Navigation and Sidebar Capture Script
 *
 * Captures navigation states at desktop and mobile viewports:
 * - Sidebar default state
 * - Sidebar hover states on nav items
 * - Mobile drawer open/closed
 * - Network visualization area
 */

import { chromium } from 'playwright';
import {
  VIEWPORTS,
  ViewportName,
  captureScreen,
  createAuthContext,
  scrollToBottom,
  ensureDir,
  SCREENSHOTS_DIR,
} from './utils';

const BASE_URL = 'https://app.societies.io';

async function captureNavigation(): Promise<void> {
  console.log('Starting navigation capture...');

  // Ensure directories exist
  ensureDir(`${SCREENSHOTS_DIR}/desktop/navigation`);
  ensureDir(`${SCREENSHOTS_DIR}/mobile/navigation`);
  ensureDir(`${SCREENSHOTS_DIR}/desktop/dashboard`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Desktop navigation capture
    console.log('\nCapturing desktop navigation...');
    const desktopContext = await createAuthContext(browser, 'desktop');
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await desktopPage.waitForLoadState('networkidle');
    await desktopPage.waitForTimeout(2000);

    // 1. Capture sidebar default state
    console.log('Capturing sidebar default state...');
    await captureScreen(desktopPage, 'desktop', 'navigation', 'sidebar-default');

    // 2. Capture sidebar with hover states on nav items
    const navItems = await desktopPage.locator('nav a, [role="navigation"] a, aside a, .sidebar a, [class*="sidebar"] a, [class*="nav"] a').all();
    console.log(`Found ${navItems.length} nav items to hover...`);

    for (let i = 0; i < Math.min(navItems.length, 5); i++) {
      try {
        const item = navItems[i];
        const isVisible = await item.isVisible({ timeout: 1000 });
        if (isVisible) {
          const text = await item.textContent();
          const itemName = text?.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20) || `item-${i}`;
          console.log(`Hovering nav item: ${itemName}`);

          await item.hover();
          await desktopPage.waitForTimeout(300);
          await captureScreen(desktopPage, 'desktop', 'navigation', `sidebar-hover-${itemName}`);
        }
      } catch (e) {
        console.log(`Could not hover nav item ${i}: ${e}`);
      }
    }

    // 3. Capture network visualization area
    console.log('Capturing network visualization area...');
    try {
      // Look for network/graph visualization container
      const networkSelectors = [
        '[data-testid="network-visualization"]',
        '.network-container',
        '[class*="network"]',
        '[class*="graph"]',
        'canvas',
        'svg[class*="network"]',
        '[class*="visualization"]',
      ];

      let networkElement = null;
      for (const selector of networkSelectors) {
        const element = desktopPage.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          networkElement = element;
          console.log(`Found network element with selector: ${selector}`);
          break;
        }
      }

      if (networkElement) {
        await networkElement.screenshot({ path: `${SCREENSHOTS_DIR}/desktop/dashboard/network-default.png` });
        console.log(`Captured: ${SCREENSHOTS_DIR}/desktop/dashboard/network-default.png`);

        // Try to find and interact with filter pills
        const filterPills = await desktopPage.locator('[class*="filter"], [class*="pill"], [data-testid*="filter"]').all();
        if (filterPills.length > 0) {
          console.log(`Found ${filterPills.length} filter elements...`);
          try {
            await filterPills[0].click();
            await desktopPage.waitForTimeout(500);
            await networkElement.screenshot({ path: `${SCREENSHOTS_DIR}/desktop/dashboard/network-with-filters.png` });
            console.log(`Captured: ${SCREENSHOTS_DIR}/desktop/dashboard/network-with-filters.png`);
          } catch (e) {
            console.log(`Could not interact with filters: ${e}`);
          }
        }
      } else {
        // Fallback: capture the main content area as network visualization
        console.log('No specific network element found, capturing main content area...');
        await captureScreen(desktopPage, 'desktop', 'dashboard', 'network-default');
      }
    } catch (e) {
      console.log(`Could not capture network visualization: ${e}`);
    }

    await desktopContext.close();

    // Mobile navigation capture
    console.log('\nCapturing mobile navigation...');
    const mobileContext = await createAuthContext(browser, 'mobile');
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await mobilePage.waitForLoadState('networkidle');
    await mobilePage.waitForTimeout(2000);

    // 4. Capture drawer closed state
    console.log('Capturing mobile drawer closed state...');
    await captureScreen(mobilePage, 'mobile', 'navigation', 'drawer-closed');

    // 5. Open hamburger menu and capture drawer open state
    console.log('Looking for hamburger menu...');
    const hamburgerSelectors = [
      '[data-testid="hamburger-menu"]',
      '[aria-label*="menu"]',
      'button[class*="hamburger"]',
      'button[class*="menu"]',
      '[class*="hamburger"]',
      '[class*="menu-toggle"]',
      'header button',
      'nav button',
      'button svg',
    ];

    let hamburgerClicked = false;
    for (const selector of hamburgerSelectors) {
      try {
        const hamburger = mobilePage.locator(selector).first();
        if (await hamburger.isVisible({ timeout: 1000 })) {
          console.log(`Found hamburger with selector: ${selector}`);
          await hamburger.click();
          await mobilePage.waitForTimeout(500);
          hamburgerClicked = true;

          // Capture drawer open state
          await captureScreen(mobilePage, 'mobile', 'navigation', 'drawer-open');
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!hamburgerClicked) {
      console.log('Could not find or click hamburger menu');
    }

    await mobileContext.close();

    console.log('\nNavigation capture complete!');

  } finally {
    await browser.close();
  }
}

// Run the capture
captureNavigation().catch(console.error);
