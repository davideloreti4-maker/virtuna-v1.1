/**
 * probe-tap-targets.mjs — the REAL tap-target measurement for F-19, with identity.
 *
 *   node scripts/mint-auth-state.mjs http://localhost:3015
 *   node scripts/probe-tap-targets.mjs http://localhost:3015 <threadId>
 *
 * Why this exists rather than the count in probe-audit-rewalk.mjs:
 *
 * 1. A COUNT CANNOT BE FIXED. "84 elements under 40px" names nothing. This returns the
 *    elements — label, owner, box, and the measured hit result — grouped by signature so one
 *    repeated component is one row with a multiplicity.
 *
 * 2. getBoundingClientRect() MEASURES THE DRAWN BOX, WHICH IS NOT WHAT A THUMB HITS. The fix
 *    for an inline text affordance is a ::after halo (globals.css `.tap-44`) that makes a 47×18
 *    "Copy" a 44×44 target while the button's own rect stays 47×18 forever. A box-based count
 *    reports every one of those as unfixed. So this asks the DOCUMENT instead: sample the 44×44
 *    square centred on the element and call elementFromPoint at five points.
 *
 * 3. elementFromPoint ONLY ANSWERS FOR PIXELS THAT EXIST. Three quarters of this surface's
 *    controls are not on screen at rest — the sidebar is an off-canvas drawer at negative x, and
 *    the thread rests scrolled to the bottom with every card above the fold. Hit-testing them
 *    where they sit returns "0 of 5" for a 203×44 row that is perfectly fine. The first version
 *    of this probe did exactly that and reported 89 failures out of 92 controls, INCLUDING
 *    elements it had itself measured at 44px. Hence: scroll the thread through its full height,
 *    open the drawer, and only ever judge an element in the step where it is genuinely visible.
 *
 * Other traps encoded here: native mobile context, never a resized page · `(${FN})()` so the
 * return value crosses the bridge · no backticks inside MEASURE (it is a template literal) ·
 * dev-only overlays (the Next.js indicator, the mock panel) are excluded from the product count.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3015";
const THREAD = process.argv[3] || "cd4cbbbd-8e81-47a9-b82f-e4f61f7653e7";
const state = JSON.parse(readFileSync(".scratch/auth-state.json", "utf8"));
state.cookies.push({
  name: "maven_active_thread", value: THREAD,
  domain: new URL(BASE).hostname, path: "/", expires: -1,
  httpOnly: false, secure: false, sameSite: "Lax",
});

const MEASURE = `() => {
  const SEL = 'button,a[href],[role="button"],input,select,textarea';
  const HIT = 44;

  // On screen = the drawn box overlaps the viewport by at least a pixel AND the element is
  // painted. An off-canvas drawer child has a real size at a negative x; a scrolled-away card
  // has a real size below the fold. Neither can be hit-tested where it sits.
  function onScreen(r) {
    return r.width > 0 && r.height > 0 &&
           r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }

  // EDGE MIDPOINTS, NOT CORNERS. Sampling the four corners of the 44x44 square reads a rounded
  // element as broken: on a 203x44 nav row with an 8px radius the corner point sits 1px in from
  // the box corner, which is OUTSIDE the rounded shape, so elementFromPoint returns the parent
  // and a perfectly good row scores 1 of 5. Measured that way this probe reported 15 failures,
  // 11 of them pure border-radius. The midpoints ask the question that actually matters -- does
  // the target extend 22px up, down, left and right of its centre -- and are radius-blind.
  function probe(b) {
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hx = Math.max(r.width, HIT) / 2 - 1, hy = Math.max(r.height, HIT) / 2 - 1;
    const pts = [[cx, cy], [cx, cy - hy], [cx, cy + hy], [cx - hx, cy], [cx + hx, cy]];
    let hits = 0, offscreen = 0, covered = 0;
    for (const [x, y] of pts) {
      if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) { offscreen++; continue; }
      const el = document.elementFromPoint(x, y);
      if (!el) { offscreen++; continue; }
      if (el === b || b.contains(el)) { hits++; continue; }
      // The point resolved to something else. A different INTERACTIVE owner means this element
      // does not own that corner -- another control does, and a tap there goes to the other one.
      const other = el.closest(SEL);
      if (other && other !== b) covered++;
    }
    return { hits, offscreen, covered };
  }

  const out = [];
  for (const b of document.querySelectorAll(SEL)) {
    const r = b.getBoundingClientRect();
    if (!onScreen(r)) continue;
    const st = getComputedStyle(b);
    // An element that cannot be pressed is not a tap target. This is also how the fix to the
    // sidebar's opacity-0 trio proves itself: they report pointerEvents none until revealed.
    const pressable = st.pointerEvents !== 'none' && st.visibility !== 'hidden' && st.display !== 'none';
    const { hits, offscreen, covered } = probe(b);
    out.push({
      tag: b.tagName.toLowerCase(),
      testid: b.getAttribute('data-testid') || null,
      label: (b.getAttribute('aria-label') || b.innerText || '').trim().slice(0, 44) || null,
      w: Math.round(r.width), h: Math.round(r.height),
      opacity: st.opacity,
      pressable,
      hits, offscreenPts: offscreen, coveredPts: covered,
      // PASS = every sampled point that exists on screen resolved to this element. Points that
      // fall outside the viewport are not evidence either way and never fail an element —
      // including the degenerate case where ALL of them are (a row peeking 1px into a scroll
      // container). That is "not measured here", not "too small", and calling it a failure is
      // the same absent-field-reads-as-a-result mistake this probe exists to avoid.
      pass: offscreen === 5 || (hits > 0 && hits + offscreen === 5),
      unmeasured: offscreen === 5,
      owner: (() => {
        let p = b.parentElement;
        while (p && p !== document.body) {
          const t = p.getAttribute('data-testid');
          if (t) return t;
          p = p.parentElement;
        }
        return null;
      })(),
    });
  }
  return out;
}`;

// Walk the thread from top to bottom, then open the drawer. An element is judged in the step
// where it was actually visible; the union is keyed on label+owner so a card seen twice is one row.
const SWEEP = `async () => {
  const region = document.querySelector('[data-testid="composer-thread-region"]');
  const steps = [];
  if (region) {
    const h = region.clientHeight;
    for (let y = 0; y <= region.scrollHeight; y += Math.max(120, Math.floor(h * 0.6))) steps.push(y);
  }
  return steps.length ? steps : [0];
}`;

async function walk(viewport, isMobile) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport, isMobile, hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 3 : 2,
    userAgent: isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
    storageState: state,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-testid="composer-thread-region"]', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000);

  const seen = new Map();
  const absorb = (rows, where) => {
    for (const r of rows) {
      const k = [r.owner, r.label, r.tag, r.w + "x" + r.h].join(" | ");
      // Keep the BEST observation of an element: a card half-clipped by the fold is not evidence
      // that its Copy button is too small.
      const prev = seen.get(k);
      if (!prev || (!prev.pass && r.pass) || (r.hits > prev.hits)) seen.set(k, { ...r, where, n: (prev?.n ?? 0) + 1 });
      else prev.n += 1;
    }
  };

  const steps = await page.evaluate(`(${SWEEP})()`);
  for (const y of steps) {
    await page.evaluate(
      (top) => document.querySelector('[data-testid="composer-thread-region"]')?.scrollTo({ top, behavior: "instant" }),
      y,
    );
    await page.waitForTimeout(250);
    absorb(await page.evaluate(`(${MEASURE})()`), `thread@${y}`);
  }

  // The drawer, open. Its 58 controls are the bulk of the audit's count and cannot be hit-tested
  // while it sits off-canvas.
  const opened = await page.evaluate(`(${MEASURE})()`).then(() => true).catch(() => false);
  if (opened) {
    await page.click('[aria-label="Open sidebar"]').catch(() => {});
    await page.waitForTimeout(600);
    absorb(await page.evaluate(`(${MEASURE})()`), "drawer-open");
  }

  await browser.close();

  const rows = [...seen.values()];
  const isDev = (r) => /dev mock|next\.?js|issues overlay|issues badge/i.test(r.label || "");
  const product = rows.filter((r) => !isDev(r));
  const pressable = product.filter((r) => r.pressable);
  return {
    viewport,
    observed: rows.length,
    productControls: product.length,
    pressableControls: pressable.length,
    // The headline: pressable product controls whose 44×44 square does NOT resolve to them.
    failing44: pressable.filter((r) => !r.pass).length,
    // Kept so the number stays comparable to the 2026-08-09 audit's method.
    boxUnder40: product.filter((r) => r.w < 40 || r.h < 40).length,
    // Invisible but still pressable — the opacity-0 trap. Should be 0.
    invisibleButPressable: product.filter((r) => r.pressable && Number(r.opacity) === 0)
      .map((r) => ({ label: r.label, box: r.w + "x" + r.h })),
    fails: pressable.filter((r) => !r.pass)
      .map((r) => ({
        label: r.label, owner: r.owner, box: r.w + "x" + r.h, where: r.where,
        // The five points, accounted for. hits + offscreen + covered < 5 means the remainder
        // landed on a NON-interactive element painted on top — in dev that is almost always the
        // Next.js indicator or the mock panel sitting over the composer, which is why the real
        // read of this probe is taken on a prod build.
        hits: r.hits, offscreen: r.offscreenPts, covered: r.coveredPts,
        other: 5 - r.hits - r.offscreenPts - r.coveredPts,
      })),
  };
}

const mobile = await walk({ width: 393, height: 660 }, true);
writeFileSync(".scratch/tap-targets.json", JSON.stringify({ thread: THREAD, mobile }, null, 2));
console.log(JSON.stringify(mobile, null, 2));
