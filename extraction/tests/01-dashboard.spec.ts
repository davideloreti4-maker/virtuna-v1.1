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
