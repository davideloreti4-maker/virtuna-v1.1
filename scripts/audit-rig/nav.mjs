/**
 * F-013 instrument #2 — the shipped navigation, from RENDERED clickables.
 * Anchors prove nothing here (nav is <button> + router.push), so collect every
 * button/role=button/menuitem actually in the DOM, at desktop AND mobile width,
 * including what the account menu reveals once opened.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const B = "http://localhost:3040";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];

// 1. /discover, given a real settle window — did it chain, or is it a live page?
await page.goto(B + "/discover", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
const discover = {
  landed: page.url().replace(B, ""),
  text: (await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim())).slice(0, 300),
};
console.log("=== /discover after 6s ===");
console.log(JSON.stringify(discover, null, 2));

// 2. The nav, as rendered.
const collect = () =>
  page.evaluate(() => {
    const nav = document.querySelector("aside, nav, [data-sidebar]");
    const scope = nav || document.body;
    const out = [];
    for (const el of scope.querySelectorAll('button,[role="button"],[role="menuitem"],a[href]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        href: el.getAttribute("href") || undefined,
        label:
          (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          "(icon)",
      });
    }
    return out;
  });

const report = {};
for (const [name, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  report[name] = { closed: await collect() };

  // Open every plausible menu trigger and re-collect.
  for (const sel of [
    '[data-account-menu] button',
    'button[aria-label*="ccount" i]',
    'button[aria-label*="enu" i]',
    'button[aria-label*="av" i]',
  ]) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1200);
      report[name][`open:${sel}`] = await collect();
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

for (const [view, sets] of Object.entries(report)) {
  console.log(`\n════════ ${view.toUpperCase()} ════════`);
  for (const [state, items] of Object.entries(sets)) {
    console.log(`  -- ${state} (${items.length}) --`);
    const seen = new Set();
    for (const i of items) {
      const k = i.label + (i.href || "");
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`     ${i.tag}${i.href ? ` href=${i.href}` : ""}  "${i.label}"`);
    }
  }
}

fs.writeFileSync(
  "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots/nav.json",
  JSON.stringify({ discover, report }, null, 2)
);
await browser.close();
