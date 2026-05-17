import { test, expect } from "@playwright/test";

// Wave 0 scaffold for Phase 2 — Plan 02-05 enables the three e2e scenarios.
// Selectors use data-testid attributes added by Plan 02-03's modal components.

test.describe("Profile Interview E2E", () => {
  test.skip("happy path — user fills all 9 cards, saves profile, upload proceeds", async ({ page }) => {
    // TODO(02-05): navigate to /dashboard, click upload, fill each card, assert
    // profile_interview_seen_at is persisted and the upload submits afterwards.
    await page.goto("/");
    await expect(page).toHaveURL(/.*/);
  });

  test.skip("skip-all path — user clicks 'I'll do this later' on Card 0, modal closes, upload proceeds", async ({ page }) => {
    // TODO(02-05): assert seen_at is set even when no card data is filled.
    await page.goto("/");
    await expect(page).toHaveURL(/.*/);
  });

  test.skip("settings edit — /settings?tab=creator-profile renders the 9 sections and saves toast on success", async ({ page }) => {
    // TODO(02-05): assert tab navigation + toast surfacing.
    await page.goto("/");
    await expect(page).toHaveURL(/.*/);
  });
});
