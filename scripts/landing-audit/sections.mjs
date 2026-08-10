/**
 * Per-section screenshots of the /trial landing page.
 *
 * A 10k-px full-page shot squeezes every section into unreadability; auditing
 * needs each one at natural scale. Shoots every `main > section` plus the
 * footer as its own clipped image.
 *
 *   node scripts/landing-audit/sections.mjs [url] [outDir] [WxH]
 * Defaults: http://localhost:3007/trial ./sections 1440x900
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [, , url = "http://localhost:3007/trial", outDir = "./sections", vpArg = "1440x900"] =
  process.argv;
const [w, h] = vpArg.split("x").map(Number);

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
  isMobile: w < 500,
  hasTouch: w < 500,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
await page.addStyleTag({
  content: `nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}`,
});
await page.evaluate(() => document.fonts.ready);

// Release every reveal before shooting.
await page.evaluate(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(400);

const sections = await page.$$eval("main > section, footer", (els) =>
  els.map((el, i) => ({
    i,
    id: el.id || el.tagName.toLowerCase() + "-" + i,
    top: el.getBoundingClientRect().top + window.scrollY,
    height: el.getBoundingClientRect().height,
  })),
);

for (const s of sections) {
  await page.evaluate((top) => window.scrollTo(0, Math.max(0, top - 40)), s.top);
  await page.waitForTimeout(180);
  await page.screenshot({
    path: `${outDir}/${String(s.i).padStart(2, "0")}-${s.id}.png`,
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    clip: {
      x: 0,
      y: Math.max(0, s.top - 40),
      width: w,
      height: Math.min(s.height + 80, 4000),
    },
  });
  console.log(`${String(s.i).padStart(2, "0")}-${s.id}  h=${Math.round(s.height)}`);
}

await browser.close();
console.log("done →", outDir);
