#!/usr/bin/env node
/* node scripts/next-look-thread-check.cjs <baseUrl> <cookie.json>
 *
 * Flag-on check that cannot be done from a single page load. The phone has no bottom tab bar on any
 * screen. A chat not opened from Library shows the drawer's menu in its band, not Back; a chat opened
 * from Library shows Back, and Back returns to Library. Needs the account to have at least one
 * titled thread. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");

const [base, cookieFile] = process.argv.slice(2);
if (!base || !cookieFile) {
  console.error("usage: next-look-thread-check.cjs <baseUrl> <cookie.json>");
  process.exit(2);
}

const shown = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
  }, sel);

(async () => {
  const host = new URL(base).hostname;
  const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf8")).map((c) => ({ ...c, domain: host, path: "/" }));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const failures = [];
  const expect = (label, actual, wanted) => {
    console.log(`${actual === wanted ? "ok  " : "FAIL"} ${label}: ${actual}`);
    if (actual !== wanted) failures.push(label);
  };

  // Desktop: open the first titled thread from "Recent".
  await page.goto(`${base}/library`, { waitUntil: "domcontentloaded" });
  const first = page.locator('nav[aria-label="App navigation"] ul li button[aria-current], nav[aria-label="App navigation"] ul li button').first();
  await first.waitFor({ timeout: 60_000 });
  await first.click();
  await page.waitForURL(/\/home$/, { timeout: 30_000 });
  await page.waitForTimeout(4000);

  // Phone: the same session now lands in that thread.
  await page.setViewportSize({ width: 393, height: 852 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 60_000 });
  await page.waitForTimeout(4000);
  // Not opened from Library (the sidebar's Recent, then a reload): the band shows the menu, not Back.
  expect("in a thread: no Places navigation", await shown(page, 'nav[aria-label="Places"]'), false);
  expect("in a thread: the menu shown", await shown(page, 'button[aria-label="Open menu"]'), true);
  expect("in a thread: Back gone", await shown(page, 'button[aria-label="Back"]'), false);
  await page.screenshot({ path: ".scratch/next-look/final-thread-phone.png", animations: "disabled", caret: "hide", timeout: 20_000 }).catch(() => {});

  // Phone: a chat opened from Library has Back, and Back returns to Library.
  await page.goto(`${base}/library`, { waitUntil: "domcontentloaded" });
  const row = page.locator('main ul[aria-label="Chats"]:not([aria-busy]) > li > button').first();
  await row.waitFor({ timeout: 60_000 });
  expect("library: no Places navigation", await shown(page, 'nav[aria-label="Places"]'), false);
  await row.click();
  await page.waitForURL(/\/home$/, { timeout: 30_000 });
  await page.waitForTimeout(4000);
  expect("chat from Library: no Places navigation", await shown(page, 'nav[aria-label="Places"]'), false);
  expect("chat from Library: Back shown", await shown(page, 'button[aria-label="Back"]'), true);
  await page.click('button[aria-label="Back"]');
  await page.waitForURL(/\/library(\?|$)/, { timeout: 30_000 });
  await page.waitForTimeout(2500);
  expect("after Back: the page is Library", new URL(page.url()).pathname, "/library");
  expect("after Back: no Places navigation", await shown(page, 'nav[aria-label="Places"]'), false);
  expect("after Back: Back gone", await shown(page, 'button[aria-label="Back"]'), false);

  // A screen outside the places: Back goes back to where it was opened (here Library).
  await page.goto(`${base}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  expect("settings: no Places navigation", await shown(page, 'nav[aria-label="Places"]'), false);
  await page.click('button[aria-label="Back"]');
  await page.waitForURL(/\/library(\?|$)/, { timeout: 30_000 });
  expect("settings: Back goes back to where it was opened", new URL(page.url()).pathname, "/library");

  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
