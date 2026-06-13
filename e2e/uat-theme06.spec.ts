/**
 * THEME-06 UAT capture — Phase 1 exit gate (plan 01-05, Task 2).
 *
 * Captures the 4 reviewable shots the human signs off at the flat-warm
 * visual-system gate (UI-SPEC § THEME-06):
 *   1. desktop-empty.png  — /home @ 1440×900 (serif greeting + centered composer
 *                            + NumenMark, persistent sidebar expanded, ~760px col)
 *   2. desktop-active.png — /analyze/[id] @ 1440×900 for a COMPLETED Simulation
 *                            (composer bottom-pinned + Simulations sidebar w/ score chips)
 *   3. mobile-empty.png   — /home @ 390×844 (full-width composer + gutters, drawer sidebar)
 *   4. mobile-active.png  — /analyze/[id] @ 390×844 (bottom-pinned composer, drawer sidebar)
 *
 * Shots land in `.planning/phases/01-foundation-shell/uat/`.
 *
 * ── PREREQUISITES (the capture-blocker the gate must clear) ───────────────────
 * All four routes are auth-gated (middleware redirects unauthed → /login), and
 * the app middleware itself THROWS without Supabase env, so the WHOLE app 500s
 * with no `.env.local`. To run this capture you MUST have, in `.env.local`
 * (Playwright does NOT auto-load it — export them or use a dotenv wrapper):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY   (app boots at all)
 *   E2E_USER_EMAIL, E2E_USER_PASSWORD                          (this spec logs in)
 *   UAT_ACTIVE_ANALYSIS_ID                                     (a completed
 *       Simulation id owned by E2E_USER for the active shots; if unset, the
 *       active shots are skipped with a clear console note — run one Simulation
 *       through the composer first, or seed a row, then re-run.)
 *
 * Run (dev server must already be on :3000 — config has no webServer):
 *   pnpm run dev   # in another shell, with env loaded
 *   npx playwright test e2e/uat-theme06.spec.ts --config=e2e/playwright.config.ts --project=chromium
 *
 * NOTE: this spec does its OWN login (it does not depend on auth.setup.ts),
 * because this milestone repointed the authed landing to /home — auth.setup.ts
 * only waits for `dashboard`/`welcome` and would hang. Here we accept /home.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const UAT_DIR = path.join(
  process.cwd(),
  ".planning/phases/01-foundation-shell/uat",
);

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;
const ACTIVE_ID = process.env.UAT_ACTIVE_ANALYSIS_ID;

function shot(page: Page, name: string) {
  return page.screenshot({
    path: path.join(UAT_DIR, name),
    fullPage: false, // match the viewport exactly (gate reviews the fold)
  });
}

/** Log in via the real /login form and land on /home (this milestone's authed landing). */
async function login(page: Page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "Missing E2E_USER_EMAIL / E2E_USER_PASSWORD — set them in the environment before capturing UAT shots.",
    );
  }
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]:has-text("Sign in")').click();
  // Authed landing is /home (D-23); accept the legacy targets too for safety.
  await page.waitForURL(
    (url) =>
      /\/(home|analyze|dashboard|welcome)/.test(url.pathname),
    { timeout: 30000 },
  );
  await page.waitForLoadState("networkidle");
}

test.beforeAll(() => {
  fs.mkdirSync(UAT_DIR, { recursive: true });
});

test("capture THEME-06 UAT shots (desktop/mobile × empty/active)", async ({
  page,
}) => {
  await login(page);

  // ── 1. desktop-empty: /home at desktop, sidebar expanded ──────────────────
  await page.setViewportSize(DESKTOP);
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  // greeting (serif <h1>) + centered composer present
  await expect(page.locator('[data-testid="composer"]')).toBeVisible();
  await expect(page.locator("h1.font-serif")).toBeVisible();
  await page.waitForTimeout(400); // let the greeting name settle (no [Name] flash)
  await shot(page, "desktop-empty.png");

  // ── 3. mobile-empty: /home at phone, sidebar as a closed drawer ───────────
  await page.setViewportSize(MOBILE);
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[data-testid="composer"]')).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "mobile-empty.png");

  // ── active shots (2 & 4): require a completed Simulation id ───────────────
  if (!ACTIVE_ID) {
    console.warn(
      "\n[UAT] UAT_ACTIVE_ANALYSIS_ID is unset — SKIPPING desktop-active + mobile-active.\n" +
        "      Run one Simulation through the composer (or seed a completed analysis_results\n" +
        "      row owned by E2E_USER), then re-run with UAT_ACTIVE_ANALYSIS_ID=<id>.\n",
    );
    return;
  }

  // ── 2. desktop-active: /analyze/[id] at desktop, composer bottom-pinned ────
  await page.setViewportSize(DESKTOP);
  await page.goto(`/analyze/${ACTIVE_ID}`);
  await page.waitForLoadState("networkidle");
  // composer should be present and pinned (data-layout reflects the route id)
  const composerDesktop = page.locator('[data-testid="composer"]');
  await expect(composerDesktop).toBeVisible();
  await expect(composerDesktop).toHaveAttribute("data-layout", /pinned|active/);
  await page.waitForTimeout(600);
  await shot(page, "desktop-active.png");

  // ── 4. mobile-active: /analyze/[id] at phone, bottom-pinned composer ───────
  await page.setViewportSize(MOBILE);
  await page.goto(`/analyze/${ACTIVE_ID}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[data-testid="composer"]')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, "mobile-active.png");
});
