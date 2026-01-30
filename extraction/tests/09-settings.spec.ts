import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

/**
 * Part 9: Settings - Capture all settings tabs and states
 * Per EXTRACTION-PLAN.md sections 9.1-9.6
 */

// Settings tabs per EXTRACTION-PLAN.md
const SETTINGS_TABS = [
  { name: 'Profile', key: 'profile' },
  { name: 'Account', key: 'account' },
  { name: 'Notifications', key: 'notifications' },
  { name: 'Billing', key: 'billing' },
  { name: 'Team', key: 'team' },
] as const;

test.describe('Settings', () => {
  // Enable video recording for settings navigation flow
  test.use({
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 },
    },
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  /**
   * Navigate to settings page
   */
  async function navigateToSettings(page: import('@playwright/test').Page): Promise<boolean> {
    // Try sidebar navigation
    const settingsNav = page.locator(
      SELECTORS.sidebarItem('Settings') + ', ' +
      SELECTORS.sidebarItem('settings') + ', ' +
      'a[href*="settings"], [data-testid*="settings"]'
    ).first();

    if (await settingsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsNav.click();
      await page.waitForTimeout(500);
      return true;
    }

    // Try direct URL navigation
    await page.goto('/settings');
    await waitForStable(page);

    // Verify we're on settings page
    const settingsPage = page.locator(
      SELECTORS.settingsNav + ', ' +
      '[data-testid*="settings"], [class*="settings"]'
    ).first();

    return await settingsPage.isVisible({ timeout: 3000 }).catch(() => false);
  }

  /**
   * Navigate to a specific settings tab
   */
  async function navigateToTab(
    page: import('@playwright/test').Page,
    tabName: string
  ): Promise<boolean> {
    const tab = page.locator(
      SELECTORS.settingsTab(tabName) + ', ' +
      `[role="tab"]:has-text("${tabName}"), ` +
      `button:has-text("${tabName}"), ` +
      `a:has-text("${tabName}")`
    ).first();

    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(400);
      return true;
    }
    return false;
  }

  test('capture settings page default state', async ({ page }) => {
    // 9.1 Settings Navigation
    const onSettings = await navigateToSettings(page);
    if (!onSettings) {
      test.skip();
      return;
    }

    // Default/Profile tab
    await screenshot(page, 'settings', 'settings-page-default');

    // Tab hover state
    const tabs = page.locator(
      '[role="tab"], button:has-text("Account"), button:has-text("Notifications")'
    );
    const tabCount = await tabs.count();

    if (tabCount > 1) {
      const secondTab = tabs.nth(1);
      await secondTab.hover();
      await page.waitForTimeout(150);
      await screenshot(page, 'settings', 'settings-tab-hover');
    }
  });

  test('capture profile tab', async ({ page }) => {
    // 9.2 Profile Tab
    const onSettings = await navigateToSettings(page);
    if (!onSettings) {
      test.skip();
      return;
    }

    // Navigate to Profile tab (may be default)
    await navigateToTab(page, 'Profile');
    await screenshot(page, 'settings', 'settings-profile-default');

    // Input focus state
    const input = page.locator(
      'input[type="text"], input[type="email"], input[name*="name"]'
    ).first();

    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.click();
      await page.waitForTimeout(200);
      await screenshot(page, 'settings', 'settings-profile-input-focus');

      // Edit value
      await input.fill('Test User Edited');
      await page.waitForTimeout(200);
      await screenshot(page, 'settings', 'settings-profile-edited');
    }

    // Save button hover
    const saveBtn = page.locator(
      'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
    ).first();

    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.hover();
      await page.waitForTimeout(150);
      await screenshot(page, 'settings', 'settings-profile-save-hover');
    }
  });

  test('capture account tab', async ({ page }) => {
    // 9.3 Account Tab
    const onSettings = await navigateToSettings(page);
    if (!onSettings) {
      test.skip();
      return;
    }

    const navigated = await navigateToTab(page, 'Account');
    if (!navigated) {
      test.skip();
      return;
    }

    await screenshot(page, 'settings', 'settings-account-default');

    // Password fields
    const passwordField = page.locator(
      'input[type="password"], input[name*="password"]'
    ).first();

    if (await passwordField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passwordField.scrollIntoViewIfNeeded();
      await screenshot(page, 'settings', 'settings-account-password');
    }

    // Danger zone / delete account section
    const dangerZone = page.locator(
      '[class*="danger"], [data-testid*="danger"], ' +
      ':has-text("Delete Account"), :has-text("Danger Zone")'
    ).first();

    if (await dangerZone.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dangerZone.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await screenshot(page, 'settings', 'settings-account-danger-zone');
    }
  });

  test('capture notifications tab with switch states', async ({ page }) => {
    // 9.4 Notifications Tab
    const onSettings = await navigateToSettings(page);
    if (!onSettings) {
      test.skip();
      return;
    }

    const navigated = await navigateToTab(page, 'Notifications');
    if (!navigated) {
      test.skip();
      return;
    }

    await screenshot(page, 'settings', 'settings-notifications-default');

    // Find switch/toggle element
    const switchEl = page.locator(
      '[role="switch"], input[type="checkbox"], ' +
      '[data-testid*="switch"], [class*="switch"], [class*="toggle"]'
    ).first();

    if (await switchEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check current state and capture
      const isChecked = await switchEl.getAttribute('data-state') === 'checked' ||
        await switchEl.getAttribute('aria-checked') === 'true' ||
        await switchEl.isChecked().catch(() => false);

      if (isChecked) {
        await screenshot(page, 'settings', 'settings-notifications-switch-on');

        // Toggle off
        await switchEl.click();
        await page.waitForTimeout(300);
        await screenshot(page, 'settings', 'settings-notifications-switch-off');
      } else {
        await screenshot(page, 'settings', 'settings-notifications-switch-off');

        // Toggle on
        await switchEl.click();
        await page.waitForTimeout(300);
        await screenshot(page, 'settings', 'settings-notifications-switch-on');
      }

      // Hover state
      await switchEl.hover();
      await page.waitForTimeout(150);
      await screenshot(page, 'settings', 'settings-notifications-switch-hover');
    }
  });

  test('capture billing tab', async ({ page }) => {
    // 9.5 Billing Tab
    const onSettings = await navigateToSettings(page);
    if (!onSettings) {
      test.skip();
      return;
    }

    const navigated = await navigateToTab(page, 'Billing');
    if (!navigated) {
      test.skip();
      return;
    }

    await screenshot(page, 'settings', 'settings-billing-default');

    // Current plan card
    const planCard = page.locator(
      '[class*="plan"], [data-testid*="plan"], ' +
      ':has-text("Plan"), :has-text("Subscription")'
    ).first();

    if (await planCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await planCard.scrollIntoViewIfNeeded();
      await screenshot(page, 'settings', 'settings-billing-plan-card');
    }

    // Credits display
    const credits = page.locator(
      '[class*="credit"], [data-testid*="credit"], ' +
      ':has-text("Credits"), :has-text("Usage")'
    ).first();

    if (await credits.isVisible({ timeout: 2000 }).catch(() => false)) {
      await credits.scrollIntoViewIfNeeded();
      await screenshot(page, 'settings', 'settings-billing-credits');
    }

    // Stripe portal link
    const stripeLink = page.locator(
      'a:has-text("Manage"), a:has-text("Stripe"), ' +
      'button:has-text("Manage Billing"), [data-testid*="stripe"]'
    ).first();

    if (await stripeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stripeLink.scrollIntoViewIfNeeded();
      await screenshot(page, 'settings', 'settings-billing-stripe-link');
    }
  });

  test('capture team tab', async ({ page }) => {
    // 9.6 Team Tab
    const onSettings = await navigateToSettings(page);
    if (!onSettings) {
      test.skip();
      return;
    }

    const navigated = await navigateToTab(page, 'Team');
    if (!navigated) {
      test.skip();
      return;
    }

    await screenshot(page, 'settings', 'settings-team-default');

    // Team member card
    const memberCard = page.locator(
      '[class*="member"], [data-testid*="member"], ' +
      '[class*="user-card"], [role="listitem"]'
    ).first();

    if (await memberCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await memberCard.scrollIntoViewIfNeeded();
      await screenshot(page, 'settings', 'settings-team-member-card');
    }

    // Invite button
    const inviteBtn = page.locator(
      'button:has-text("Invite"), button:has-text("Add Member"), ' +
      '[data-testid*="invite"]'
    ).first();

    if (await inviteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inviteBtn.scrollIntoViewIfNeeded();
      await screenshot(page, 'settings', 'settings-team-invite-button');
    }

    // Role dropdown
    const roleDropdown = page.locator(
      '[data-testid*="role"], select:has-text("Role"), ' +
      'button:has-text("Admin"), button:has-text("Member"), ' +
      '[class*="role-select"]'
    ).first();

    if (await roleDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roleDropdown.click();
      await page.waitForTimeout(300);
      await screenshot(page, 'settings', 'settings-team-role-dropdown');
      await page.keyboard.press('Escape');
    }
  });

  test('record settings navigation flow', async ({ page }, testInfo) => {
    // Record the complete settings navigation flow per EXTRACTION-PLAN.md Part 12.3
    const onSettings = await navigateToSettings(page);
    if (!onSettings) {
      test.skip();
      return;
    }

    // Tab through all sections
    for (const tab of SETTINGS_TABS) {
      const navigated = await navigateToTab(page, tab.name);
      if (navigated) {
        await page.waitForTimeout(500);

        // Interact with each tab
        if (tab.key === 'profile') {
          const input = page.locator('input[type="text"]').first();
          if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
            await input.click();
            await page.waitForTimeout(300);
          }
        }

        if (tab.key === 'notifications') {
          const switchEl = page.locator('[role="switch"], input[type="checkbox"]').first();
          if (await switchEl.isVisible({ timeout: 1000 }).catch(() => false)) {
            await switchEl.click();
            await page.waitForTimeout(300);
            await switchEl.click(); // Toggle back
            await page.waitForTimeout(300);
          }
        }
      }
    }

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('settings-navigation', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
