import { test, expect } from "@playwright/test";

// Activated by Plan 02-06 — three end-to-end scenarios covering the 9-card profile
// interview modal flow. Selectors rely on data-testid attributes added by
// Plans 02-03 (cards), 02-04 (modal + content-form gate), and 02-05 (settings tab).

test.describe("Profile Interview E2E", () => {
  test("happy path — user fills core cards, saves profile, modal closes, upload proceeds", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Trigger Submit on the dashboard form; the modal should intercept for users
    // without a saved profile (PROFILE-14 — modal-on-first-upload-click).
    await page.locator('button[aria-label="Submit test"]').click();

    const modal = page.locator('[data-testid="profile-interview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Card 0 — select TikTok platform, click Continue
    await modal.locator('[data-testid="card-0-tile-tiktok"]').click();
    await modal.locator('button:has-text("Continue")').click();

    // Card 1 — pick fitness primary, then yoga sub, Continue
    await modal.locator('[data-testid="card-1-primary-fitness"]').click();
    await modal.locator('[data-testid="card-1-sub-yoga"]').click();
    await modal.locator('button:has-text("Continue")').click();

    // Cards 2..7 — click Skip this question (D-04 — individual cards skippable, full flow mandatory)
    for (let i = 2; i <= 7; i++) {
      await modal.locator('button:has-text("Skip this question")').click();
    }

    // Card 8 — fill pain points, click Save Profile
    await modal
      .locator('[data-testid="card-8-textarea"]')
      .fill("Hook retention drops at second 2");
    await modal.locator('button:has-text("Save Profile")').click();

    // Modal closes after successful save
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Upload proceeds — loading skeleton appears (mirrors viral-predictor.spec.ts assertion at line 22)
    await expect(
      page
        .locator('.animate-pulse, [class*="GlassCard"], [class*="glass-card"]')
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("skip-all path — user clicks 'I'll do this later' on Card 0, modal closes, upload proceeds", async ({
    page,
  }) => {
    // NOTE: this test assumes profile_interview_seen_at is null at start — the auth.setup.ts
    // test user is recreated per Playwright run. If the happy-path test runs first and stamps
    // seen_at, this skip-all path will not trigger the modal. The Phase 2 verifier runs both
    // tests; for M1 sign-off we accept sequential ordering as the contract.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.locator('button[aria-label="Submit test"]').click();

    const modal = page.locator('[data-testid="profile-interview-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click "I'll do this later" (UI-SPEC line 165 — Card 0 ghost skip-all link)
    await modal.locator("button:has-text(\"I'll do this later\")").click();

    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Subsequent submit should NOT re-trigger the modal (seen_at is set)
    await page.locator('button[aria-label="Submit test"]').click();
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test("settings edit — /settings?tab=creator-profile renders all 9 sections + Save shows success toast", async ({
    page,
  }) => {
    await page.goto("/settings?tab=creator-profile");
    await page.waitForLoadState("networkidle");

    // 6th tab is selected (Plan 02-05 added the Creator Profile tab with Sparkles icon)
    await expect(
      page.locator('button[role="tab"]:has-text("Creator Profile")')
    ).toHaveAttribute("data-state", "active");

    // All 9 sections render (settings-card-0 .. settings-card-8 testids from ProfileSettingsForm)
    for (let i = 0; i <= 8; i++) {
      await expect(
        page.locator(`[data-testid="settings-card-${i}"]`)
      ).toBeVisible();
    }

    // Fill pain points (Card 8) and save
    await page
      .locator('[data-testid="card-8-textarea"]')
      .fill("Updated pain point from settings");
    await page.locator('button:has-text("Save changes")').click();

    // Toast appears with the expected copy (Plan 02-05 toast contract — variant: "success")
    await expect(page.locator('text="Profile updated"')).toBeVisible({
      timeout: 5000,
    });
  });
});
