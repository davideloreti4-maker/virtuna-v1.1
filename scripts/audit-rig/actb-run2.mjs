/**
 * Act B / B3+B4, take 2. Take 1 missed because a fresh thread arms "Chat",
 * not "Hooks", so the send button reads "Send message" and no run fired.
 * Also: clicking "SIM-1 Max" left the selector on Flash — is Max DISABLED,
 * or did the click miss? Dump the option elements' real state before deciding.
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
  let body = null;
  try { body = req.postData(); } catch {}
  calls.push({ method: req.method(), url: u.replace(B, ""), body });
  console.log(`  → ${req.method()} ${u.replace(B, "")}  ${(body || "(no body)").slice(0, 300)}`);
});

await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const nt = page.locator('button:has-text("New Thread")').first();
if (await nt.count()) { await nt.click().catch(() => {}); await page.waitForTimeout(3500); }

// ── arm Hooks via the skill pill ─────────────────────────────────────────────
const pill = page.locator('button[aria-label^="Skill:"]').first();
console.log(`skill pill before: "${(await pill.textContent().catch(()=>''))?.trim()}"`);
await pill.click().catch(() => {});
await page.waitForTimeout(1000);
await page.locator('button:has-text("Hooks")').first().click().catch(() => {});
await page.waitForTimeout(1500);
console.log(`skill pill after:  "${(await pill.textContent().catch(()=>''))?.trim()}"`);

// ── the model selector: what is really offered, and is Max selectable? ───────
const model = page.locator('button[aria-label^="Model:"]').first();
const modelBefore = (await model.textContent().catch(() => ""))?.trim();
await model.click().catch(() => {});
await page.waitForTimeout(1200);
const optState = await page.evaluate(() =>
  [...document.querySelectorAll('button,[role="menuitem"],[role="option"]')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height && /SIM-1/.test(el.textContent || ""); })
    .map((el) => ({
      text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
      disabled: el.hasAttribute("disabled"),
      ariaDisabled: el.getAttribute("aria-disabled"),
      ariaSelected: el.getAttribute("aria-selected"),
      pointerEvents: getComputedStyle(el).pointerEvents,
      opacity: getComputedStyle(el).opacity,
    }))
);
console.log("\n=== model options, real state ===");
optState.forEach((o) => console.log("   ", JSON.stringify(o)));

const maxOpt = page.locator('button:has-text("SIM-1 Max")').first();
if (await maxOpt.count()) { await maxOpt.click({ force: true }).catch(() => {}); await page.waitForTimeout(1200); }
const modelAfter = (await model.textContent().catch(() => ""))?.trim();
console.log(`\nmodel: "${modelBefore}" -> "${modelAfter}"  (changed: ${modelBefore !== modelAfter})`);
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(500);

// ── fire ONE real hooks run ──────────────────────────────────────────────────
const ta = page.locator("textarea").first();
await ta.click().catch(() => {});
await ta.fill("hooks about shipping a side project before it is ready").catch(() => {});
await page.waitForTimeout(600);
const sendLabel = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((el) => /^(Generate|Send)/i.test(el.getAttribute("aria-label") || ""));
  return b ? b.getAttribute("aria-label") : null;
});
console.log(`\n=== firing: send button = "${sendLabel}" ===`);
await page.locator(`button[aria-label="${sendLabel}"]`).first().click().catch(() => {});
await page.waitForTimeout(45000);

fs.writeFileSync(`${OUT}/actb-run2.json`, JSON.stringify({ modelBefore, modelAfter, optState, calls }, null, 2));
console.log("\n=== tool POST bodies ===");
calls.filter((c) => c.url.includes("/tools/")).forEach((c) => console.log(`${c.url}\n${c.body}\n`));
await browser.close();
