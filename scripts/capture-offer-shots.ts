/**
 * capture-offer-shots — photographs the offer page's product screenshots.
 *
 * The `/go` offer page shows REAL product pixels below the hero. Mounting those
 * app surfaces live on a cold paid-traffic page would cost JS + hydration on the
 * exact traffic we're optimizing, so instead `/dev-shots` (dev-only) mounts each
 * shipped surface at exact framing and this script photographs it.
 *
 * Recipe:
 *   1. start the dev server:  node --max-old-space-size=2048 \
 *        ./node_modules/next/dist/bin/next dev -p 3020
 *   2. npx tsx scripts/capture-offer-shots.ts
 *
 * Output: public/images/offer/<shot-id>.webp at deviceScaleFactor 2 (retina),
 * converted with `cwebp -q 88` (lossless-ish for flat UI, ~5× smaller than PNG).
 * Re-run it after any redesign of the composer / room / test card — the shots are
 * a snapshot, and this is the one command that refreshes them.
 *
 * Flags:
 *   --url=<base>     dev server origin (default http://localhost:3020)
 *   --only=<id,id>   capture a subset
 *   --keep-png       leave the intermediate PNGs on disk for inspection
 */

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const BASE = flag("url") ?? "http://localhost:3020";
const ONLY = flag("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const KEEP_PNG = args.includes("--keep-png");

const OUT_DIR = path.join(process.cwd(), "public/images/offer");

/** Each stage settles differently — the room auto-plays a neural read, the card
 *  animates its bars in. Give the slow ones time before the shutter. */
const SETTLE_MS: Record<string, number> = {
  "step-react": 4200,
  "step-react-sm": 4200,
  "step-verdict": 1600,
  "step-verdict-sm": 1600,
  "verdict-fixes": 1600,
  "verdict-fixes-sm": 1600,
  "step-paste": 800,
  "step-paste-sm": 800,
};

/**
 * Some stages need a click first to reach the state the section wants to show.
 * Text is matched inside the stage. Currently empty: the v2 read stage opens
 * directly on the audience tab via `initialTab` (the legacy room needed a
 * "The people" click; that surface is retired from the stages).
 */
const PREPARE: Record<string, string[]> = {};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // The room's brain is a three.js canvas, so headless Chromium MUST be able to
  // create a WebGL context — the default headless build refuses one and the brain
  // photographs as an empty box. SwiftShader renders it on the CPU instead.
  const browser = await chromium.launch({
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1200 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    // Capture the MOTION-ON look: these surfaces animate into their resting
    // state, and a reduced-motion context would freeze some of them mid-build.
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  const url = `${BASE}/dev-shots`;
  console.log(`→ ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

  // Next's dev overlay renders a fixed "N / n Issues" badge into a <nextjs-portal>
  // and WILL be baked into any element screenshot that overlaps it. Hide it (and
  // the scrollbar) before the shutter, or every shot ships a dev artifact.
  await page.addStyleTag({
    content: `nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}
              ::-webkit-scrollbar{width:0!important;height:0!important}`,
  });

  // Let every surface reach its resting state before any shutter fires.
  await page.waitForTimeout(Math.max(...Object.values(SETTLE_MS)));

  // Report the card's real height so `offsetY` in shot-stages.tsx can be derived
  // from geometry rather than guessed.
  for (const key of ["card", "card-sm"]) {
    const m = await page
      .locator(`[data-measure='${key}']`)
      .evaluate((el) => {
        const top = el.getBoundingClientRect().top;
        const fixes = [...el.querySelectorAll("p")].find((p) =>
          /the director/i.test(p.textContent ?? ""),
        );
        return {
          w: el.clientWidth,
          h: (el as HTMLElement).offsetHeight,
          fixesY: fixes ? Math.round(fixes.getBoundingClientRect().top - top) : null,
        };
      })
      .catch(() => null);
    if (m) {
      console.log(
        `   measure · ${key} ${m.w}×${m.h}px · "director's fixes" at y=${m.fixesY ?? "?"}`,
      );
    }
  }

  const stages = await page.locator("[data-shot]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-shot")!),
  );
  const targets = ONLY ? stages.filter((s) => ONLY.includes(s)) : stages;
  if (!targets.length) {
    throw new Error(`no stages matched${ONLY ? ` --only=${ONLY.join(",")}` : ""}`);
  }

  for (const id of targets) {
    const el = page.locator(`[data-shot='${id}']`);
    await el.scrollIntoViewIfNeeded();

    for (const label of PREPARE[id] ?? []) {
      await el.getByText(label, { exact: true }).first().click();
      console.log(`   · ${id}: clicked "${label}"`);
    }

    await page.waitForTimeout(SETTLE_MS[id] ?? 600);

    const png = path.join(OUT_DIR, `${id}.png`);
    const webp = path.join(OUT_DIR, `${id}.webp`);
    await el.screenshot({ path: png });

    execFileSync("cwebp", ["-q", "88", "-quiet", png, "-o", webp]);
    const kb = (fs.statSync(webp).size / 1024).toFixed(0);
    if (!KEEP_PNG) fs.unlinkSync(png);
    console.log(`   ✓ ${id}.webp  ${kb} KB`);
  }

  await browser.close();

  if (errors.length) {
    console.warn(`\n⚠ ${errors.length} console/page error(s) while capturing:`);
    for (const e of errors.slice(0, 8)) console.warn(`   ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`\n${targets.length} shot(s) → public/images/offer/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
