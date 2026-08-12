/**
 * C4 re-run. The first remix run hit decode_failed, returned 200, and persisted
 * no assistant turn — but the dev server died seconds later, so the "UI showed
 * nothing" half was unverifiable. And the designed copy is "Couldn't READ that
 * video", which my degraded-detector's alternation did not cover.
 *
 * So: run it again and capture the composer thread's VISIBLE TEXT verbatim.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");
const B = "http://localhost:3040";
const SHOTS = "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const responses = [];
page.on("response", (r) => { if (r.url().includes("/api/tools/")) responses.push(`${r.status()} ${r.url().replace(B, "")}`); });

await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5500);
await page.locator('button:has-text("New Thread")').first().click().catch(() => {});
await page.waitForTimeout(3500);
await page.locator('button[aria-label^="Skill:"]').first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const r = [...document.querySelectorAll('button,[role="menuitem"],[role="option"]')].find((el) => (el.textContent || "").includes("Decode a winner"));
  r && r.click();
});
await page.waitForTimeout(1800);
await page.locator("textarea").first().fill("https://www.tiktok.com/@mrbeast/video/7606031409408478495");
await page.waitForTimeout(800);

const label = await page.evaluate(() => {
  const pill = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") || "").startsWith("Skill:"));
  let box = pill; for (let i = 0; i < 6 && box.parentElement; i++) box = box.parentElement;
  const s = [...box.querySelectorAll("button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (e.textContent || "").trim() !== "⚙"; }).sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];
  s.setAttribute("data-audit-send", "1");
  return s.getAttribute("aria-label") + (s.hasAttribute("disabled") ? "[DIS]" : "");
});
console.log("send:", label);
await page.locator('[data-audit-send="1"]').click().catch(() => {});

// poll the visible thread text so a TRANSIENT error line isn't missed
const seen = [];
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(5000);
  const t = await page.evaluate(() => {
    const m = document.querySelector("main") || document.body;
    return (m.innerText || "").replace(/\s+/g, " ").trim();
  }).catch(() => "(page gone)");
  const tail = t.slice(-260);
  if (!seen.length || seen[seen.length - 1] !== tail) { seen.push(tail); console.log(`t+${(i + 1) * 5}s: ${tail}`); }
  if (/Couldn't|could not|Try a different|went wrong/i.test(t)) { console.log("  ** ERROR COPY RENDERED **"); break; }
}
console.log("\nresponses:", responses.join(" | "));
await page.screenshot({ path: `${SHOTS}/c-remix2.png`, animations: "disabled", caret: "hide", scale: "css" }).catch(() => {});
fs.writeFileSync(`${SHOTS}/c-remix2.json`, JSON.stringify({ responses, seen }, null, 2));
await browser.close();
