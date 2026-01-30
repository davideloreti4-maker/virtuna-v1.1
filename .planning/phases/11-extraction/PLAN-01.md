---
phase: 11-extraction
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extraction/playwright.config.ts
  - extraction/fixtures/auth.ts
  - extraction/tests/helpers.ts
  - package.json
autonomous: true

must_haves:
  truths:
    - "Playwright tests use proper test() and test.describe() syntax"
    - "Dark mode is forced via CSS injection on every page"
    - "Auth fixture handles manual login with session persistence"
    - "Screenshots follow EXTRACTION-PLAN.md folder structure"
  artifacts:
    - path: "extraction/playwright.config.ts"
      provides: "Playwright config for test directory, video recording, dark mode"
      contains: "testDir: './tests'"
    - path: "extraction/fixtures/auth.ts"
      provides: "Auth fixture with dark mode injection"
      contains: "colorScheme: 'dark'"
    - path: "extraction/tests/helpers.ts"
      provides: "Shared helpers for screenshots, waits, selectors"
      exports: ["screenshot", "waitForStable", "SELECTORS"]
---

<objective>
Setup Playwright test infrastructure with proper test framework, dark mode enforcement, and shared fixtures.

Purpose: Convert from plain scripts to proper Playwright test files with dark mode support.
Output: Test infrastructure ready for all extraction test files.
</objective>

<execution_context>
@/Users/davideloreti/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/11-extraction/EXTRACTION-PLAN.md
@.planning/phases/11-extraction/11-CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update Playwright config for tests</name>
  <files>
    - extraction/playwright.config.ts
  </files>
  <action>
Replace extraction/playwright.config.ts with proper test configuration:

```typescript
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const VIDEOS_DIR = path.join(__dirname, 'videos');

export default defineConfig({
  testDir: './tests',
  timeout: 180000, // 3 minutes per test
  expect: { timeout: 10000 },
  fullyParallel: false, // Run sequentially for consistent captures
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker for sequential execution
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list'],
  ],
  outputDir: 'test-results',

  use: {
    baseURL: 'https://app.societies.io',
    trace: 'retain-on-failure',
    screenshot: 'off', // Manual screenshots only
    video: 'off', // Enable per-test for flow recordings
    colorScheme: 'dark',
    // Slow down for animation captures
    launchOptions: {
      slowMo: 100,
    },
  },

  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: './auth/state.json',
      },
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
  ],
});
```
  </action>
  <verify>
- Config has testDir: './tests'
- colorScheme: 'dark' in use options
- Desktop and mobile projects defined
  </verify>
</task>

<task type="auto">
  <name>Task 2: Create auth fixture with dark mode injection</name>
  <files>
    - extraction/fixtures/auth.ts
  </files>
  <action>
Create extraction/fixtures/auth.ts:

```typescript
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
  console.log(`📸 ${filepath}`);

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
```
  </action>
  <verify>
- File exports test, expect, screenshot, waitForStable, SELECTORS
- Dark mode injection in authedPage fixture
- Screenshot helper creates proper folder structure
  </verify>
</task>

<task type="auto">
  <name>Task 3: Create tests directory and helpers</name>
  <files>
    - extraction/tests/helpers.ts
    - extraction/tests/.gitkeep
  </files>
  <action>
1. Create extraction/tests/ directory

2. Create extraction/tests/helpers.ts (re-export from fixtures):

```typescript
// Re-export from fixtures for cleaner imports in test files
export {
  test,
  expect,
  screenshot,
  waitForStable,
  SELECTORS,
  TEST_TYPES
} from '../fixtures/auth';

/**
 * Capture hover state
 */
export async function captureHover(
  page: import('@playwright/test').Page,
  category: string,
  selector: string,
  name: string
): Promise<string> {
  const { screenshot } = await import('../fixtures/auth');
  await page.hover(selector);
  await page.waitForTimeout(150);
  return screenshot(page, category, `${name}-hover`);
}

/**
 * Capture open/closed states of a dropdown or modal
 */
export async function captureToggle(
  page: import('@playwright/test').Page,
  category: string,
  triggerSelector: string,
  name: string
): Promise<{ closed: string; open: string }> {
  const { screenshot } = await import('../fixtures/auth');

  // Closed state
  const closed = await screenshot(page, category, `${name}-closed`);

  // Open state
  await page.click(triggerSelector);
  await page.waitForTimeout(300);
  const open = await screenshot(page, category, `${name}-open`);

  // Close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  return { closed, open };
}
```
  </action>
  <verify>
- extraction/tests/ directory exists
- helpers.ts exports all utilities
  </verify>
</task>

<task type="auto">
  <name>Task 4: Update package.json scripts</name>
  <files>
    - package.json
  </files>
  <action>
Update package.json scripts section:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "extraction:auth": "npx playwright test --project=setup",
    "extraction:all": "npx playwright test --project=desktop",
    "extraction:ui": "npx playwright test --ui",
    "extraction:report": "npx playwright show-report extraction/playwright-report"
  }
}
```
  </action>
  <verify>
- Scripts added for extraction:desktop, extraction:mobile, extraction:all
- extraction:ui for debugging
  </verify>
</task>

<task type="auto">
  <name>Task 5: Create auth setup test</name>
  <files>
    - extraction/tests/auth.setup.ts
  </files>
  <action>
Create extraction/tests/auth.setup.ts:

```typescript
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_STATE_PATH = path.join(__dirname, '..', 'auth', 'state.json');

setup('authenticate', async ({ page }) => {
  // Ensure auth directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  fs.mkdirSync(authDir, { recursive: true });

  // Navigate to app
  await page.goto('https://app.societies.io');

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Please log in via the browser window  ║');
  console.log('║  Navigate to the dashboard when done   ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Wait for user to login (check for dashboard or main app)
  await page.waitForURL(url => {
    const path = url.pathname;
    return path.includes('dashboard') ||
           path === '/' ||
           !path.includes('login') && !path.includes('auth');
  }, { timeout: 300000 }); // 5 minute timeout

  // Wait for app to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Save auth state
  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log(`\n✅ Auth state saved to: ${AUTH_STATE_PATH}`);
});
```
  </action>
  <verify>
- Auth setup test created
- Saves state to auth/state.json
  </verify>
</task>

<task type="auto">
  <name>Task 6: Update .gitignore</name>
  <files>
    - extraction/.gitignore
  </files>
  <action>
Update extraction/.gitignore:

```
# Auth state (contains session tokens)
auth/state.json

# Captured outputs
screenshots/
videos/
gifs/

# Playwright artifacts
playwright-report/
test-results/
test-results.json

# Keep structure
!**/.gitkeep
```
  </action>
  <verify>
- Auth state ignored
- Screenshots, videos, gifs ignored
- Report artifacts ignored
  </verify>
</task>

</tasks>

<verification>
- [ ] `extraction/playwright.config.ts` has testDir: './tests' and colorScheme: 'dark'
- [ ] `extraction/fixtures/auth.ts` exports test with dark mode injection
- [ ] `extraction/tests/helpers.ts` provides screenshot, waitForStable, SELECTORS
- [ ] `extraction/tests/auth.setup.ts` handles manual login
- [ ] package.json has extraction:desktop, extraction:mobile, extraction:all scripts
</verification>

<success_criteria>
- Playwright test infrastructure ready with proper test framework
- Dark mode enforced on all pages
- Auth fixture handles manual login with session persistence
- Folder structure matches EXTRACTION-PLAN.md
</success_criteria>

<output>
After completion, create `.planning/phases/11-extraction/PLAN-01-SUMMARY.md`
</output>
