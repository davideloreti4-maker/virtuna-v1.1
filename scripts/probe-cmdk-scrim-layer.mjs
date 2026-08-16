/**
 * probe-cmdk-scrim-layer.mjs — does the ⌘K scrim actually cover the sidebar?
 *
 * The question is a STACKING question, so it is measured by hit-testing
 * (`elementFromPoint` over the sidebar's own centre), not by reading a class
 * name and not by eyeballing a screenshot. If the palette's overlay wins the
 * point, the scrim covers the sidebar; if a sidebar node wins, it does not.
 *
 * Computed z-index is reported alongside, because that is the mechanism.
 *
 *   node scripts/mint-auth-state.mjs http://localhost:3010
 *   node scripts/probe-cmdk-scrim-layer.mjs http://localhost:3010 before
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3010";
const LABEL = process.argv[3] || "run";
mkdirSync(".scratch", { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: ".scratch/auth-state.json",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
// The app SSRs to a near-empty shell; wait for the real chrome, never networkidle.
await page.waitForSelector("aside, nav", { timeout: 60_000 });
await page.waitForTimeout(3000); // hydration settle — a probe at machine speed measures loading

// ⚠️ `document.querySelector("aside")` finds the 400px RIGHT rail on /home, not the
// left nav — measuring it answers a different question entirely. The left sidebar is
// the FIXED element flush to x=0 carrying --z-sidebar (250). Find it by that shape.
const sidebarBox = await page.evaluate(
  "(" +
    function () {
      const all = Array.from(document.querySelectorAll("nav, aside, div"));
      for (const el of all) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.position === "fixed" && cs.zIndex === "250" && r.x === 0 && r.height > 400 && r.width > 40) {
          return {
            tag: el.tagName.toLowerCase(),
            x: r.x, y: r.y, w: r.width, h: r.height,
            zIndex: cs.zIndex,
          };
        }
      }
      return null;
    }.toString() +
    ")()",
);

if (!sidebarBox || sidebarBox.w < 40) {
  console.error("NO SIDEBAR FOUND — cannot measure", JSON.stringify(sidebarBox));
  await browser.close();
  process.exit(1);
}

await page.screenshot({
  path: `.scratch/cmdk-${LABEL}-closed.png`,
  animations: "disabled",
  caret: "hide",
});

// Open the palette.
await page.keyboard.press("Meta+k");
await page.waitForSelector('[role="dialog"][aria-label="Command palette"]', { timeout: 10_000 });
await page.waitForTimeout(800);

const probeX = Math.round(sidebarBox.x + sidebarBox.w / 2);
const probeY = Math.round(sidebarBox.y + sidebarBox.h / 2);

const result = await page.evaluate(
  function (args) {
    const dialog = document.querySelector('[role="dialog"][aria-label="Command palette"]');
    const overlay = dialog ? dialog.parentElement : null; // the fixed inset-0 container
    const scrim = overlay ? overlay.querySelector('[aria-hidden="true"]') : null;

    let sidebar = null;
    const all = Array.from(document.querySelectorAll("nav, aside, div"));
    for (const el of all) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.position === "fixed" && cs.zIndex === "250" && r.x === 0 && r.height > 400 && r.width > 40) {
        sidebar = el;
        break;
      }
    }

    const hit = document.elementFromPoint(args.x, args.y);

    const describe = function (el) {
      if (!el) return null;
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined
          ? el.className.baseVal
          : String(el.className || "")).slice(0, 110),
        zIndex: getComputedStyle(el).zIndex,
      };
    };

    const rect = function (el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };

    return {
      probePoint: { x: args.x, y: args.y },
      hitElement: describe(hit),
      hitIsInsideOverlay: !!(overlay && hit && overlay.contains(hit)),
      hitIsInsideSidebar: !!(sidebar && hit && sidebar.contains(hit)),
      overlay: { ...describe(overlay), rect: rect(overlay) },
      scrim: { ...describe(scrim), rect: rect(scrim), bg: scrim ? getComputedStyle(scrim).backgroundColor : null },
      sidebar: { ...describe(sidebar), rect: rect(sidebar) },
      overlayCoversSidebarGeometrically: (function () {
        const o = rect(overlay), s = rect(sidebar);
        if (!o || !s) return null;
        return o.x <= s.x && o.y <= s.y && o.x + o.w >= s.x + s.w && o.y + o.h >= s.y + s.h;
      })(),
    };
  },
  { x: probeX, y: probeY },
);

await page.screenshot({
  path: `.scratch/cmdk-${LABEL}-open.png`,
  animations: "disabled",
  caret: "hide",
});

console.log(JSON.stringify(result, null, 2));
console.log(
  `\nVERDICT [${LABEL}]: the scrim ${result.hitIsInsideOverlay ? "COVERS" : "DOES NOT COVER"} the sidebar` +
    `  (overlay z=${result.overlay.zIndex}, sidebar z=${result.sidebar.zIndex}, geometry-covers=${result.overlayCoversSidebarGeometrically})`,
);

await browser.close();
