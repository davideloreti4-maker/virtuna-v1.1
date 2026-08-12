/**
 * B1, the DISCRIMINATING test.
 *
 * The first run's payload (platform:"tiktok", intent:"grow") proved nothing:
 * goalIntentToLens(null) === "grow" and the body default platform is "tiktok",
 * so a General audience produces exactly those values by default. To prove the
 * chip BINDS, switch to an audience whose goal_intent is "sell" and see whether
 * the payload flips. If it stays "grow", the chip is decoration like the model
 * selector. One cheap Flash hooks run.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const B = "http://localhost:3040";
const OUT = "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const calls = [];
page.on("request", (req) => {
  const u = req.url();
  if (!u.includes("/api/") || req.method() === "GET") return;
  let b = null; try { b = req.postData(); } catch {}
  calls.push({ url: u.replace(B, ""), body: b });
  console.log(`  → ${req.method()} ${u.replace(B, "")}  ${(b || "").slice(0, 250)}`);
});

await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
await page.locator('button:has-text("New Thread")').first().click().catch(() => {});
await page.waitForTimeout(3500);

// ── open the audience chip and pick the Conversion Audience (goal_intent=sell) ─
console.log("=== switching audience ===");
const chipSel = ['button[aria-label*="udience" i]', 'button:has-text("General")', '[data-audience-chip] button'];
let opened = false;
for (const s of chipSel) {
  const el = page.locator(s).last();
  if (await el.count().catch(() => 0)) {
    console.log(`  chip candidate "${s}" text="${(await el.textContent().catch(()=>''))?.trim().slice(0,40)}"`);
    await el.click().catch(() => {});
    await page.waitForTimeout(1500);
    const conv = page.locator('text=/Conversion Audience/i').first();
    if (await conv.count().catch(() => 0)) { await conv.click().catch(() => {}); opened = true; await page.waitForTimeout(2500); break; }
    await page.keyboard.press("Escape").catch(() => {});
  }
}
console.log(`  audience switched: ${opened}`);

// ── arm hooks + fire ─────────────────────────────────────────────────────────
const pill = page.locator('button[aria-label^="Skill:"]').first();
await pill.click().catch(() => {});
await page.waitForTimeout(1000);
await page.locator('button:has-text("Hooks")').first().click().catch(() => {});
await page.waitForTimeout(1500);

const ta = page.locator("textarea").first();
await ta.click().catch(() => {});
await ta.fill("hooks about a paid course launch").catch(() => {});
await page.waitForTimeout(600);
console.log("\n=== firing ===");
await page.locator('button[aria-label="Generate hooks"]').first().click().catch(() => {});
await page.waitForTimeout(40000);

fs.writeFileSync(`${OUT}/actb-bind.json`, JSON.stringify(calls, null, 2));
console.log("\n=== tool payloads ===");
calls.filter((c) => c.url.includes("/tools/")).forEach((c) => console.log(`${c.url}\n${c.body}`));
await browser.close();
