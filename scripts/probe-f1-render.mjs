/**
 * probe-f1-render.mjs — render an EXISTING F-1 pair on a prod build and measure what is on screen.
 *
 * Free: reads one already-persisted thread. No model call, no Apify, no write.
 *
 * The claim under test is a RENDERING one — "the pack renders twice" — so it has to be read off the
 * DOM, not the wire. Uses textContent (innerText is layout-aware and has reported a fully-mounted
 * surface as empty here) and disables animations (the ambient room never settles otherwise).
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3016";
const THREAD = process.argv[3];
if (!THREAD) throw new Error("usage: node probe-f1-render.mjs <base> <threadId> [out.png]");

const state = JSON.parse(readFileSync(".scratch/auth-state.json", "utf8"));

const browser = await chromium.launch();
// Native desktop context — resizing a loaded page does not give you the real UI.
const ctx = await browser.newContext({
  storageState: state,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
await ctx.addCookies([{ name: "maven_active_thread", value: THREAD, url: BASE }]);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

const measured = await page.evaluate(() => {
  const txt = (el) => (el?.textContent ?? "").trim();
  const main = document.querySelector("main");
  const blocks = [...document.querySelectorAll("[data-block-type]")];
  const proseNodes = [...document.querySelectorAll(".md")]
    .map((n) => txt(n))
    .filter((t) => t.length > 40)
    .sort((a, b) => b.length - a.length);
  return {
    url: location.href,
    mainChars: txt(main).length,
    blockTypes: blocks.map((b) => b.getAttribute("data-block-type")),
    proseCount: proseNodes.length,
    proseLengths: proseNodes.map((p) => p.length),
    longestProseHead: (proseNodes[0] ?? "").slice(0, 240),
  };
});

console.log(JSON.stringify({ measured, errors: errors.slice(0, 5) }, null, 2));

// `main` is the scroller here, not the body — a fullPage shot stops at the fold and reports the
// content below it as absent. Walk it instead, one viewport at a time.
// Do NOT assume `main` scrolls: scrollHeight === clientHeight is not proof of "no overflow", an
// ancestor may be clipping. Find the element that actually overflows, and scroll THAT.
const shots = await page.evaluate(() => {
  const all = [...document.querySelectorAll("body *")];
  const scrollers = all
    .filter((e) => e.scrollHeight - e.clientHeight > 80)
    .map((e) => ({
      tag: e.tagName.toLowerCase(),
      cls: (e.className?.toString?.() ?? "").slice(0, 60),
      scrollHeight: e.scrollHeight,
      clientHeight: e.clientHeight,
    }))
    .sort((a, b) => b.scrollHeight - a.scrollHeight);
  // Tag the winner so the outer scope can address it without re-querying.
  const winner = all
    .filter((e) => e.scrollHeight - e.clientHeight > 80)
    .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  if (winner) winner.setAttribute("data-probe-scroller", "1");
  return { scrollers: scrollers.slice(0, 4), ...(winner ? { scrollHeight: winner.scrollHeight, clientHeight: winner.clientHeight } : {}) };
});
console.log("real scroller:", JSON.stringify(shots, null, 2));

const out = process.argv[4] ?? ".scratch/f1-render.png";
let i = 0;
for (let y = 0; y < (shots?.scrollHeight ?? 0); y += (shots?.clientHeight ?? 900) - 60) {
  await page.evaluate((top) => {
    const el = document.querySelector("[data-probe-scroller]");
    if (el) el.scrollTop = top;
  }, y);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: out.replace(/\.png$/, `-${i++}.png`),
    animations: "disabled",
    caret: "hide",
  });
  if (i > 6) break;
}

await browser.close();
