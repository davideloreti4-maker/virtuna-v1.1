/**
 * probe-overlay-stacking-context.mjs — is a `fixed inset-0` overlay actually liftable?
 *
 * Raising an overlay's z-index only reaches the top of the page if nothing between
 * it and <body> creates a stacking context. If an ancestor does, the overlay is
 * sealed inside that context and NO z-index will lift it above a sibling of the
 * ancestor — the sidebar included. (`.rv-in` is a known offender in this codebase.)
 *
 * So before changing any z on a NON-PORTALED overlay, walk its mount point's
 * ancestor chain and report every context-creating element. A clean chain means a
 * z-bump is sufficient; a dirty one means the overlay has to be portaled instead.
 *
 *   node scripts/mint-auth-state.mjs http://localhost:3011
 *   node scripts/probe-overlay-stacking-context.mjs http://localhost:3011
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "http://localhost:3011";

const WALK = `(function (startSel) {
  var start = document.querySelector(startSel);
  if (!start) return { error: 'not found: ' + startSel };

  function creates(el) {
    var cs = getComputedStyle(el);
    var why = [];
    if (cs.position === 'fixed' || cs.position === 'sticky') why.push('position:' + cs.position);
    if (cs.position !== 'static' && cs.zIndex !== 'auto') why.push('position:' + cs.position + ' + z-index:' + cs.zIndex);
    if (parseFloat(cs.opacity) < 1) why.push('opacity:' + cs.opacity);
    if (cs.transform && cs.transform !== 'none') why.push('transform');
    if (cs.filter && cs.filter !== 'none') why.push('filter');
    if (cs.backdropFilter && cs.backdropFilter !== 'none') why.push('backdrop-filter');
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') why.push('mix-blend-mode');
    if (cs.isolation === 'isolate') why.push('isolation:isolate');
    if (cs.perspective && cs.perspective !== 'none') why.push('perspective');
    if (cs.contain && /paint|layout|strict|content/.test(cs.contain)) why.push('contain:' + cs.contain);
    if (cs.willChange && /transform|opacity|filter/.test(cs.willChange)) why.push('will-change:' + cs.willChange);
    return why;
  }

  var chain = [], el = start.parentElement, depth = 0;
  while (el && el !== document.documentElement && depth < 60) {
    var why = creates(el);
    if (why.length) {
      chain.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 90),
        reasons: why,
        zIndex: getComputedStyle(el).zIndex,
      });
    }
    el = el.parentElement;
    depth++;
  }
  return { start: startSel, contextCount: chain.length, contexts: chain };
})`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: ".scratch/auth-state.json",
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("nav", { timeout: 60_000 });
await page.waitForTimeout(3500);

// The composer is SimulateDoorHost's mount point (composer.tsx:3701). Its textarea is
// the stable anchor; anything above it that seals a stacking context seals the door too.
const targets = [
  ["composer (SimulateDoorHost's mount point)", "textarea"],
  ["sidebar (control — known to be liftable)", "nav"],
];

for (const [label, sel] of targets) {
  const out = await page.evaluate(`${WALK}(${JSON.stringify(sel)})`);
  console.log(`\n=== ${label} — selector ${sel} ===`);
  if (out.error) {
    console.log("  " + out.error);
    continue;
  }
  console.log(`  stacking contexts between it and <html>: ${out.contextCount}`);
  for (const c of out.contexts) {
    console.log(`   • <${c.tag}> z=${c.zIndex}  [${c.reasons.join(", ")}]`);
    console.log(`       ${c.cls}`);
  }
}

await browser.close();
