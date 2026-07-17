/**
 * P4 live verification on :3002 (this worktree's dev server).
 * Pass 1 (UI, no spend): doors render, describe templates, deep-link param.
 * Pass 2 (REAL run): connect door @zachking → evidence reveal → done → detail page.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:3002";
const OUT = "/Users/davideloreti/virtuna-prod/.planning/sketches/p4-live";
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

const shot = (name) =>
  page.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled", caret: "hide" });

// ── Login ──
await page.goto(`${BASE}/login`);
await page.locator('input[name="email"]').fill("e2e-test@virtuna.local");
await page.locator('input[name="password"]').fill("e2e-test-password-2026");
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 30000 });
console.log("LOGIN OK →", page.url());

// ── Pass 1: doors ──
await page.goto(`${BASE}/audience/new`);
await page.waitForSelector('text=Connect account', { timeout: 20000 });
await page.waitForTimeout(600);
await shot("01-doors");
const doorLines = await Promise.all(
  ["Built from your own content.", "Any public creator.", "Define a target audience."].map((t) =>
    page.locator(`text=${t}`).count(),
  ),
);
console.log("DOORS:", doorLines.every((c) => c === 1) ? "all 3 render" : `MISSING ${doorLines}`);

// describe door + template
await page.locator("button", { hasText: "From a description" }).first().click();
await page.locator("button", { hasText: "Growth" }).click();
const taVal = await page.locator('textarea[aria-label="Describe the audience"]').inputValue();
console.log("TEMPLATE PREFILL:", taVal.slice(0, 40) + "…");
await shot("02-describe");

// deep-link door param
await page.goto(`${BASE}/audience/new?door=handle`);
await page.waitForSelector('text=From a handle', { timeout: 15000 });
const handleDoorOn = await page
  .locator('button[aria-pressed="true"]', { hasText: "From a handle" })
  .count();
console.log("DEEP-LINK ?door=handle:", handleDoorOn === 1 ? "preselected" : "NOT preselected");

// ── Pass 2: the REAL connect run ──
await page.goto(`${BASE}/audience/new`);
await page.waitForSelector('text=Connect account', { timeout: 20000 });
await page.locator('input[aria-label="Your @handle"]').fill("@zachking");
await page.locator("button", { hasText: /^Continue$/ }).click();
console.log("CALIBRATION STARTED", new Date().toISOString());

// evidence reveal (scrape returns in ~30-120s)
await page.waitForSelector('[data-testid="reveal-figures"]', { timeout: 240000 });
await page.waitForTimeout(800);
const figures = await page.locator('[data-testid="reveal-figures"]').innerText();
console.log("REVEAL FIGURES:", figures.replace(/\n/g, " | "));
const covers = await page.locator('[data-testid="reveal-cover"]').count();
const building = await page.locator('[data-testid="create-building"]').innerText();
console.log("COVERS:", covers, "| BUILDING LINE:", building);
await shot("03-reveal");

// done → detail page (enrichment ~1-2 min more)
await page.waitForURL((u) => /\/audience\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 300000 });
console.log("DONE →", page.url());
await page.waitForTimeout(2500);
await shot("04-detail");
const detailText = await page.locator("body").innerText();
console.log("DETAIL has SOURCE zone:", /SOURCE/i.test(detailText));
console.log("DETAIL has personas:", /personas/i.test(detailText));

console.log("CONSOLE ERRORS:", consoleErrors.length, consoleErrors.slice(0, 5));
await browser.close();
