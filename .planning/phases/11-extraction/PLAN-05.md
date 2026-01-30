---
phase: 11-extraction
plan: 05
type: execute
wave: 5
depends_on: [PLAN-04]
files_modified:
  - extraction/tests/09-settings.spec.ts
  - extraction/tests/10-modals.spec.ts
autonomous: true

must_haves:
  truths:
    - "All 5 settings tabs captured: Profile, Account, Notifications, Billing, Team"
    - "Switch/toggle states captured"
    - "Feedback modal captured with all states"
  artifacts:
    - path: "extraction/tests/09-settings.spec.ts"
      provides: "Settings page tab captures"
      contains: "test.describe('Settings'"
    - path: "extraction/tests/10-modals.spec.ts"
      provides: "Modal captures"
      contains: "test.describe('Modals'"
---

<objective>
Create Playwright tests for Parts 9-10 of EXTRACTION-PLAN.md: Settings and Modals.

Purpose: Capture all settings tabs and modal states.
Output: Test files for settings navigation and modal interactions.
</objective>

<context>
@.planning/phases/11-extraction/EXTRACTION-PLAN.md
@extraction/tests/helpers.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Settings Tests (Part 9)</name>
  <files>
    - extraction/tests/09-settings.spec.ts
  </files>
  <action>
Create extraction/tests/09-settings.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to settings
    await page.goto('/settings');
    await waitForStable(page);
  });

  test('capture settings navigation', async ({ page }, testInfo) => {
    // Desktop only

    // Default settings page (usually Profile tab)
    await screenshot(page, 'settings', 'settings-page-default');

    // Tab hover state
    const tabs = page.locator(SELECTORS.settingsNav + ' button, ' + SELECTORS.settingsNav + ' a');
    const firstTab = tabs.first();
    if (await firstTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstTab.hover();
      await page.waitForTimeout(100);
      await screenshot(page, 'settings', 'settings-tab-hover');
    }
  });

  test('capture profile tab', async ({ page }, testInfo) => {
    // Desktop only

    // Click Profile tab if not already active
    const profileTab = page.locator(SELECTORS.settingsTab('Profile')).first();
    if (await profileTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await profileTab.click();
      await page.waitForTimeout(300);
    }

    // Profile section
    await screenshot(page, 'settings', 'settings-profile-default');

    // Input focus state
    const input = page.locator('input[type="text"], input[name*="name"]').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.focus();
      await page.waitForTimeout(100);
      await screenshot(page, 'settings', 'settings-profile-input-focus');

      // Edit value
      const currentValue = await input.inputValue();
      await input.fill(currentValue + ' (edited)');
      await page.waitForTimeout(100);
      await screenshot(page, 'settings', 'settings-profile-edited');

      // Restore
      await input.fill(currentValue);
    }

    // Save button hover
    const saveBtn = page.locator('button:has-text("Save"), button[type="submit"]').first();
    if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveBtn.hover();
      await page.waitForTimeout(100);
      await screenshot(page, 'settings', 'settings-profile-save-hover');
    }
  });

  test('capture account tab', async ({ page }, testInfo) => {
    // Desktop only

    // Click Account tab
    const accountTab = page.locator(SELECTORS.settingsTab('Account')).first();
    if (!await accountTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Account tab not found');
      return;
    }

    await accountTab.click();
    await page.waitForTimeout(300);

    // Account section
    await screenshot(page, 'settings', 'settings-account-default');

    // Password fields
    const passwordSection = page.locator('[data-testid*="password"], [class*="password"]').first();
    if (await passwordSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'settings', 'settings-account-password');
    }

    // Danger zone (scroll down)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);

    const dangerZone = page.locator('[class*="danger"], [data-testid*="danger"], :has-text("Delete Account")').first();
    if (await dangerZone.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'settings', 'settings-account-danger-zone');
    }
  });

  test('capture notifications tab', async ({ page }, testInfo) => {
    // Desktop only

    // Click Notifications tab
    const notifTab = page.locator(SELECTORS.settingsTab('Notification')).first();
    if (!await notifTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Notifications tab not found');
      return;
    }

    await notifTab.click();
    await page.waitForTimeout(300);

    // Notifications section
    await screenshot(page, 'settings', 'settings-notifications-default');

    // Find switches
    const switches = page.locator('[role="switch"], input[type="checkbox"], [data-state]');
    const switchCount = await switches.count();

    if (switchCount > 0) {
      const firstSwitch = switches.first();

      // Get current state
      const isChecked = await firstSwitch.getAttribute('data-state') === 'checked' ||
                        await firstSwitch.isChecked().catch(() => false);

      if (isChecked) {
        await screenshot(page, 'settings', 'settings-notifications-switch-on');
        await firstSwitch.click();
        await page.waitForTimeout(200);
        await screenshot(page, 'settings', 'settings-notifications-switch-off');
        // Restore
        await firstSwitch.click();
      } else {
        await screenshot(page, 'settings', 'settings-notifications-switch-off');
        await firstSwitch.click();
        await page.waitForTimeout(200);
        await screenshot(page, 'settings', 'settings-notifications-switch-on');
        // Restore
        await firstSwitch.click();
      }

      // Hover state
      await firstSwitch.hover();
      await page.waitForTimeout(100);
      await screenshot(page, 'settings', 'settings-notifications-switch-hover');
    }
  });

  test('capture billing tab', async ({ page }, testInfo) => {
    // Desktop only

    // Click Billing tab
    const billingTab = page.locator(SELECTORS.settingsTab('Billing')).first();
    if (!await billingTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Billing tab not found');
      return;
    }

    await billingTab.click();
    await page.waitForTimeout(300);

    // Billing section
    await screenshot(page, 'settings', 'settings-billing-default');

    // Plan card
    const planCard = page.locator('[data-testid*="plan"], [class*="plan-card"]').first();
    if (await planCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'settings', 'settings-billing-plan-card');
    }

    // Credits display
    const credits = page.locator('[data-testid*="credit"], [class*="credit"]').first();
    if (await credits.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'settings', 'settings-billing-credits');
    }

    // Stripe portal link
    const stripeLink = page.locator('a:has-text("Stripe"), a:has-text("Manage"), [data-testid*="stripe"]').first();
    if (await stripeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'settings', 'settings-billing-stripe-link');
    }
  });

  test('capture team tab', async ({ page }, testInfo) => {
    // Desktop only

    // Click Team tab
    const teamTab = page.locator(SELECTORS.settingsTab('Team')).first();
    if (!await teamTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Team tab not found');
      return;
    }

    await teamTab.click();
    await page.waitForTimeout(300);

    // Team section
    await screenshot(page, 'settings', 'settings-team-default');

    // Team member card
    const memberCard = page.locator('[data-testid*="member"], [class*="member-card"]').first();
    if (await memberCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'settings', 'settings-team-member-card');
    }

    // Invite button
    const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add")').first();
    if (await inviteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'settings', 'settings-team-invite-button');
    }

    // Role dropdown
    const roleDropdown = page.locator('[data-testid*="role"], select, [class*="role"]').first();
    if (await roleDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roleDropdown.click();
      await page.waitForTimeout(200);
      await screenshot(page, 'settings', 'settings-team-role-dropdown');
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Settings Video Flow', () => {
  test.use({
    video: { mode: 'on', size: { width: 1440, height: 900 } },
  });

  test('record settings navigation flow', async ({ page }, testInfo) => {
    await page.goto('/settings');
    await waitForStable(page);

    // Navigate through all tabs
    const tabs = ['Profile', 'Account', 'Notifications', 'Billing', 'Team'];

    for (const tab of tabs) {
      const tabEl = page.locator(SELECTORS.settingsTab(tab)).first();
      if (await tabEl.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tabEl.click();
        await page.waitForTimeout(800);
      }
    }

    // Interact with elements
    const input = page.locator('input[type="text"]').first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.focus();
      await page.waitForTimeout(300);
    }

    const switchEl = page.locator('[role="switch"]').first();
    if (await switchEl.isVisible({ timeout: 1000 }).catch(() => false)) {
      await switchEl.click();
      await page.waitForTimeout(300);
      await switchEl.click();
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
```
  </action>
  <verify>
- All 5 settings tabs captured
- Switch on/off/hover states
- Video for settings navigation flow
  </verify>
</task>

<task type="auto">
  <name>Task 2: Modals Tests (Part 10)</name>
  <files>
    - extraction/tests/10-modals.spec.ts
  </files>
  <action>
Create extraction/tests/10-modals.spec.ts:

```typescript
import { test, expect, screenshot, waitForStable, SELECTORS } from './helpers';

test.describe('Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
  });

  test('capture feedback modal', async ({ page }, testInfo) => {
    // Desktop only

    // Find feedback trigger
    const feedbackTrigger = page.locator(
      'button:has-text("Feedback"), ' +
      '[data-testid*="feedback"], ' +
      '[aria-label*="feedback"]'
    ).first();

    if (!await feedbackTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Feedback trigger not found');
      return;
    }

    // Trigger visible
    await screenshot(page, 'modals', 'modal-feedback-trigger');

    // Open modal
    await feedbackTrigger.click();
    await page.waitForTimeout(300);

    // Modal open
    const modal = page.locator('[role="dialog"]').first();
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 'modals', 'modal-feedback-open');

      // Textarea focus
      const textarea = modal.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
        await textarea.focus();
        await page.waitForTimeout(100);
        await screenshot(page, 'modals', 'modal-feedback-textarea-focus');

        // Fill content
        await textarea.fill('This is sample feedback for the extraction capture. The product is great!');
        await page.waitForTimeout(100);
        await screenshot(page, 'modals', 'modal-feedback-filled');
      }

      // Submit button hover
      const submitBtn = modal.locator('button:has-text("Submit"), button:has-text("Send")').first();
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitBtn.hover();
        await page.waitForTimeout(100);
        await screenshot(page, 'modals', 'modal-feedback-submit-hover');
      }

      await page.keyboard.press('Escape');
    }
  });

  test('capture generic modal structure', async ({ page }, testInfo) => {
    // Desktop only

    // Try to open any modal to capture generic structure
    const modalTriggers = [
      'button:has-text("New")',
      'button:has-text("Create")',
      'button:has-text("Add")',
      '[data-testid*="modal-trigger"]',
    ];

    for (const trigger of modalTriggers) {
      const btn = page.locator(trigger).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);

        const modal = page.locator('[role="dialog"]').first();
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Generic modal structure
          await screenshot(page, 'modals', 'modal-generic-open');

          // Close button
          const closeBtn = modal.locator(SELECTORS.modalClose).first();
          if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeBtn.hover();
            await page.waitForTimeout(100);
            await screenshot(page, 'modals', 'modal-close-hover');
          }

          await page.keyboard.press('Escape');
          break;
        }
      }
    }
  });

  test('capture alert dialog (confirmation)', async ({ page }, testInfo) => {
    // Desktop only

    // Try to find a delete or dangerous action that shows confirmation
    // Navigate to settings for danger zone
    await page.goto('/settings');
    await waitForStable(page);

    // Go to Account tab
    const accountTab = page.locator(SELECTORS.settingsTab('Account')).first();
    if (await accountTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await accountTab.click();
      await page.waitForTimeout(300);

      // Scroll to danger zone
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);

      // Look for delete button
      const deleteBtn = page.locator('button:has-text("Delete"), button[class*="danger"]').first();
      if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteBtn.click();
        await page.waitForTimeout(300);

        // Alert dialog
        const alertDialog = page.locator('[role="alertdialog"]').first();
        if (await alertDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          await screenshot(page, 'modals', 'modal-alert-dialog');

          // Cancel and confirm buttons
          const cancelBtn = alertDialog.locator('button:has-text("Cancel")').first();
          const confirmBtn = alertDialog.locator('button:has-text("Delete"), button:has-text("Confirm")').last();

          if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelBtn.hover();
            await page.waitForTimeout(100);
            await screenshot(page, 'modals', 'modal-alert-cancel-hover');
          }

          if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await confirmBtn.hover();
            await page.waitForTimeout(100);
            await screenshot(page, 'modals', 'modal-alert-confirm-hover');
          }

          await page.keyboard.press('Escape');
        }
      }
    }
  });
});
```
  </action>
  <verify>
- Feedback modal states captured
- Modal structure with close button
- Alert dialog confirmation states
  </verify>
</task>

</tasks>

<verification>
- [ ] `extraction/tests/09-settings.spec.ts` captures all 5 tabs
- [ ] `extraction/tests/10-modals.spec.ts` captures feedback and alert dialogs
- [ ] Switch toggle states (on/off/hover)
- [ ] Video for settings flow
</verification>

<success_criteria>
- All settings tabs captured per EXTRACTION-PLAN.md Part 9
- Modal states captured per Part 10
- Interactive elements have hover states
</success_criteria>
