/**
 * Station driver — connects to the SHARED audit browser over CDP and captures
 * one station. Uses the owner's already-logged-in session, so nothing is mocked.
 *
 *   node station.mjs <slug> [path] [--w 1440] [--h 900] [--wait 2500]
 *
 * `browser_take_screenshot` and Playwright's default screenshot path both hang on
 * this app: the ambient-room animations never settle, so the font/stability wait
 * never resolves. So: inject a stylesheet that freezes every animation and
 * transition, hide the caret, then shoot with `animations: 'disabled'`.
 */
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const SHOTS =
  "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(argv[i + 1]);
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const slug = positional[0] ?? "station";
const target = positional[1] ?? null;
const W = flag("w", 1440);
const H = flag("h", 900);
const WAIT = flag("wait", 2500);

const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = ctx.pages()[0];

await page.setViewportSize({ width: W, height: H });

if (target) {
  const url = target.startsWith("http") ? target : `http://localhost:3040${target}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
await page.waitForTimeout(WAIT);

// Only kill the caret. Do NOT inject `animation:none` — that RESETS entrance
// animations to their opacity:0 start state and shoots an empty page (burned one
// round on /audience). Playwright's own `animations:'disabled'` fast-forwards
// animations to their END state, which is what we actually want.
await page.addStyleTag({ content: `*{caret-color:transparent!important}` });

const shot = `${SHOTS}/${slug}.png`;
await page.screenshot({ path: shot, animations: "disabled", caret: "hide", scale: "css" });

// Measured facts, not impressions.
const facts = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const seen = new Set();
  const text = [];
  for (const el of document.querySelectorAll("h1,h2,h3,button,a,[data-testid]")) {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70);
    const key = `${el.tagName}:${el.getAttribute("data-testid") || ""}:${t}`;
    if (!t && !el.getAttribute("data-testid")) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    text.push({
      tag: el.tagName.toLowerCase(),
      testid: el.getAttribute("data-testid") || undefined,
      text: t || undefined,
      disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true" || undefined,
    });
  }
  return {
    url: location.pathname + location.search,
    title: document.title,
    accent: cs.getPropertyValue("--color-accent").trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    elements: text.slice(0, 120),
  };
});

fs.writeFileSync(`${SHOTS}/${slug}.json`, JSON.stringify(facts, null, 2));
console.log(JSON.stringify({ shot, ...facts, elements: `${facts.elements.length} captured` }, null, 2));
await browser.close();
