/**
 * All-in-One Extraction Script
 *
 * Opens browser ONCE, waits for manual login, then captures everything
 * in the same authenticated session.
 *
 * Usage: npx tsx extraction/scripts/capture-all-session.ts
 */
import { chromium, Page, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = './extraction/screenshots';
const VIDEOS_DIR = './extraction/videos/flows';

// Ensure directories exist
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

// =============================================================================
// UTILITIES
// =============================================================================

async function screenshot(page: Page, category: string, name: string): Promise<void> {
  const categoryMap: Record<string, string> = {
    'dashboard': '01-dashboard',
    'society-selector': '02-society-selector',
    'view-selector': '03-view-selector',
    'test-type-selector': '03-test-type-selector',
    'forms': '04-forms',
    'simulation': '05-simulation',
    'results': '06-results',
    'history': '07-history',
    'settings': '08-settings',
    'modals': '09-modals',
    'navigation': '10-navigation',
  };

  const folder = categoryMap[category] || category;
  const dir = path.join(SCREENSHOTS_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, `${name}.png`);

  // Scroll to bottom first
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  📸 ${filepath}`);
}

async function waitForStable(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

async function waitForEnter(message: string): Promise<void> {
  console.log(`\n${message}\n`);
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });
}

// =============================================================================
// SELECTORS
// =============================================================================

const SELECTORS = {
  societyTrigger: '[data-testid="society-selector"], button:has-text("Society"), [class*="society-selector"]',
  createSocietyBtn: 'button:has-text("Create"), button:has-text("New Society")',
  newTestBtn: 'button:has-text("New Test"), button:has-text("Create Test"), [data-testid="new-test"]',
  textarea: 'textarea',
  submitBtn: 'button:has-text("Simulate"), button:has-text("Submit"), button[type="submit"]',
  settingsTab: (name: string) => `button:has-text("${name}"), [role="tab"]:has-text("${name}")`,
};

const TEST_TYPES = [
  'Survey', 'Article', 'Website', 'Advertisement',
  'LinkedIn', 'Instagram', 'X Post', 'TikTok',
  'Email Subject', 'Email', 'Product'
];

// =============================================================================
// CAPTURE FUNCTIONS
// =============================================================================

async function captureDashboard(page: Page): Promise<void> {
  console.log('\n📸 DASHBOARD & LAYOUT');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io');
  await waitForStable(page);

  await screenshot(page, 'dashboard', 'default');

  // Sidebar
  const sidebar = page.locator('aside, nav, [data-testid="sidebar"]').first();
  if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
    await screenshot(page, 'navigation', 'sidebar-default');

    // Hover nav items
    const navItems = sidebar.locator('a, button').filter({ hasText: /.+/ });
    const count = await navItems.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      const item = navItems.nth(i);
      const text = await item.textContent();
      if (text && text.trim()) {
        await item.hover();
        await page.waitForTimeout(200);
        await screenshot(page, 'navigation', `sidebar-hover-${text.trim().toLowerCase().replace(/\s+/g, '-')}`);
      }
    }
  }

  // Network visualization
  const network = page.locator('canvas, [data-testid="network"], [class*="network"]').first();
  if (await network.isVisible({ timeout: 2000 }).catch(() => false)) {
    await screenshot(page, 'dashboard', 'network-visualization');
  }

  // Filter pills
  const filters = page.locator('[data-testid="filters"], [class*="filter"]').first();
  if (await filters.isVisible({ timeout: 2000 }).catch(() => false)) {
    await screenshot(page, 'dashboard', 'filter-pills');
  }
}

async function captureSocietySelector(page: Page): Promise<void> {
  console.log('\n📸 SOCIETY SELECTOR');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io');
  await waitForStable(page);

  const trigger = page.locator(SELECTORS.societyTrigger).first();
  if (!await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  ⚠️ Society selector not found');
    return;
  }

  await screenshot(page, 'society-selector', 'trigger');

  await trigger.click();
  await page.waitForTimeout(400);

  const modal = page.locator('[role="dialog"]').first();
  if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await screenshot(page, 'society-selector', 'modal-open');

    // Hover items
    const items = modal.locator('[data-testid*="society"], [class*="society-card"], li').filter({ hasText: /.+/ });
    const count = await items.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await items.nth(i).hover();
      await page.waitForTimeout(200);
      await screenshot(page, 'society-selector', `item-hover-${i + 1}`);
    }

    // Menu on first item
    const menuBtn = items.first().locator('button[aria-label*="menu"], [class*="menu"]').first();
    if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'society-selector', 'item-menu-open');
      await page.keyboard.press('Escape');
    }

    // Create button
    const createBtn = modal.locator(SELECTORS.createSocietyBtn).first();
    if (await createBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(400);
      await screenshot(page, 'society-selector', 'create-modal');
      await page.keyboard.press('Escape');
    }

    await page.keyboard.press('Escape');
  }
}

async function captureViewSelector(page: Page): Promise<void> {
  console.log('\n📸 VIEW SELECTOR');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io');
  await waitForStable(page);

  const viewBtn = page.locator('button:has-text("View"), button:has-text("Country"), button:has-text("All"), [data-testid*="view"]').first();
  if (!await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  ⚠️ View selector not found');
    return;
  }

  await screenshot(page, 'view-selector', 'closed');

  await viewBtn.click();
  await page.waitForTimeout(400);
  await screenshot(page, 'view-selector', 'open');

  // Hover categories
  const categories = ['Country', 'City', 'Generation', 'Role'];
  for (const cat of categories) {
    const item = page.locator(`[role="option"]:has-text("${cat}"), [role="menuitem"]:has-text("${cat}")`).first();
    if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
      await item.hover();
      await page.waitForTimeout(300);
      await screenshot(page, 'view-selector', `hover-${cat.toLowerCase()}`);
    }
  }

  await page.keyboard.press('Escape');
}

async function captureTestTypeSelector(page: Page): Promise<void> {
  console.log('\n📸 TEST TYPE SELECTOR');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io');
  await waitForStable(page);

  const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
  if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  ⚠️ New Test button not found');
    return;
  }

  await screenshot(page, 'test-type-selector', 'trigger');

  await newTestBtn.click();
  await page.waitForTimeout(500);
  await screenshot(page, 'test-type-selector', 'modal-open');

  // Hover each test type
  for (const type of TEST_TYPES) {
    const typeBtn = page.locator(`button:has-text("${type}"), [data-testid*="${type.toLowerCase().replace(/\s+/g, '-')}"]`).first();
    if (await typeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await typeBtn.hover();
      await page.waitForTimeout(200);
      await screenshot(page, 'test-type-selector', `type-${type.toLowerCase().replace(/\s+/g, '-')}-hover`);
    }
  }

  await page.keyboard.press('Escape');
}

async function captureForms(page: Page): Promise<void> {
  console.log('\n📸 FORMS');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io');
  await waitForStable(page);

  const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
  if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  ⚠️ New Test button not found');
    return;
  }

  // Capture a few form types
  const formTypes = ['TikTok', 'Email Subject', 'LinkedIn'];

  for (const type of formTypes) {
    await newTestBtn.click();
    await page.waitForTimeout(500);

    const typeBtn = page.locator(`button:has-text("${type}")`).first();
    if (await typeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await typeBtn.click();
      await page.waitForTimeout(400);

      const slug = type.toLowerCase().replace(/\s+/g, '-');
      await screenshot(page, 'forms', `${slug}-empty`);

      const textarea = page.locator(SELECTORS.textarea).first();
      if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
        await textarea.click();
        await page.waitForTimeout(100);
        await screenshot(page, 'forms', `${slug}-focused`);

        await textarea.fill('Sample content for testing. This is a demo of the form functionality.');
        await page.waitForTimeout(200);
        await screenshot(page, 'forms', `${slug}-filled`);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
}

async function captureSimulationAndResults(page: Page): Promise<void> {
  console.log('\n📸 SIMULATION & RESULTS');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io');
  await waitForStable(page);

  const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
  if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  ⚠️ New Test button not found');
    return;
  }

  await newTestBtn.click();
  await page.waitForTimeout(500);

  // Select Email Subject (fast)
  const typeBtn = page.locator('button:has-text("Email Subject"), button:has-text("Email")').first();
  if (!await typeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('  ⚠️ Email type not found');
    return;
  }

  await typeBtn.click();
  await page.waitForTimeout(400);

  const textarea = page.locator(SELECTORS.textarea).first();
  if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await textarea.fill('Flash Sale: 50% off everything today only! 🔥');
  }

  const submitBtn = page.locator(SELECTORS.submitBtn).first();
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('  ⚠️ Submit button not found');
    return;
  }

  await submitBtn.click();
  console.log('  ⏳ Running simulation...');

  // Capture loading phases
  for (let phase = 1; phase <= 4; phase++) {
    await page.waitForTimeout(2500);
    await screenshot(page, 'simulation', `phase-${phase}`);
  }

  // Wait for results
  try {
    await page.waitForSelector('[data-testid*="result"], [class*="result"], [class*="score"]', { timeout: 90000 });
    await page.waitForTimeout(1500);
    await screenshot(page, 'results', 'panel-default');

    // Expand sections
    const sections = ['Attention', 'Variant', 'Insight', 'Theme'];
    for (const section of sections) {
      const sectionBtn = page.locator(`button:has-text("${section}"), [data-testid*="${section.toLowerCase()}"]`).first();
      if (await sectionBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sectionBtn.click();
        await page.waitForTimeout(400);
        await screenshot(page, 'results', `section-${section.toLowerCase()}-expanded`);
      }
    }

    // Share button
    const shareBtn = page.locator('button:has-text("Share")').first();
    if (await shareBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await shareBtn.hover();
      await page.waitForTimeout(200);
      await screenshot(page, 'results', 'share-hover');
    }

  } catch {
    console.log('  ⚠️ Results did not appear');
  }
}

async function captureHistory(page: Page): Promise<void> {
  console.log('\n📸 HISTORY');
  console.log('─'.repeat(40));

  // Try to find history section
  const historyLink = page.locator('a:has-text("History"), button:has-text("History")').first();
  if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await historyLink.click();
    await page.waitForTimeout(500);
  }

  const items = page.locator('[data-testid*="history-item"], [class*="history-item"]');
  const count = await items.count();

  if (count === 0) {
    await screenshot(page, 'history', 'empty');
  } else {
    await screenshot(page, 'history', 'list');

    // Hover items
    for (let i = 0; i < Math.min(count, 3); i++) {
      await items.nth(i).hover();
      await page.waitForTimeout(200);
      await screenshot(page, 'history', `item-hover-${i + 1}`);
    }

    // Click first item
    await items.first().click();
    await page.waitForTimeout(500);
    await screenshot(page, 'history', 'item-selected');

    // Menu
    const menuBtn = items.first().locator('button[aria-label*="menu"]').first();
    if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'history', 'item-menu-open');

      const deleteItem = page.locator('[role="menuitem"]:has-text("Delete")').first();
      if (await deleteItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await deleteItem.click();
        await page.waitForTimeout(400);
        await screenshot(page, 'history', 'delete-modal');
        await page.keyboard.press('Escape');
      } else {
        await page.keyboard.press('Escape');
      }
    }
  }
}

async function captureSettings(page: Page): Promise<void> {
  console.log('\n📸 SETTINGS');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io/settings');
  await waitForStable(page);
  await screenshot(page, 'settings', 'default');

  const tabs = ['Profile', 'Account', 'Notifications', 'Billing', 'Team'];

  for (const tab of tabs) {
    const tabBtn = page.locator(SELECTORS.settingsTab(tab)).first();
    if (await tabBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tabBtn.click();
      await page.waitForTimeout(400);
      await screenshot(page, 'settings', `tab-${tab.toLowerCase()}`);

      // Special captures per tab
      if (tab === 'Notifications') {
        const switches = page.locator('[role="switch"]');
        if (await switches.count() > 0) {
          await switches.first().hover();
          await page.waitForTimeout(200);
          await screenshot(page, 'settings', 'switch-hover');
        }
      }
    }
  }
}

async function captureModals(page: Page): Promise<void> {
  console.log('\n📸 MODALS');
  console.log('─'.repeat(40));

  await page.goto('https://app.societies.io');
  await waitForStable(page);

  // Feedback modal
  const feedbackBtn = page.locator('button:has-text("Feedback"), [data-testid*="feedback"]').first();
  if (await feedbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await feedbackBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator('[role="dialog"]').first();
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'modals', 'feedback-open');

      const textarea = modal.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
        await textarea.fill('Great product! Love the simulation feature.');
        await page.waitForTimeout(200);
        await screenshot(page, 'modals', 'feedback-filled');
      }

      await page.keyboard.press('Escape');
    }
  }
}

// =============================================================================
// VIDEO FLOWS
// =============================================================================

async function recordFlows(browser: Browser, context: BrowserContext): Promise<void> {
  console.log('\n🎬 RECORDING FLOWS');
  console.log('═'.repeat(40));

  // Create new context with video recording
  const videoContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    recordVideo: {
      dir: VIDEOS_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  // Copy cookies from authenticated context
  const cookies = await context.cookies();
  await videoContext.addCookies(cookies);

  // Inject dark mode
  await videoContext.addInitScript(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  });

  const page = await videoContext.newPage();

  console.log('\n📹 Flow 1: Complete Test Creation');
  await recordCompleteTestFlow(page);

  console.log('\n📹 Flow 2: Society Management');
  await recordSocietyFlow(page);

  console.log('\n📹 Flow 3: Settings Navigation');
  await recordSettingsFlow(page);

  await videoContext.close();
  console.log('\n✅ Videos saved to:', VIDEOS_DIR);
}

async function recordCompleteTestFlow(page: Page): Promise<void> {
  await page.goto('https://app.societies.io');
  await waitForStable(page);
  await page.waitForTimeout(1500);

  // Open test type selector
  const newTestBtn = page.locator('button:has-text("New Test")').first();
  if (await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newTestBtn.hover();
    await page.waitForTimeout(400);
    await newTestBtn.click();
    await page.waitForTimeout(600);

    // Browse types
    const types = ['Survey', 'Article', 'Advertisement', 'TikTok'];
    for (const type of types) {
      const btn = page.locator(`button:has-text("${type}")`).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.hover();
        await page.waitForTimeout(400);
      }
    }

    // Select TikTok
    const tiktok = page.locator('button:has-text("TikTok")').first();
    if (await tiktok.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tiktok.click();
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.type('[Hook] Wait for this!\n\n[Body] This changed everything for me.\n\n[CTA] Follow for more!', { delay: 30 });
        await page.waitForTimeout(800);

        const submit = page.locator('button:has-text("Simulate")').first();
        if (await submit.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submit.click();

          // Wait for results
          try {
            await page.waitForSelector('[class*="result"], [class*="score"]', { timeout: 90000 });
            await page.waitForTimeout(2000);

            // Expand sections
            const sections = ['Attention', 'Variant', 'Insight'];
            for (const s of sections) {
              const btn = page.locator(`button:has-text("${s}")`).first();
              if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await btn.click();
                await page.waitForTimeout(600);
              }
            }
          } catch {
            console.log('  Results timeout');
          }
        }
      }
    }
  }

  await page.waitForTimeout(1000);
}

async function recordSocietyFlow(page: Page): Promise<void> {
  await page.goto('https://app.societies.io');
  await waitForStable(page);
  await page.waitForTimeout(1000);

  const trigger = page.locator('[data-testid="society-selector"], button:has-text("Society")').first();
  if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await trigger.hover();
    await page.waitForTimeout(400);
    await trigger.click();
    await page.waitForTimeout(600);

    // Hover societies
    const items = page.locator('[data-testid*="society"], [class*="society-card"]');
    const count = await items.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await items.nth(i).hover();
      await page.waitForTimeout(500);
    }

    // Create flow
    const createBtn = page.locator('button:has-text("Create")').first();
    if (await createBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(500);

      const input = page.locator('input[type="text"]').first();
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        await input.type('Demo Society', { delay: 50 });
        await page.waitForTimeout(800);
      }

      await page.keyboard.press('Escape');
    }

    await page.keyboard.press('Escape');
  }

  await page.waitForTimeout(500);
}

async function recordSettingsFlow(page: Page): Promise<void> {
  await page.goto('https://app.societies.io/settings');
  await waitForStable(page);
  await page.waitForTimeout(1000);

  const tabs = ['Profile', 'Account', 'Notifications', 'Billing', 'Team'];
  for (const tab of tabs) {
    const btn = page.locator(`button:has-text("${tab}")`).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.hover();
      await page.waitForTimeout(300);
      await btn.click();
      await page.waitForTimeout(800);
    }
  }

  // Toggle a switch
  const switchEl = page.locator('[role="switch"]').first();
  if (await switchEl.isVisible({ timeout: 1000 }).catch(() => false)) {
    await switchEl.click();
    await page.waitForTimeout(400);
    await switchEl.click();
  }

  await page.waitForTimeout(500);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     SOCIETIES.IO EXTRACTION SCRIPT     ║');
  console.log('║     Desktop Only • Dark Mode           ║');
  console.log('╚════════════════════════════════════════╝\n');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome', // Use standard Chrome
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });

  // Inject dark mode on every page
  await context.addInitScript(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  });

  const page = await context.newPage();

  // Navigate and wait for manual login
  await page.goto('https://app.societies.io');

  console.log('╔════════════════════════════════════════╗');
  console.log('║  Please LOG IN via the browser window  ║');
  console.log('║  Then press ENTER to start capturing   ║');
  console.log('╚════════════════════════════════════════╝');

  await waitForEnter('Press ENTER when logged in...');

  await page.waitForLoadState('networkidle');
  console.log('\n✅ Starting extraction in same session...\n');

  try {
    // Run all captures in sequence
    await captureDashboard(page);
    await captureSocietySelector(page);
    await captureViewSelector(page);
    await captureTestTypeSelector(page);
    await captureForms(page);
    await captureSimulationAndResults(page);
    await captureHistory(page);
    await captureSettings(page);
    await captureModals(page);

    // Record video flows
    await recordFlows(browser, context);

  } finally {
    await context.close();
    await browser.close();
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         EXTRACTION COMPLETE!           ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\nScreenshots: ${SCREENSHOTS_DIR}`);
  console.log(`Videos: ${VIDEOS_DIR}`);
}

main().catch(console.error);
