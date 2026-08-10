/**
 * probe-thread-mobile.mjs — measure the in-thread chat in a NATIVE mobile context.
 *
 * Written for the 2026-08-09 in-thread chat audit (docs/HANDOFF-2026-08-09-in-thread-chat-audit.md).
 *
 * WHY A SCRIPT AND NOT A RESIZE: resizing a loaded page does not give you the mobile UI — the app
 * decides its layout on mount. One browser context per viewport, opened AT that size. Raw Playwright
 * rather than the MCP screenshot tool because this app's ambient animations never settle
 * (`animations: 'disabled'` + `caret: 'hide'` are load-bearing here).
 *
 * WHAT IT MEASURES, and why each one caught something:
 *  - composer rect before/after typing → the composer is a fixed 48px and CLIPS your own text (F-16)
 *  - `aside` rect                      → the DESKTOP rail is 0×0 on mobile. ⚠️ Says NOTHING about the
 *                                        mobile audience sheet (strip-tap opens it) — see F-17 correction.
 *  - sub-40px interactive elements     → 84 of them; thread-row actions are 22×22 (F-19)
 *  - documentElement horizontal overflow → the honest overflow check; per-element right>innerWidth
 *    reports 200+ FALSE POSITIVES because the off-canvas drawer legitimately sits at x=-220.
 *
 * Prereqs: a dev server, and e2e/auth/state.json (see the handoff §0 — this worktree's .env.local
 * does not carry E2E_USER_*, pass them inline to the setup project).
 *
 *   node scripts/probe-thread-mobile.mjs [--base http://localhost:3005] [--device "iPhone 14 Pro"]
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASE = arg('--base', 'http://localhost:3005');
const DEVICE = arg('--device', 'iPhone 14 Pro');
const ROOT = process.cwd();
const OUT = path.join(ROOT, '.playwright-mcp/shots');
const STATE = path.join(ROOT, 'e2e/auth/state.json');
const REGION = '[data-testid="composer-thread-region"]';

if (!fs.existsSync(STATE)) {
  console.error(`No auth state at ${STATE}. See docs/HANDOFF-2026-08-09-in-thread-chat-audit.md §0.`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

/** Runs in the page. Returns the geometry + a11y numbers the audit is built on. */
const MEASURE = (label) => {
  const q = (s) => document.querySelector(s);
  const rd = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const de = document.documentElement;

  // Per-element overflow. Reported RAW: the off-canvas drawer makes this noisy on purpose, so the
  // real signal is `docOverflowX`, not `overflowCount`.
  const overflowers = [];
  document.querySelectorAll('*').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width > 0 && (b.right > innerWidth + 1 || b.left < -1)) {
      overflowers.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 70),
        l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top),
      });
    }
  });

  const small = [];
  document.querySelectorAll('button, a, [role="button"]').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    if (b.height < 40 || b.width < 40) {
      small.push({
        name: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        w: Math.round(b.width), h: Math.round(b.height),
      });
    }
  });

  const region = q(REGION_SEL);
  return {
    label,
    vw: innerWidth, vh: innerHeight,
    docOverflowX: de.scrollWidth > de.clientWidth ? de.scrollWidth - de.clientWidth : 0,
    nav: rd(q('nav')), main: rd(q('main')), aside: rd(q('aside')), region: rd(region),
    regionScroll: region ? { client: region.clientHeight, scroll: region.scrollHeight } : null,
    composer: rd(q('textarea') || q('[role="textbox"]')),
    overflowCount: overflowers.length, overflowers: overflowers.slice(0, 10),
    smallCount: small.length, smallTargets: small.slice(0, 25),
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices[DEVICE], storageState: STATE });
const page = await ctx.newPage();
await page.addInitScript((sel) => { window.REGION_SEL = sel; }, REGION);

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));

// NEVER `networkidle` on this app — the dev HMR socket keeps the page permanently busy.
await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/m01-home.png`, animations: 'disabled', caret: 'hide' });
const home = await page.evaluate(MEASURE, 'home');

// Drawer + a persisted thread.
const opener = page.locator('[aria-label*="sidebar" i], [aria-label*="menu" i]').first();
if (await opener.count()) { await opener.click(); await page.waitForTimeout(1500); }
await page.screenshot({ path: `${OUT}/m02-sidebar.png`, animations: 'disabled', caret: 'hide' });
const row = page.locator('nav button').filter({ hasText: /hooks/i }).first();
if (await row.count()) { await row.click(); await page.waitForTimeout(7000); }
await page.screenshot({ path: `${OUT}/m03-thread.png`, animations: 'disabled', caret: 'hide' });
const thread = await page.evaluate(MEASURE, 'thread');

// Scroll the thread container (the PAGE does not scroll — the region does).
const slices = [];
if (await page.locator(REGION).count()) {
  const sh = await page.evaluate((s) => document.querySelector(s).scrollHeight, REGION);
  for (let y = 0, i = 0; y < Math.min(sh, 4200); y += 700, i++) {
    await page.evaluate(([s, t]) => { document.querySelector(s).scrollTop = t; }, [REGION, y]);
    await page.waitForTimeout(500);
    const p = `${OUT}/m04-thread-${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: p, animations: 'disabled', caret: 'hide' });
    slices.push(p);
  }
}

// F-16: does the composer grow, or does it clip your own text?
const box = page.locator('textarea, [role="textbox"]').first();
await box.click();
await page.keyboard.type(
  'testing the composer on mobile with a longer message to see how it grows when the text wraps onto several lines and keeps going',
);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/m05-composer-typed.png`, animations: 'disabled', caret: 'hide' });
const typed = await page.evaluate(MEASURE, 'composer-typed');

const report = { device: DEVICE, base: BASE, home, thread, typed, slices, errors };
const dest = path.join(OUT, 'mobile-report.json');
fs.writeFileSync(dest, JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  device: DEVICE,
  viewport: `${home.vw}x${home.vh}`,
  docOverflowX: home.docOverflowX,
  // NOTE: `aside` is the DESKTOP rail element — 0×0 here proves nothing about the mobile
  // audience sheet (which opens via the composer strip). Kept as desktopAsideHidden so it
  // can't be read as "no mobile ranked view" again (that misread produced audit F-17).
  desktopAsideHidden: thread.aside?.w === 0,
  composerBefore: thread.composer,
  composerAfterTyping: typed.composer,
  composerGrew: thread.composer?.h !== typed.composer?.h,
  smallTargets: home.smallCount,
  consoleErrors: errors.length,
  report: dest,
}, null, 2));

await browser.close();
