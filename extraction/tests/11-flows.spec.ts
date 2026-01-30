import { test, expect, waitForStable, SELECTORS, screenshot } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

const VIDEOS_DIR = path.join(__dirname, '..', 'videos', 'flows');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

/**
 * Complete User Flows - Detailed Video Recordings
 *
 * These tests record comprehensive videos of every user journey,
 * capturing all interactions, hover states, and transitions.
 *
 * Each flow is designed to show realistic user behavior with
 * natural timing and deliberate pauses for clarity.
 */

test.describe('Complete User Flows', () => {
  test.use({
    video: {
      mode: 'on',
      size: { width: 1440, height: 900 },
    },
    launchOptions: {
      slowMo: 50, // Slight slowdown for smoother video
    },
  });

  test('Flow 1: Complete Test Creation - TikTok Script', async ({ page }, testInfo) => {
    /**
     * FLOW: Dashboard → New Test → Select TikTok → Fill Form → Simulate →
     *       Watch Loading → View Results → Expand All Sections → Copy Variant → History
     *
     * Duration: ~90 seconds
     * Captures: Full test creation lifecycle with all UI interactions
     */

    // === SCENE 1: Dashboard Entry ===
    await page.goto('/');
    await waitForStable(page);
    await page.waitForTimeout(1500); // Let viewer see dashboard

    // Hover over sidebar items to show navigation
    const sidebarItems = page.locator('nav a, aside a, [data-testid*="nav"]');
    const navCount = await sidebarItems.count();
    for (let i = 0; i < Math.min(navCount, 4); i++) {
      await sidebarItems.nth(i).hover();
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);

    // === SCENE 2: Open Test Type Selector ===
    const newTestBtn = page.locator(SELECTORS.newTestBtn).first();
    if (!await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('New Test button not found');
      return;
    }

    // Hover before clicking
    await newTestBtn.hover();
    await page.waitForTimeout(400);
    await newTestBtn.click();
    await page.waitForTimeout(800); // Modal animation

    // === SCENE 3: Browse Test Types ===
    const testTypeModal = page.locator('[role="dialog"]').first();
    if (await testTypeModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Hover through several test types to show options
      const testTypes = [
        'Survey', 'Article', 'Advertisement',
        'LinkedIn', 'Instagram', 'TikTok'
      ];

      for (const type of testTypes) {
        const typeBtn = testTypeModal.locator(`button:has-text("${type}")`).first();
        if (await typeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await typeBtn.hover();
          await page.waitForTimeout(400);
        }
      }

      // Select TikTok
      const tiktokBtn = testTypeModal.locator('button:has-text("TikTok")').first();
      if (await tiktokBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tiktokBtn.hover();
        await page.waitForTimeout(300);
        await tiktokBtn.click();
      }
    }
    await page.waitForTimeout(600); // Form transition

    // === SCENE 4: Fill Form with Natural Typing ===
    const textarea = page.locator(SELECTORS.textarea).first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textarea.click();
      await page.waitForTimeout(300);

      // Type content with realistic speed
      const content = `[Hook] Wait, you need to see this!

[Body] I discovered this simple trick that completely changed how I approach my morning routine. Here's what I do:

1. Wake up 30 minutes earlier
2. No phone for the first hour
3. Write down 3 priorities

The results? I'm 10x more productive and way less stressed.

[CTA] Follow for more productivity tips! Drop a fire emoji if you're trying this tomorrow!`;

      await textarea.type(content, { delay: 25 }); // Natural typing speed
      await page.waitForTimeout(800);

      // Show character count if visible
      const charCount = page.locator('[class*="char"], [class*="count"]').first();
      if (await charCount.isVisible({ timeout: 500 }).catch(() => false)) {
        await charCount.hover();
        await page.waitForTimeout(400);
      }
    }

    // === SCENE 5: Submit and Watch Loading ===
    const submitBtn = page.locator(SELECTORS.submitBtn).first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.hover();
      await page.waitForTimeout(400);
      await submitBtn.click();
    }

    // Watch all loading phases - capture the full animation
    console.log('Watching loading phases...');

    // Phase 1-4: Let the loading animation play out
    // Each phase is typically 2-4 seconds
    for (let phase = 1; phase <= 4; phase++) {
      await page.waitForTimeout(3000);

      // Try to capture phase text
      const phaseText = page.locator('[class*="loading"] p, [class*="phase"]').first();
      if (await phaseText.isVisible({ timeout: 500 }).catch(() => false)) {
        const text = await phaseText.textContent();
        console.log(`Phase ${phase}: ${text}`);
      }
    }

    // === SCENE 6: Results Appear ===
    try {
      await page.waitForSelector(
        '[data-testid*="result"], [class*="result"], [class*="score"], [class*="impact"]',
        { timeout: 60000 }
      );
      await page.waitForTimeout(1500); // Let results render fully

      // === SCENE 7: Explore Results ===

      // Impact Score - hover to show details
      const impactScore = page.locator('[class*="impact"], [class*="score"]').first();
      if (await impactScore.isVisible({ timeout: 2000 }).catch(() => false)) {
        await impactScore.hover();
        await page.waitForTimeout(600);
      }

      // Expand each accordion section with deliberate pauses
      const sections = [
        { name: 'Attention', wait: 800 },
        { name: 'Variant', wait: 1000 },
        { name: 'Insight', wait: 800 },
        { name: 'Theme', wait: 800 },
      ];

      for (const section of sections) {
        const sectionBtn = page.locator(
          `button:has-text("${section.name}"), ` +
          `[data-testid*="${section.name.toLowerCase()}"]`
        ).first();

        if (await sectionBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await sectionBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(200);
          await sectionBtn.hover();
          await page.waitForTimeout(300);
          await sectionBtn.click();
          await page.waitForTimeout(section.wait);
        }
      }

      // === SCENE 8: Interact with Variants ===
      const variants = page.locator('[class*="variant-card"], [data-testid*="variant"]');
      const variantCount = await variants.count();

      for (let i = 0; i < Math.min(variantCount, 3); i++) {
        const variant = variants.nth(i);
        await variant.scrollIntoViewIfNeeded();
        await variant.hover();
        await page.waitForTimeout(500);
      }

      // Copy a variant
      const copyBtn = page.locator('button:has-text("Copy"), [data-testid*="copy"]').first();
      if (await copyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await copyBtn.hover();
        await page.waitForTimeout(300);
        await copyBtn.click();
        await page.waitForTimeout(800); // Show copy feedback
      }

      // === SCENE 9: Share Button ===
      const shareBtn = page.locator('button:has-text("Share"), [data-testid*="share"]').first();
      if (await shareBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await shareBtn.hover();
        await page.waitForTimeout(300);
        await shareBtn.click();
        await page.waitForTimeout(600);
        await page.keyboard.press('Escape');
      }

    } catch {
      console.log('Results did not appear within timeout');
    }

    // === SCENE 10: Navigate to History ===
    const historyLink = page.locator('a:has-text("History"), button:has-text("History")').first();
    if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyLink.hover();
      await page.waitForTimeout(300);
      await historyLink.click();
      await page.waitForTimeout(1000);

      // Show the test in history
      const historyItems = page.locator('[data-testid*="history-item"], [class*="history-item"]');
      if (await historyItems.count() > 0) {
        await historyItems.first().hover();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000); // Final pause

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('01-complete-test-flow', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });

  test('Flow 2: Society Management', async ({ page }, testInfo) => {
    /**
     * FLOW: Dashboard → Open Society Selector → Browse Societies →
     *       Open Menu → Create New Society → Fill Details → Cancel → Select Society
     *
     * Duration: ~60 seconds
     * Captures: Society browsing, menu interactions, creation flow
     */

    await page.goto('/');
    await waitForStable(page);
    await page.waitForTimeout(1000);

    // === SCENE 1: Open Society Selector ===
    const societyTrigger = page.locator(SELECTORS.societyTrigger).first();
    if (!await societyTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Society selector not found');
      return;
    }

    await societyTrigger.hover();
    await page.waitForTimeout(400);
    await societyTrigger.click();
    await page.waitForTimeout(700);

    // === SCENE 2: Browse Existing Societies ===
    const societyModal = page.locator('[role="dialog"]').first();
    if (await societyModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const societies = societyModal.locator('[data-testid*="society"], [class*="society-card"], li');
      const count = await societies.count();

      // Hover through each society
      for (let i = 0; i < Math.min(count, 5); i++) {
        await societies.nth(i).hover();
        await page.waitForTimeout(500);
      }

      // === SCENE 3: Open Society Menu ===
      if (count > 0) {
        const firstSociety = societies.first();
        const menuBtn = firstSociety.locator('button[aria-label*="menu"], [class*="menu"]').first();

        if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await menuBtn.hover();
          await page.waitForTimeout(300);
          await menuBtn.click();
          await page.waitForTimeout(400);

          // Hover menu options
          const menuItems = page.locator('[role="menuitem"]');
          const menuCount = await menuItems.count();
          for (let i = 0; i < menuCount; i++) {
            await menuItems.nth(i).hover();
            await page.waitForTimeout(300);
          }

          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }

      // === SCENE 4: Create New Society Flow ===
      const createBtn = societyModal.locator(SELECTORS.createSocietyBtn).first();
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.hover();
        await page.waitForTimeout(400);
        await createBtn.click();
        await page.waitForTimeout(600);

        // Fill society name
        const nameInput = page.locator('input[type="text"], input[name*="name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.click();
          await page.waitForTimeout(200);
          await nameInput.type('Tech Innovators Community', { delay: 40 });
          await page.waitForTimeout(800);

          // Look for continue/next button
          const nextBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
          if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await nextBtn.hover();
            await page.waitForTimeout(400);
            // Don't click - just show the hover state
          }
        }

        // Cancel out
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }

      // === SCENE 5: Select a Society ===
      if (count > 0) {
        const targetSociety = societies.nth(Math.min(1, count - 1));
        await targetSociety.hover();
        await page.waitForTimeout(400);
        await targetSociety.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('02-society-management', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });

  test('Flow 3: Settings Navigation', async ({ page }, testInfo) => {
    /**
     * FLOW: Navigate to Settings → Profile Tab → Edit Field →
     *       Account Tab → Notifications (Toggle Switches) → Billing → Team
     *
     * Duration: ~75 seconds
     * Captures: All settings tabs with interactions
     */

    // === SCENE 1: Navigate to Settings ===
    await page.goto('/');
    await waitForStable(page);
    await page.waitForTimeout(800);

    // Click settings in sidebar
    const settingsLink = page.locator('a:has-text("Settings"), button:has-text("Settings")').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.hover();
      await page.waitForTimeout(300);
      await settingsLink.click();
    } else {
      await page.goto('/settings');
    }
    await waitForStable(page);
    await page.waitForTimeout(1000);

    // === SCENE 2: Profile Tab ===
    const profileTab = page.locator(SELECTORS.settingsTab('Profile')).first();
    if (await profileTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await profileTab.click();
      await page.waitForTimeout(600);

      // Edit a text field
      const inputs = page.locator('input[type="text"]');
      const inputCount = await inputs.count();

      for (let i = 0; i < Math.min(inputCount, 2); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
          await input.click();
          await page.waitForTimeout(300);

          const value = await input.inputValue();
          await input.fill('');
          await input.type('Demo User', { delay: 30 });
          await page.waitForTimeout(500);
          await input.fill(value); // Restore
          await page.waitForTimeout(300);
        }
      }

      // Hover save button
      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveBtn.hover();
        await page.waitForTimeout(400);
      }
    }

    // === SCENE 3: Account Tab ===
    const accountTab = page.locator(SELECTORS.settingsTab('Account')).first();
    if (await accountTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await accountTab.hover();
      await page.waitForTimeout(300);
      await accountTab.click();
      await page.waitForTimeout(800);

      // Scroll to show danger zone
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
    }

    // === SCENE 4: Notifications Tab - Toggle Switches ===
    const notifTab = page.locator(SELECTORS.settingsTab('Notification')).first();
    if (await notifTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notifTab.hover();
      await page.waitForTimeout(300);
      await notifTab.click();
      await page.waitForTimeout(800);

      // Toggle switches
      const switches = page.locator('[role="switch"], input[type="checkbox"]');
      const switchCount = await switches.count();

      for (let i = 0; i < Math.min(switchCount, 3); i++) {
        const switchEl = switches.nth(i);
        if (await switchEl.isVisible({ timeout: 500 }).catch(() => false)) {
          await switchEl.hover();
          await page.waitForTimeout(300);
          await switchEl.click();
          await page.waitForTimeout(400);
          await switchEl.click(); // Restore
          await page.waitForTimeout(300);
        }
      }
    }

    // === SCENE 5: Billing Tab ===
    const billingTab = page.locator(SELECTORS.settingsTab('Billing')).first();
    if (await billingTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await billingTab.hover();
      await page.waitForTimeout(300);
      await billingTab.click();
      await page.waitForTimeout(1000);

      // Hover plan card
      const planCard = page.locator('[class*="plan"], [data-testid*="plan"]').first();
      if (await planCard.isVisible({ timeout: 1000 }).catch(() => false)) {
        await planCard.hover();
        await page.waitForTimeout(500);
      }

      // Hover upgrade/manage button
      const manageBtn = page.locator('button:has-text("Manage"), button:has-text("Upgrade"), a:has-text("Stripe")').first();
      if (await manageBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await manageBtn.hover();
        await page.waitForTimeout(400);
      }
    }

    // === SCENE 6: Team Tab ===
    const teamTab = page.locator(SELECTORS.settingsTab('Team')).first();
    if (await teamTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await teamTab.hover();
      await page.waitForTimeout(300);
      await teamTab.click();
      await page.waitForTimeout(800);

      // Hover team members
      const members = page.locator('[class*="member"], [data-testid*="member"]');
      const memberCount = await members.count();

      for (let i = 0; i < Math.min(memberCount, 2); i++) {
        await members.nth(i).hover();
        await page.waitForTimeout(400);
      }

      // Hover invite button
      const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add")').first();
      if (await inviteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await inviteBtn.hover();
        await page.waitForTimeout(400);
      }
    }

    await page.waitForTimeout(800);

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('03-settings-navigation', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });

  test('Flow 4: History Management', async ({ page }, testInfo) => {
    /**
     * FLOW: Dashboard → History Section → Browse Items → Select Item →
     *       View Results → Open Menu → Hover Options → Delete Modal → Cancel
     *
     * Duration: ~45 seconds
     * Captures: History browsing, selection, menu, delete confirmation
     */

    await page.goto('/');
    await waitForStable(page);
    await page.waitForTimeout(800);

    // === SCENE 1: Navigate to History ===
    const historyLink = page.locator('a:has-text("History"), button:has-text("History")').first();

    if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyLink.hover();
      await page.waitForTimeout(300);
      await historyLink.click();
      await page.waitForTimeout(1000);
    }

    // === SCENE 2: Browse History Items ===
    const items = page.locator('[data-testid*="history-item"], [class*="history-item"]');
    const count = await items.count();

    if (count === 0) {
      console.log('No history items found');
      return;
    }

    // Hover through items
    for (let i = 0; i < Math.min(count, 4); i++) {
      await items.nth(i).hover();
      await page.waitForTimeout(400);
    }

    // === SCENE 3: Select an Item ===
    const selectedItem = items.first();
    await selectedItem.hover();
    await page.waitForTimeout(300);
    await selectedItem.click();
    await page.waitForTimeout(1000);

    // Results should show in panel
    const resultsPanel = page.locator('[class*="result"], [data-testid*="result"]').first();
    if (await resultsPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Scroll through results
      await page.evaluate(() => {
        const panel = document.querySelector('[class*="result"]');
        if (panel) panel.scrollTop = panel.scrollHeight / 2;
      });
      await page.waitForTimeout(600);
    }

    // === SCENE 4: Open Item Menu ===
    const menuTrigger = selectedItem.locator('button[aria-label*="menu"], [class*="menu"], button:has([class*="dots"])').first();

    if (await menuTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuTrigger.hover();
      await page.waitForTimeout(300);
      await menuTrigger.click();
      await page.waitForTimeout(500);

      // === SCENE 5: Hover Menu Options ===
      const menuItems = page.locator('[role="menuitem"]');
      const menuCount = await menuItems.count();

      for (let i = 0; i < menuCount; i++) {
        await menuItems.nth(i).hover();
        await page.waitForTimeout(350);
      }

      // === SCENE 6: Click Delete ===
      const deleteItem = page.locator('[role="menuitem"]:has-text("Delete")').first();
      if (await deleteItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await deleteItem.hover();
        await page.waitForTimeout(300);
        await deleteItem.click();
        await page.waitForTimeout(500);

        // === SCENE 7: Delete Confirmation Modal ===
        const alertDialog = page.locator('[role="alertdialog"], [role="dialog"]').last();
        if (await alertDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Show the modal
          await page.waitForTimeout(600);

          // Hover cancel
          const cancelBtn = alertDialog.locator('button:has-text("Cancel")').first();
          if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelBtn.hover();
            await page.waitForTimeout(400);
          }

          // Hover confirm/delete
          const confirmBtn = alertDialog.locator('button:has-text("Delete"), button:has-text("Confirm")').last();
          if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await confirmBtn.hover();
            await page.waitForTimeout(400);
          }

          // Cancel (don't actually delete)
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
        }
      } else {
        await page.keyboard.press('Escape');
      }
    }

    await page.waitForTimeout(800);

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('04-history-management', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });

  test('Flow 5: View Selector Deep Dive', async ({ page }, testInfo) => {
    /**
     * FLOW: Dashboard → Open View Selector → Explore All Categories →
     *       Hover Submenus → Select Options → See Dashboard Update
     *
     * Duration: ~40 seconds
     * Captures: View selector dropdown with all submenus
     */

    await page.goto('/');
    await waitForStable(page);
    await page.waitForTimeout(1000);

    // === SCENE 1: Find and Open View Selector ===
    const viewSelector = page.locator(
      '[data-testid*="view"], ' +
      'button:has-text("View"), ' +
      'button:has-text("Country"), ' +
      'button:has-text("All")'
    ).first();

    if (!await viewSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('View selector not found');
      return;
    }

    await viewSelector.hover();
    await page.waitForTimeout(400);
    await viewSelector.click();
    await page.waitForTimeout(600);

    // === SCENE 2: Explore Categories ===
    const categories = ['Country', 'City', 'Generation', 'Role Level', 'All'];

    for (const category of categories) {
      const categoryItem = page.locator(
        `[role="option"]:has-text("${category}"), ` +
        `button:has-text("${category}"), ` +
        `[role="menuitem"]:has-text("${category}")`
      ).first();

      if (await categoryItem.isVisible({ timeout: 500 }).catch(() => false)) {
        await categoryItem.hover();
        await page.waitForTimeout(600);

        // If there's a submenu, hover through options
        const submenuItems = page.locator('[role="option"], [role="menuitem"]').filter({
          has: page.locator(':visible')
        });

        const subCount = await submenuItems.count();
        if (subCount > 5) {
          // Likely a submenu appeared
          for (let i = 0; i < Math.min(subCount, 4); i++) {
            await submenuItems.nth(i).hover();
            await page.waitForTimeout(250);
          }
        }
      }
    }

    // === SCENE 3: Select an Option ===
    const anyOption = page.locator('[role="option"], [role="menuitem"]').first();
    if (await anyOption.isVisible({ timeout: 1000 }).catch(() => false)) {
      await anyOption.hover();
      await page.waitForTimeout(300);
      await anyOption.click();
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(800);

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('05-view-selector', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });

  test('Flow 6: Feedback Modal Interaction', async ({ page }, testInfo) => {
    /**
     * FLOW: Dashboard → Find Feedback Button → Open Modal →
     *       Type Feedback → Hover Submit → Cancel
     *
     * Duration: ~30 seconds
     * Captures: Feedback modal with form interaction
     */

    await page.goto('/');
    await waitForStable(page);
    await page.waitForTimeout(800);

    // === SCENE 1: Find Feedback Trigger ===
    const feedbackBtn = page.locator(
      'button:has-text("Feedback"), ' +
      '[data-testid*="feedback"], ' +
      '[aria-label*="feedback"]'
    ).first();

    if (!await feedbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Feedback button not found');
      return;
    }

    await feedbackBtn.hover();
    await page.waitForTimeout(400);
    await feedbackBtn.click();
    await page.waitForTimeout(600);

    // === SCENE 2: Feedback Modal ===
    const modal = page.locator('[role="dialog"]').first();
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.waitForTimeout(500);

      // === SCENE 3: Type Feedback ===
      const textarea = modal.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
        await textarea.click();
        await page.waitForTimeout(300);

        const feedback = `I love the new simulation feature! The loading phases are really engaging and the results are incredibly detailed.

One suggestion: It would be great to have an export option for the variant suggestions.

Overall, fantastic product!`;

        await textarea.type(feedback, { delay: 20 });
        await page.waitForTimeout(800);
      }

      // === SCENE 4: Hover Submit ===
      const submitBtn = modal.locator('button:has-text("Submit"), button:has-text("Send")').first();
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitBtn.hover();
        await page.waitForTimeout(500);
      }

      // Cancel
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(600);

    // Attach video
    const video = page.video();
    if (video) {
      await testInfo.attach('06-feedback-modal', {
        path: await video.path(),
        contentType: 'video/webm',
      });
    }
  });
});
