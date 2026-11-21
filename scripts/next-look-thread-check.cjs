#!/usr/bin/env node
/* node scripts/next-look-thread-check.cjs <baseUrl> <cookie.json>
 *
 * Flag-on check that cannot be done from a single page load: opening a thread hides the phone
 * tab bar and shows Back; Back returns to the blank Home and the bar. Needs the account to have
 * at least one titled thread. */
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
  expect("in a thread: tab bar hidden", await shown(page, 'nav[aria-label="Places"]'), false);
  expect("in a thread: Back shown", await shown(page, 'button[aria-label="Back"]'), true);
  await page.screenshot({ path: ".scratch/next-look/final-thread-phone.png", animations: "disabled", caret: "hide", timeout: 20_000 }).catch(() => {});

  await page.click('button[aria-label="Back"]');
  await page.waitForTimeout(2500);
  expect("after Back: tab bar shown", await shown(page, 'nav[aria-label="Places"]'), true);
  expect("after Back: Back gone", await shown(page, 'button[aria-label="Back"]'), false);

  // A screen outside the places: Back leads Home.
  await page.goto(`${base}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  expect("settings: tab bar hidden", await shown(page, 'nav[aria-label="Places"]'), false);
  await page.click('button[aria-label="Back"]');
  await page.waitForURL(/\/home$/, { timeout: 30_000 });
  expect("settings: Back leads Home", new URL(page.url()).pathname, "/home");

  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
