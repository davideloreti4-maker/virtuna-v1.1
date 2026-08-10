/**
 * Full-page + fold screenshot harness for the /trial landing page.
 *
 * Run from a repo checkout that has `playwright` installed (any worktree):
 *   node scripts/landing-audit/shoot.mjs [url] [outDir] [viewport ...]
 * Defaults: http://localhost:3007/trial ./shots — viewports: desktop laptop tablet phone
 *
 * Encodes this repo's hard-won screenshot rules:
 *  1. ONE BROWSER CONTEXT PER VIEWPORT — resizing a loaded page does not give
 *     you the mobile UI; each viewport opens fresh at its size.
 *  2. reducedMotion: 'reduce' — the page's reveals otherwise screenshot at
 *     opacity 0. The landing's CSS snaps to the finished state under it.
 *  3. The Next.js dev badge is hidden — it reads as a UI bug in audits.
 *  4. Believe the OVERFLOW PROBE, not the image: an ancestor can clip instead
 *     of scrolling, so `scrollWidth === clientWidth` proves nothing.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [, , url = "http://localhost:3007/trial", outDir = "./shots", ...only] = process.argv;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1512, height: 860 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone", width: 390, height: 844 },
];

const targets = only.length ? VIEWPORTS.filter((v) => only.includes(v.name)) : VIEWPORTS;
const HIDE_DEV_BADGE = `nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}`;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

for (const vp of targets) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    isMobile: vp.name === "phone",
    hasTouch: vp.name === "phone",
  });
  const page = await context.newPage();

  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.addStyleTag({ content: HIDE_DEV_BADGE }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  await page.screenshot({
    path: `${outDir}/${vp.name}-fold.png`,
    animations: "disabled",
    caret: "hide",
  });

  // Scroll through so every IntersectionObserver fires, then shoot full page.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: `${outDir}/${vp.name}-full.png`,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });

  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
        bad.push(
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(r.left)}…${Math.round(r.right)} (vw ${vw})`,
        );
      }
    }
    return {
      docScrollW: document.documentElement.scrollWidth,
      viewportW: vw,
      offenders: bad.slice(0, 8),
      pageHeight: document.body.scrollHeight,
    };
  });

  console.log(
    `\n[${vp.name} ${vp.width}×${vp.height}] height=${overflow.pageHeight}px  scrollW=${overflow.docScrollW} vw=${overflow.viewportW}`,
  );
  if (overflow.offenders.length) {
    console.log("  OVERFLOW:");
    overflow.offenders.forEach((o) => console.log("   ·", o));
  }
  if (errors.length) {
    console.log("  CONSOLE ERRORS:");
    errors.slice(0, 6).forEach((e) => console.log("   ·", e));
  }

  await context.close();
}

await browser.close();
console.log("\ndone →", outDir);
