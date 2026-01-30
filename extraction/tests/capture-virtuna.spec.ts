import { test as base, Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const VIRTUNA_BASE = 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../../.planning/phases/12-comparison/virtuna-screenshots');

// Override config to use localhost instead of app.societies.io
const test = base.extend<{
  virtunaPage: Page;
}>({
  virtunaPage: async ({ page, context }, use) => {
    // Inject dark mode on every navigation
    await context.addInitScript(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      const style = document.createElement('style');
      style.textContent = `:root { color-scheme: dark !important; }`;
      document.head.appendChild(style);
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await use(page);
  },
});

async function screenshotVirtuna(
  page: Page,
  subfolder: string,
  name: string
): Promise<string> {
  const dir = path.join(OUTPUT_DIR, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, `${name}.png`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(200);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Virtuna screenshot saved: ${filepath}`);
  return filepath;
}

test.describe('Virtuna Selector Screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ virtunaPage: page }) => {
    await page.goto(`${VIRTUNA_BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('02-society-selector-open', async ({ virtunaPage: page }) => {
    // Find society selector trigger - look for Switzerland button or similar
    const trigger = page.locator('button:has-text("Switzerland")').first()
      .or(page.locator('[data-testid="society-selector"]'))
      .or(page.locator('button:has-text("Society")'))
      .or(page.locator('.sidebar button').first());

    if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(300);
    }

    await screenshotVirtuna(page, 'selectors', '02-society-selector-open');
  });

  test('03-society-card-hover', async ({ virtunaPage: page }) => {
    // Open society selector
    const trigger = page.locator('button:has-text("Switzerland")').first()
      .or(page.locator('[data-testid="society-selector"]'))
      .or(page.locator('button:has-text("Society")'));

    if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(300);

      // Hover over first society card
      const card = page.locator('[role="dialog"] >> .society-card').first()
        .or(page.locator('[role="dialog"] >> div:has-text("Switzerland")').first())
        .or(page.locator('[role="dialog"] li').first());

      if (await card.isVisible({ timeout: 1000 }).catch(() => false)) {
        await card.hover();
        await page.waitForTimeout(150);
      }
    }

    await screenshotVirtuna(page, 'selectors', '03-society-card-hover');
  });

  test('04-society-card-menu', async ({ virtunaPage: page }) => {
    // Open society selector
    const trigger = page.locator('button:has-text("Switzerland")').first()
      .or(page.locator('[data-testid="society-selector"]'))
      .or(page.locator('button:has-text("Society")'));

    if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(300);

      // Find and click three-dot menu
      const menuBtn = page.locator('[role="dialog"] button[aria-label*="menu"]').first()
        .or(page.locator('[role="dialog"] button:has(.lucide-more-vertical)'))
        .or(page.locator('[role="dialog"] button:has(svg[class*="dots"])'));

      if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await menuBtn.click();
        await page.waitForTimeout(200);
      }
    }

    await screenshotVirtuna(page, 'selectors', '04-society-card-menu');
  });

  test('05-view-selector-open', async ({ virtunaPage: page }) => {
    // Close any open dialogs first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Click view selector - look for Country button or view dropdown
    const viewSelector = page.locator('button:has-text("Country")').first()
      .or(page.locator('[data-testid="view-selector"]'))
      .or(page.locator('button:has-text("View")'));

    if (await viewSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewSelector.click();
      await page.waitForTimeout(200);
    }

    await screenshotVirtuna(page, 'selectors', '05-view-selector-open');
  });

  test('06-view-role-level', async ({ virtunaPage: page }) => {
    // Close any open dialogs
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Open view selector
    const viewSelector = page.locator('button:has-text("Country")').first()
      .or(page.locator('[data-testid="view-selector"]'))
      .or(page.locator('button:has-text("View")'));

    if (await viewSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewSelector.click();
      await page.waitForTimeout(200);

      // Select Role Level option
      const roleLevel = page.locator('[role="menuitem"]:has-text("Role Level")')
        .or(page.locator('button:has-text("Role Level")'))
        .or(page.locator('div:has-text("Role Level"):visible'));

      if (await roleLevel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await roleLevel.click();
        await page.waitForTimeout(300);
      }
    }

    await screenshotVirtuna(page, 'selectors', '06-view-role-level');
  });

  test('08-test-type-selector', async ({ virtunaPage: page }) => {
    // Click Create New Test button
    const newTestBtn = page.locator('button:has-text("Create New Test")').first()
      .or(page.locator('button:has-text("New Test")'))
      .or(page.locator('[data-testid="new-test"]'))
      .or(page.locator('button:has-text("Create Test")'));

    if (await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTestBtn.click();
      await page.waitForTimeout(300);
    }

    await screenshotVirtuna(page, 'selectors', '08-test-type-selector');
  });
});

test.describe('Virtuna Form Screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ virtunaPage: page }) => {
    await page.goto(`${VIRTUNA_BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('01-tiktok-form-empty', async ({ virtunaPage: page }) => {
    // Open test type selector
    const newTestBtn = page.locator('button:has-text("Create New Test")').first()
      .or(page.locator('button:has-text("New Test")'))
      .or(page.locator('[data-testid="new-test"]'));

    if (await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTestBtn.click();
      await page.waitForTimeout(300);

      // Select TikTok
      const tiktokOption = page.locator('button:has-text("TikTok")')
        .or(page.locator('[data-testid="test-type-tiktok"]'))
        .or(page.locator('div:has-text("TikTok"):visible').first());

      if (await tiktokOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tiktokOption.click();
        await page.waitForTimeout(300);
      }
    }

    await screenshotVirtuna(page, 'forms', '01-tiktok-form-empty');
  });

  test('02-tiktok-form-filled', async ({ virtunaPage: page }) => {
    // Open test type selector
    const newTestBtn = page.locator('button:has-text("Create New Test")').first()
      .or(page.locator('button:has-text("New Test")'))
      .or(page.locator('[data-testid="new-test"]'));

    if (await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTestBtn.click();
      await page.waitForTimeout(300);

      // Select TikTok
      const tiktokOption = page.locator('button:has-text("TikTok")')
        .or(page.locator('[data-testid="test-type-tiktok"]'));

      if (await tiktokOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tiktokOption.click();
        await page.waitForTimeout(300);

        // Fill URL input
        const urlInput = page.locator('input[placeholder*="URL"]')
          .or(page.locator('input[type="url"]'))
          .or(page.locator('input[name="url"]'))
          .or(page.locator('input').first());

        if (await urlInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await urlInput.fill('https://www.tiktok.com/@example/video/123456789');
          await page.waitForTimeout(200);
        }
      }
    }

    await screenshotVirtuna(page, 'forms', '02-tiktok-form-filled');
  });

  test('03-survey-form-empty', async ({ virtunaPage: page }) => {
    // Open test type selector
    const newTestBtn = page.locator('button:has-text("Create New Test")').first()
      .or(page.locator('button:has-text("New Test")'))
      .or(page.locator('[data-testid="new-test"]'));

    if (await newTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTestBtn.click();
      await page.waitForTimeout(300);

      // Select Survey
      const surveyOption = page.locator('button:has-text("Survey")')
        .or(page.locator('[data-testid="test-type-survey"]'))
        .or(page.locator('div:has-text("Survey"):visible').first());

      if (await surveyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await surveyOption.click();
        await page.waitForTimeout(300);
      }
    }

    await screenshotVirtuna(page, 'forms', '03-survey-form-empty');
  });
});
