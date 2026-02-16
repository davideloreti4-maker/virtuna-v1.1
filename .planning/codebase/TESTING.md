# Testing Patterns

**Analysis Date:** 2026-02-13

## Test Framework

**Runner:**
- Playwright 1.58.0
- Config: `extraction/playwright.config.ts`

**Assertion Library:**
- Playwright's built-in `expect` (re-exported from `@playwright/test`)

**Run Commands:**
```bash
npm run extraction:auth     # Run authentication setup
npm run extraction:all      # Run all extraction tests
npm run extraction:ui       # Run with Playwright UI
npm run extraction:report   # Show HTML report
```

**Alternative test commands:**
```bash
npx playwright test --project=desktop --config=extraction/playwright.config.ts
npx playwright test --project=setup --config=extraction/playwright.config.ts
```

## Test File Organization

**Location:**
- `extraction/tests/` - All test specs
- `extraction/fixtures/` - Shared fixtures and helpers
- `test-results/` - Test outputs
- `playwright-report/` - HTML reports

**Naming:**
- Pattern: `NN-description.spec.ts`
- Examples: `01-dashboard.spec.ts`, `02-society-selector.spec.ts`, `11-flows.spec.ts`
- Verification tests: `verification/phase-13-verification.spec.ts`

**Structure:**
```
extraction/
├── tests/
│   ├── 01-dashboard.spec.ts
│   ├── 02-society-selector.spec.ts
│   ├── helpers.ts               # Re-exports from fixtures
│   └── verification/
├── fixtures/
│   └── auth.ts                  # Auth fixture and helpers
├── playwright.config.ts
└── screenshots/                 # Organized by category
    ├── 01-dashboard/
    ├── 02-society-selector/
    └── 10-navigation/
```

## Test Structure

**Suite Organization:**
```typescript
import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Dashboard & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture dashboard states', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport
    await screenshot(page, 'dashboard', 'default');
  });

  test('capture app shell components', async ({ page }, testInfo) => {
    const sidebar = page.locator(SELECTORS.sidebar).first();
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshot(page, 'navigation', 'sidebar-default');
    }
  });
});
```

**Patterns:**
- `test.describe()` for grouping related tests
- `test.beforeEach()` for setup (navigation, stabilization)
- Async/await throughout
- Defensive locator checks: `if (await element.isVisible({ timeout: N }).catch(() => false))`
- No assertions - screenshot-based extraction tests
- Comments indicate viewport strategy: `// Desktop only - no mobile viewport`

## Mocking

**Framework:** None detected (tests run against live app at `https://app.societies.io`)

**Patterns:**
- Uses authentication state stored in `./auth/state.json`
- No API mocking - tests interact with real backend
- No component-level unit tests detected

**What to Mock:**
- N/A - current tests are E2E screenshot extraction

**What NOT to Mock:**
- N/A - no mocking patterns in place

## Fixtures and Factories

**Test Data:**
No test data factories found in extraction tests. However, source code contains mock data generators:

```typescript
// src/lib/mock-data.ts
export function generateMockVariants(originalContent: string): Variant[] {
  // Returns 3-5 variants with random metrics
}

export function generateMockInsights(): string[] {
  // Returns 3-5 AI-generated insights
}

export function generateMockThemes(): ConversationTheme[] {
  // Returns 5-8 conversation themes
}
```

**Location:**
- Mock generators: `src/lib/mock-data.ts`, `src/lib/mock-societies.ts`, `src/lib/mock-brand-deals.ts`
- Test fixtures: `extraction/fixtures/auth.ts` (authentication, screenshot helpers)

**Pattern:**
```typescript
// Fixtures define reusable test context and helpers
export const test = base.extend<{
  authedPage: Page;
}>({
  authedPage: async ({ page, context }, use) => {
    // Inject dark mode on every navigation
    await context.addInitScript(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await use(page);
  },
});
```

## Coverage

**Requirements:** None enforced

**View Coverage:**
- No coverage commands in `package.json`
- No coverage config in `playwright.config.ts`
- Tests focus on screenshot extraction, not coverage

## Test Types

**Unit Tests:**
- Not used - no Jest/Vitest config
- No component unit tests detected

**Integration Tests:**
- Not used in extraction tests
- Potential future use for API/store integration

**E2E Tests:**
- Primary test type
- Framework: Playwright
- Scope: Full application flows for screenshot extraction
- Config: Desktop viewport 1440x900, dark mode, sequential execution

## Common Patterns

**Async Testing:**
```typescript
test('capture view selector dropdown states', async ({ page }, testInfo) => {
  const viewTrigger = page.locator('[data-testid="view-selector"]').first();

  if (!await viewTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('View selector not found, skipping');
    return;
  }

  await screenshot(page, 'navigation', 'view-selector-closed');
  await viewTrigger.click();
  await page.waitForTimeout(300);
  await screenshot(page, 'navigation', 'view-selector-open');
});
```

**Error Testing:**
- No explicit error testing patterns
- Defensive checks with `.catch(() => false)` to avoid test failures
- Early returns for missing elements

**Element Interaction:**
```typescript
// Hover state capture
const navItem = page.locator(SELECTORS.sidebarItem('Dashboard')).first();
if (await navItem.isVisible({ timeout: 1000 }).catch(() => false)) {
  await navItem.hover();
  await page.waitForTimeout(150);
  await screenshot(page, 'navigation', 'sidebar-hover-dashboard');
}
```

**Selector Strategy:**
- Prefer `data-testid` attributes: `[data-testid="sidebar"]`
- Fallback to semantic selectors: `aside`, `nav`, `button`
- Text-based selectors: `button:has-text("Dashboard")`
- Chained fallbacks: `'[data-testid="view-selector"], button:has-text("View")'`

## Helper Functions

**Screenshot helper:**
```typescript
export async function screenshot(
  page: Page,
  category: string,
  name: string
): Promise<string> {
  const categoryMap: Record<string, string> = {
    'dashboard': '01-dashboard',
    'society-selector': '02-society-selector',
    // ... maps categories to folder numbers
  };

  const folder = categoryMap[category] || category;
  const dir = path.join(SCREENSHOTS_BASE, folder);
  fs.mkdirSync(dir, { recursive: true });

  // Scroll to trigger lazy content
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
  await page.waitForTimeout(200);
  await page.screenshot({ path: filepath, fullPage: true });

  return filepath;
}
```

**Stabilization helper:**
```typescript
export async function waitForStable(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}
```

**Hover capture helper:**
```typescript
export async function captureHover(
  page: Page,
  category: string,
  selector: string,
  name: string
): Promise<string> {
  await page.hover(selector);
  await page.waitForTimeout(150);
  return screenshot(page, category, `${name}-hover`);
}
```

**Toggle capture helper:**
```typescript
export async function captureToggle(
  page: Page,
  category: string,
  triggerSelector: string,
  name: string
): Promise<{ closed: string; open: string }> {
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

## Playwright Configuration

**Key settings:**
- Base URL: `https://app.societies.io`
- Timeout: 180000ms (3 minutes per test)
- Expect timeout: 10000ms
- Workers: 1 (sequential execution)
- Viewport: 1440x900 (desktop only)
- Color scheme: dark
- Slow motion: 100ms (for animation captures)
- Retries: 0
- Trace: retain-on-failure
- Screenshots: manual only
- Video: off by default

**Projects:**
- `desktop` - main test execution with stored auth
- `setup` - authentication setup (matches `/auth\.setup\.ts/`)

**Storage state:**
- Auth state persisted in `./auth/state.json`
- Loaded automatically for desktop project

## Shared Constants

**Selectors:**
Centralized in `extraction/fixtures/auth.ts`:
```typescript
export const SELECTORS = {
  sidebar: '[data-testid="sidebar"], aside, nav',
  sidebarItem: (name: string) => `[data-testid="nav-${name}"], a:has-text("${name}")`,
  societyTrigger: '[data-testid="society-selector"], button:has-text("Society")',
  newTestBtn: 'button:has-text("New Test"), button:has-text("Create Test")',
  textarea: 'textarea',
  submitBtn: 'button:has-text("Simulate"), button:has-text("Submit")',
  modal: '[role="dialog"], [data-state="open"]',
  // ... 15+ more selectors
};
```

**Test types:**
```typescript
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

## Test Execution Strategy

**Sequential execution:**
- `fullyParallel: false`
- `workers: 1`
- Ensures consistent screenshot captures without race conditions

**Slow motion:**
- `slowMo: 100` in launch options
- Allows animations to complete for accurate screenshots

**Network idle waiting:**
- `page.waitForLoadState('networkidle')` before screenshots
- Ensures all API calls complete

**Timeout strategy:**
- Defensive timeouts on `.isVisible()` checks: `timeout: 1000-3000ms`
- `.catch(() => false)` to avoid failing on missing elements
- Early returns when elements not found

## Limitations

**No unit testing:**
- No component-level tests (Jest/Vitest/React Testing Library not used)
- All testing is E2E via Playwright

**No mocking:**
- Tests run against live application
- No API mocking or component isolation

**Screenshot-focused:**
- Tests don't assert behavior
- Focus is visual extraction, not functional validation

**No coverage tracking:**
- No coverage tools configured
- No coverage requirements

---

*Testing analysis: 2026-02-13*
