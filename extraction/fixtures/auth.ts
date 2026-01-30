import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_STATE_PATH = path.join(__dirname, '..', 'auth', 'state.json');
const SCREENSHOTS_BASE = path.join(__dirname, '..', 'screenshots');

// Extend base test with dark mode injection
export const test = base.extend<{
  authedPage: Page;
}>({
  authedPage: async ({ page, context }, use) => {
    // Inject dark mode on every navigation
    await context.addInitScript(() => {
      // Force dark mode
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');

      // Also set color scheme preference
      const style = document.createElement('style');
      style.textContent = `
        :root { color-scheme: dark !important; }
      `;
      document.head.appendChild(style);
    });

    // Also emulate dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' });

    await use(page);
  },
});

export { expect };

/**
 * Screenshot helper with EXTRACTION-PLAN.md folder structure
 * Note: App is desktop-only, no mobile viewport
 */
export async function screenshot(
  page: Page,
  category: string,
  name: string
): Promise<string> {
  // Map category to folder number per EXTRACTION-PLAN.md
  const categoryMap: Record<string, string> = {
    'dashboard': '01-dashboard',
    'society-selector': '02-society-selector',
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
  const dir = path.join(SCREENSHOTS_BASE, folder);
  fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, `${name}.png`);

  // Scroll to bottom to trigger lazy content
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

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(200); // Brief pause for render

  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot saved: ${filepath}`);

  return filepath;
}

/**
 * Wait for page to stabilize (no pending requests, animations done)
 */
export async function waitForStable(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

/**
 * Common selectors used across tests
 */
export const SELECTORS = {
  // Sidebar
  sidebar: '[data-testid="sidebar"], aside, nav',
  sidebarItem: (name: string) => `[data-testid="nav-${name}"], a:has-text("${name}")`,

  // Society selector
  societyTrigger: '[data-testid="society-selector"], button:has-text("Society"), [class*="society-selector"]',
  societyModal: '[role="dialog"]:has-text("Society"), [data-testid="society-modal"]',
  createSocietyBtn: 'button:has-text("Create"), button:has-text("New Society")',

  // Test type selector
  newTestBtn: 'button:has-text("New Test"), button:has-text("Create Test"), [data-testid="new-test"]',
  testTypeModal: '[role="dialog"]:has-text("Test"), [data-testid="test-type-modal"]',
  testTypeOption: (type: string) => `button:has-text("${type}"), [data-testid="test-type-${type}"]`,

  // Forms
  textarea: 'textarea',
  submitBtn: 'button:has-text("Simulate"), button:has-text("Submit"), button[type="submit"]',

  // Results
  resultsPanel: '[data-testid="results"], [class*="results"]',
  accordionSection: (name: string) => `[data-testid="accordion-${name}"], button:has-text("${name}")`,

  // Settings
  settingsNav: '[data-testid="settings-nav"], [role="tablist"]',
  settingsTab: (name: string) => `button:has-text("${name}"), [role="tab"]:has-text("${name}")`,

  // Modals
  modal: '[role="dialog"], [data-state="open"]',
  modalClose: 'button[aria-label*="close"], button:has-text("Cancel"), [data-testid="modal-close"]',

  // Mobile
  hamburger: 'button[aria-label*="menu"], [class*="hamburger"], [data-testid="menu-toggle"]',
  drawer: '[data-testid="drawer"], [class*="drawer"], [role="dialog"]',
};

/**
 * Test types as defined in EXTRACTION-PLAN.md
 */
export const TEST_TYPES = [
  'survey',
  'article',
  'website-content',
  'advertisement',
  'linkedin-post',
  'instagram-post',
  'x-post',
  'tiktok-script',
  'email-subject-line',
  'email',
  'product-proposition',
] as const;
