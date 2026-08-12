/**
 * Act E — mobile pass at 390×844. Read-only; no runs.
 *
 *   node acte.mjs
 *
 * e1 first paint + overflow · e2 sidebar/drawer · e3 thread readability ·
 * e4 skill menu reachability · e5 the account menu s2 could not open
 * (five selectors failed — decide: product bug or instrument error).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const B = "http://localhost:3040";
const SHOTS = "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots";
const out = { steps: [] };

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 390, height: 844 });

const snap = async (slug) => {
  await page.addStyleTag({ content: `*{caret-color:transparent!important}` }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/${slug}.png`, animations: "disabled", caret: "hide", scale: "css" }).catch(() => {});
};
const facts = () =>
  page.evaluate(() => ({
    url: location.pathname,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    visibleButtons: [...document.querySelectorAll("button")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height; })
      .map((el) => ({ label: el.getAttribute("aria-label"), t: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30) }))
      .slice(0, 25),
  }));

// e1 — first paint
await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
out.steps.push({ step: "e1-first-paint", ...(await facts()) });
await snap("e1-mobile-home");

// e2 — sidebar / drawer: find the nav trigger
const navOpened = await page.evaluate(() => {
  const cands = [...document.querySelectorAll("button")].filter((el) => {
    const a = (el.getAttribute("aria-label") || "").toLowerCase();
    const r = el.getBoundingClientRect();
    return r.width && r.height && /menu|sidebar|nav|thread/.test(a);
  });
  if (!cands.length) return null;
  cands[0].click();
  return cands[0].getAttribute("aria-label");
});
await page.waitForTimeout(2000);
out.steps.push({ step: "e2-drawer", navOpened, ...(await facts()) });
await snap("e2-mobile-drawer");

// e3 — open the script thread from whatever list is visible
const opened = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("button")];
  const hit = rows.find((el) => (el.textContent || "").trim().startsWith("a 30 second script"));
  if (!hit) return null;
  hit.click();
  return true;
});
await page.waitForTimeout(6000);
out.steps.push({ step: "e3-thread", opened, ...(await facts()) });
await snap("e3-mobile-script-thread");

// e4 — the skill pill + menu on mobile
const pill = page.locator('button[aria-label^="Skill:"]').first();
const pillVisible = await pill.isVisible().catch(() => false);
if (pillVisible) {
  await pill.click().catch(() => {});
  await page.waitForTimeout(1500);
}
out.steps.push({ step: "e4-skill-menu", pillVisible, ...(await facts()) });
await snap("e4-mobile-skill-menu");
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(800);

// e5 — the account menu. Dump every candidate first, then click the best one.
const e5probe = await page.evaluate(() => {
  const els = [...document.querySelectorAll("button,[role=button]")].filter((el) => {
    const r = el.getBoundingClientRect();
    const t = (el.textContent || "") + (el.getAttribute("aria-label") || "");
    return r.width && r.height && /E2E|account|user|avatar|profile/i.test(t);
  });
  return els.map((el) => ({
    label: el.getAttribute("aria-label"),
    t: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
    rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
  }));
});
out.steps.push({ step: "e5-account-candidates", candidates: e5probe });
// click the E2E Test User row if present
const acct = page.locator('button:has-text("E2E Test User")').first();
if (await acct.count()) {
  await acct.click().catch(() => {});
  await page.waitForTimeout(2000);
  const menu = await page.evaluate(() => {
    const m = document.querySelector('[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper]');
    return m ? (m.textContent || "").trim().replace(/\s+/g, " ").slice(0, 250) : null;
  });
  out.steps.push({ step: "e5-account-menu", menu, ...(await facts()) });
  await snap("e5-mobile-account-menu");
}

console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(`${SHOTS}/acte.json`, JSON.stringify(out, null, 2));
await browser.close();
