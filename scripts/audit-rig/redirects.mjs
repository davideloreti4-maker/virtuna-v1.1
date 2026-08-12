/**
 * F-013 instrument #1 — where does each candidate route actually LAND?
 * Not a grep, not an href crawl: drive the real logged-in browser to each URL
 * and read the resulting pathname. A redirect stub and an orphaned page are
 * indistinguishable in source until you follow them.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const B = "http://localhost:3040";
const ROUTES = [
  "/discover", "/feed", "/feed/hooks", "/feed/channels",
  "/library", "/saved", "/calendar",
  "/competitors", "/competitors/compare", "/competitors/mrbeast",
  "/analytics", "/grow", "/grow?tab=referrals", "/referrals",
  "/analyze", "/dev/cards", "/ambient-v2", "/start", "/dashboard",
];

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const rows = [];
for (const r of ROUTES) {
  let status = "?";
  const resp = await page.goto(B + r, { waitUntil: "domcontentloaded" }).catch((e) => {
    status = "ERR " + e.message.slice(0, 40);
    return null;
  });
  if (resp) status = resp.status();
  await page.waitForTimeout(1200);
  const landed = page.url().replace(B, "");
  // Did anything actually render, or is it a blank/error shell?
  const body = await page
    .evaluate(() => ({
      h1: (document.querySelector("h1,h2")?.textContent || "").trim().slice(0, 40),
      chars: (document.body.innerText || "").replace(/\s+/g, " ").trim().length,
      err: /Unhandled Runtime|Application error|404|This page could not be found/i.test(
        document.body.innerText || ""
      ),
    }))
    .catch(() => ({ h1: "", chars: 0, err: true }));
  rows.push({ route: r, status, landed, redirected: landed.split("?")[0] !== r.split("?")[0], ...body });
  console.log(
    `${r.padEnd(24)} ${String(status).padEnd(4)} -> ${landed.padEnd(30)} ${
      body.err ? "ERROR" : body.chars + "ch"
    } ${body.h1}`
  );
}

fs.writeFileSync(
  "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots/redirects.json",
  JSON.stringify(rows, null, 2)
);
await browser.close();
