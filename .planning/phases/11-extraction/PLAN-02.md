---
phase: 11-extraction
plan: 02
type: execute
wave: 2
depends_on: [PLAN-01]
files_modified:
  - extraction/tests/01-dashboard.spec.ts
  - extraction/tests/02-society-selector.spec.ts
  - extraction/tests/03-view-selector.spec.ts
  - extraction/tests/04-test-type-selector.spec.ts
autonomous: true

must_haves:
  truths:
    - "All tests use proper test.describe/test() syntax"
    - "Each test captures screenshots per EXTRACTION-PLAN.md Part 1-4"
    - "Hover states captured for interactive elements"
  artifacts:
    - path: "extraction/tests/01-dashboard.spec.ts"
      provides: "Dashboard and layout captures"
      contains: "test.describe('Dashboard'"
    - path: "extraction/tests/02-society-selector.spec.ts"
      provides: "Society selector modal captures"
      contains: "test.describe('Society Selector'"
    - path: "extraction/tests/04-test-type-selector.spec.ts"
      provides: "All 11 test type captures"
      contains: "TEST_TYPES"
---

<objective>
Create Playwright tests for Parts 1-4 of EXTRACTION-PLAN.md: Dashboard, Society Selector, View Selector, Test Type Selector.

Purpose: Capture all states for dashboard layout, navigation, and selector components.
Output: Test files that capture all screenshots defined in EXTRACTION-PLAN.md Parts 1-4.
</objective>

<context>
@.planning/phases/11-extraction/EXTRACTION-PLAN.md
@extraction/fixtures/auth.ts
@extraction/tests/helpers.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Dashboard and Layout Tests (Part 1)</name>
  <files>
    - extraction/tests/01-dashboard.spec.ts
  </files>
  <action>
Create extraction/tests/01-dashboard.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Dashboard & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture dashboard states', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Dashboard default/empty state
    await screenshot(page, 'dashboard', 'default');

    // Note: dashboard-with-results requires running a simulation first
    // Will be captured after simulation test
  });

  test('capture app shell components', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Sidebar default
    const sidebar = page.locator(SELECTORS.sidebar).first();
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshot(page, 'navigation', 'sidebar-default');

      // Sidebar hover states for each nav item
      const navItems = ['Dashboard', 'Settings'];
      for (const item of navItems) {
        const navItem = page.locator(SELECTORS.sidebarItem(item)).first();
        if (await navItem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await navItem.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'navigation', `sidebar-hover-${item.toLowerCase()}`);
        }
      }
    }

    // Context bar (top bar)
    const contextBar = page.locator('[data-testid="context-bar"], header, [class*="header"]').first();
    if (await contextBar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'navigation', 'context-bar');
    }

    // Network visualization
    const networkViz = page.locator('[data-testid="network"], canvas, [class*="network"]').first();
    if (await networkViz.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'dashboard', 'network-visualization');
    }

    // Filter pills
    const filterPills = page.locator('[data-testid="filters"], [class*="filter"]').first();
    if (await filterPills.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'dashboard', 'filter-pills-default');

      // Click a filter if available
      const filterBtn = filterPills.locator('button').first();
      if (await filterBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await filterBtn.click();
        await page.waitForTimeout(200);
        await screenshot(page, 'dashboard', 'filter-pills-selected');
        await page.keyboard.press('Escape');
      }
    }

    // Legend pills
    const legend = page.locator('[data-testid="legend"], [class*="legend"]').first();
    if (await legend.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'dashboard', 'legend-pills');
    }
  });
});
```
  </action>
  <verify>
- Test file uses test.describe and test()
- Captures dashboard states and app shell components
- Uses getViewport for viewport-aware screenshots
  </verify>
</task>

<task type="auto">
  <name>Task 2: Society Selector Tests (Part 2)</name>
  <files>
    - extraction/tests/02-society-selector.spec.ts
  </files>
  <action>
Create extraction/tests/02-society-selector.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Society Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture society selector modal states', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Society selector trigger (in sidebar)
    const trigger = page.locator(SELECTORS.societyTrigger).first();

    if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Trigger button
      await screenshot(page, 'society-selector', 'society-selector-trigger');

      // Open modal
      await trigger.click();
      await page.waitForTimeout(300);

      // Modal open state
      const modal = page.locator(SELECTORS.societyModal).first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'society-selector', 'society-selector-open');

        // Hover on a society item
        const societyItem = modal.locator('[data-testid*="society-item"], [class*="society-card"], li').first();
        if (await societyItem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await societyItem.hover();
          await page.waitForTimeout(150);
          await screenshot(page, 'society-selector', 'society-selector-hover-item');

          // Selected state (if there's a visual indicator)
          await screenshot(page, 'society-selector', 'society-selector-selected');
        }

        // Three-dot menu on society card
        const menuTrigger = modal.locator('button[aria-label*="menu"], [data-testid*="menu"], button:has([class*="dots"])').first();
        if (await menuTrigger.isVisible({ timeout: 1000 }).catch(() => false)) {
          await menuTrigger.click();
          await page.waitForTimeout(200);
          await screenshot(page, 'society-selector', 'society-card-menu-open');

          // Hover menu item
          const menuItem = page.locator('[role="menuitem"], [data-testid*="menu-item"]').first();
          if (await menuItem.isVisible({ timeout: 1000 }).catch(() => false)) {
            await menuItem.hover();
            await page.waitForTimeout(100);
            await screenshot(page, 'society-selector', 'society-card-menu-hover');
          }
          await page.keyboard.press('Escape');
        }

        await page.keyboard.press('Escape');
      }
    }
  });

  test('capture create society flow', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Open society selector
    const trigger = page.locator(SELECTORS.societyTrigger).first();
    if (!await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await trigger.click();
    await page.waitForTimeout(300);

    // Create button
    const createBtn = page.locator(SELECTORS.createSocietyBtn).first();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'society-selector', 'create-society-trigger');

      // Open create modal
      await createBtn.click();
      await page.waitForTimeout(300);

      // Create modal
      const createModal = page.locator('[role="dialog"]').last();
      if (await createModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshot(page, 'society-selector', 'create-society-modal');

        // Step 1: Name input
        const nameInput = createModal.locator('input[type="text"], input[name*="name"]').first();
        if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await screenshot(page, 'society-selector', 'create-society-step1');

          // Fill name and proceed (but don't actually create)
          await nameInput.fill('Test Society');
          await page.waitForTimeout(200);
          await screenshot(page, 'society-selector', 'create-society-name-filled');
        }
      }

      await page.keyboard.press('Escape');
    }

    await page.keyboard.press('Escape');
  });
});
```
  </action>
  <verify>
- Society selector modal states captured
- Create society flow documented
- Menu hover states included
  </verify>
</task>

<task type="auto">
  <name>Task 3: View Selector Tests (Part 3)</name>
  <files>
    - extraction/tests/03-view-selector.spec.ts
  </files>
  <action>
Create extraction/tests/03-view-selector.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, getViewport } from './helpers';

test.describe('View Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture view selector dropdown states', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // View selector trigger (usually in toolbar or header)
    const viewTrigger = page.locator(
      '[data-testid="view-selector"], ' +
      'button:has-text("View"), ' +
      '[class*="view-selector"], ' +
      'select[name*="view"]'
    ).first();

    if (!await viewTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try alternate: look for dropdown with view-related text
      const altTrigger = page.locator('button:has-text("Country"), button:has-text("City"), button:has-text("Generation")').first();
      if (!await altTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('View selector not found, skipping');
        return;
      }
    }

    // Closed state
    await screenshot(page, 'navigation', 'view-selector-closed');

    // Open dropdown
    await viewTrigger.click();
    await page.waitForTimeout(300);

    // Open state
    const dropdown = page.locator('[role="listbox"], [role="menu"], [data-state="open"]').first();
    if (await dropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'navigation', 'view-selector-open');

      // Capture each submenu category
      const categories = ['Country', 'City', 'Generation', 'Role Level'];
      for (const category of categories) {
        const categoryOption = dropdown.locator(`button:has-text("${category}"), [role="option"]:has-text("${category}")`).first();
        if (await categoryOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await categoryOption.hover();
          await page.waitForTimeout(200);
          await screenshot(page, 'navigation', `view-selector-${category.toLowerCase().replace(' ', '-')}`);
        }
      }

      // Option hover state
      const anyOption = dropdown.locator('[role="option"], button').first();
      if (await anyOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await anyOption.hover();
        await page.waitForTimeout(100);
        await screenshot(page, 'navigation', 'view-selector-option-hover');

        // Select an option
        await anyOption.click();
        await page.waitForTimeout(300);
        await screenshot(page, 'navigation', 'view-selector-selected');
      }
    }

    await page.keyboard.press('Escape');
  });
});
```
  </action>
  <verify>
- View selector dropdown states captured
- Submenus for Country, City, Generation, Role Level
- Hover and selected states included
  </verify>
</task>

<task type="auto">
  <name>Task 4: Test Type Selector Tests (Part 4)</name>
  <files>
    - extraction/tests/04-test-type-selector.spec.ts
  </files>
  <action>
Create extraction/tests/04-test-type-selector.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS, TEST_TYPES, getViewport } from './helpers';

test.describe('Test Type Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture test type selector modal', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // New Test button
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();

    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('New Test button not found, skipping');
      return;
    }

    // Trigger button
    await screenshot(page, 'test-type-selector', 'test-type-trigger');

    // Open modal
    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Modal with all test types
    const modal = page.locator(SELECTORS.testTypeModal).first();
    if (!await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try any dialog
      const anyModal = page.locator('[role="dialog"]').first();
      if (!await anyModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Test type modal not visible');
        return;
      }
    }

    await screenshot(page, 'test-type-selector', 'test-type-modal-open');

    // Category screenshots
    const categories = [
      { name: 'Survey', file: 'category-survey' },
      { name: 'Marketing', file: 'category-marketing' },
      { name: 'Social', file: 'category-social' },
      { name: 'Communication', file: 'category-communication' },
      { name: 'Product', file: 'category-product' },
    ];

    for (const cat of categories) {
      const categoryHeader = page.locator(`h3:has-text("${cat.name}"), [class*="category"]:has-text("${cat.name}")`).first();
      if (await categoryHeader.isVisible({ timeout: 1000 }).catch(() => false)) {
        await categoryHeader.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        await screenshot(page, 'test-type-selector', cat.file);
      }
    }

    await page.keyboard.press('Escape');
  });

  test('capture each test type hover and selection', async ({ page }, testInfo) => {
    // Desktop only - no mobile viewport

    // Open modal
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await newTestBtn.click();
    await page.waitForTimeout(400);

    // Capture hover/selected for each test type
    for (const testType of TEST_TYPES) {
      const typeButton = page.locator(SELECTORS.testTypeOption(testType)).first();

      // Also try alternate selectors
      const altSelectors = [
        `button:has-text("${testType.replace('-', ' ')}")`,
        `[data-testid*="${testType}"]`,
        `[class*="${testType}"]`,
      ];

      let found = await typeButton.isVisible({ timeout: 1000 }).catch(() => false);
      if (!found) {
        for (const sel of altSelectors) {
          const alt = page.locator(sel).first();
          if (await alt.isVisible({ timeout: 500 }).catch(() => false)) {
            await alt.hover();
            found = true;
            break;
          }
        }
      }

      if (found) {
        // Hover state
        await typeButton.hover();
        await page.waitForTimeout(150);
        await screenshot(page, 'test-type-selector', `test-type-${testType}-hover`);

        // Selected state (click but capture before form opens)
        // Note: Some UIs show selection before transitioning
      }
    }

    await page.keyboard.press('Escape');
  });
});
```
  </action>
  <verify>
- Test type modal captured
- All 11 test types covered
- Hover states for each type
  </verify>
</task>

</tasks>

<verification>
- [ ] `extraction/tests/01-dashboard.spec.ts` captures dashboard and layout states
- [ ] `extraction/tests/02-society-selector.spec.ts` captures society modal and create flow
- [ ] `extraction/tests/03-view-selector.spec.ts` captures view dropdown submenus
- [ ] `extraction/tests/04-test-type-selector.spec.ts` captures all 11 test types
- [ ] All tests use proper Playwright test syntax
</verification>

<success_criteria>
- Tests capture all screenshots from EXTRACTION-PLAN.md Parts 1-4
- Desktop and mobile viewports supported
- Interactive states (hover, selected) captured
</success_criteria>

<output>
After completion, create `.planning/phases/11-extraction/PLAN-02-SUMMARY.md`
</output>
