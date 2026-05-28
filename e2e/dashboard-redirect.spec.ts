import { test, expect } from '@playwright/test';

/**
 * Phase 2 D-25 — /dashboard sunset redirect tests.
 *
 * Middleware fires the /dashboard → /analyze redirect BEFORE the auth check,
 * so the redirect is issued regardless of auth state.
 *
 * Test 1: GET /dashboard while logged out → ends at /login (redirect chain: /dashboard → /analyze → /login)
 * Test 2: GET /dashboard/foo while logged out → ends at /login (subpath also redirects)
 * Test 3: GET /dashboard/foo while logged out → final URL never contains /dashboard
 */

test.describe('Phase 2 D-25 — /dashboard sunset', () => {
  test('GET /dashboard redirects away from /dashboard (unauthenticated)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await page.goto('/dashboard');

    // After full redirect chain: /dashboard → /analyze → /login?next=/analyze
    // The final URL must NOT be /dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);
    // Should end at /login (auth gate) since /analyze is protected
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  test('GET /dashboard/foo redirects to /analyze (subpath drops, unauthenticated)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await page.goto('/dashboard/foo');
    // Must not stay on /dashboard/foo
    await expect(page).not.toHaveURL(/\/dashboard/);
    // Should reach /login since /analyze is protected
    await expect(page).toHaveURL(/\/(login|analyze)(\?|$|\/)/);

    await ctx.close();
  });

  test('unauthenticated GET /dashboard ultimately redirects to /login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await page.goto('/dashboard');
    // Redirect chain: /dashboard → /analyze → /login?next=/analyze
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });
});
