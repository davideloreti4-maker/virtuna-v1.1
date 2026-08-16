/**
 * probe-simdoor-layer.mjs — does the ＋ door's scrim cover the sidebar?
 *
 * The door is mounted by the composer but only OPENABLE from `AmbientStartHome`,
 * which renders on the arrival/empty home — and that is a COOKIE state, not a
 * route. Hence `maven_active_thread=__new__` below; without it the server
 * rehydrates the newest open thread and the trigger never renders.
 *
 * Opening the door is free. It lands on the intake step; nothing is armed and
 * nothing is billed unless the run button is pressed, which this never does.
 *
 *   node scripts/mint-auth-state.mjs http://localhost:3011
 *   node scripts/probe-simdoor-layer.mjs http://localhost:3011
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "http://localhost:3011";
const origin = new URL(BASE);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: ".scratch/auth-state.json",
  viewport: { width: 1440, height: 900 },
});
await ctx.addCookies([
  {
    name: "maven_active_thread",
    value: "__new__",
    domain: origin.hostname,
    path: "/",
  },
]);
const page = await ctx.newPage();

await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("nav", { timeout: 60_000 });
await page.waitForTimeout(4000);

const before = await page.evaluate(
  `!!document.querySelector('[data-testid="sim-door-host"]')`,
);
console.log(`sim door mounted before any click: ${before}`);

// Find the trigger by its label rather than a position guess.
const triggers = await page.evaluate(`(function () {
  var out = [];
  var els = Array.from(document.querySelectorAll('button, [role="button"]'));
  for (var i = 0; i < els.length; i++) {
    var t = (els[i].textContent || '').trim();
    var al = els[i].getAttribute('aria-label') || '';
    if (/simulate|bring|＋|test this|your own/i.test(t + ' ' + al)) {
      var r = els[i].getBoundingClientRect();
      if (r.width > 8 && r.height > 8) out.push({ text: t.slice(0, 50), aria: al.slice(0, 40), x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
    }
  }
  return out;
})()`);
console.log("candidate triggers:", JSON.stringify(triggers, null, 1));

// ⚠️ A mouse.click at the measured coordinate MISSES: the trigger sits at y≈1041
// on a 900px viewport, and /home's scroll lives in an inner overflow-y-auto
// region, so it is off-screen rather than merely below the fold. A locator click
// scrolls it into view first, which is the only reason this opens at all.
let opened = false;
for (const t of triggers) {
  const label = (t.text || t.aria).slice(0, 24);
  try {
    const btn = page.locator("button", { hasText: "Show them your own work" }).first();
    await btn.scrollIntoViewIfNeeded({ timeout: 5000 });
    await btn.click({ timeout: 5000 });
  } catch {
    continue;
  }
  await page.waitForTimeout(1200);
  opened = await page.evaluate(
    `!!document.querySelector('[data-testid="sim-door-host"]')`,
  );
  if (opened) {
    console.log(`opened via: "${label}"`);
    break;
  }
}

if (!opened) {
  console.log("SIM DOOR DID NOT OPEN — not measured");
  await page.screenshot({ path: ".scratch/simdoor-nope.png" });
  await browser.close();
  process.exit(2);
}

const result = await page.evaluate(`(function () {
  var host = document.querySelector('[data-testid="sim-door-host"]');

  var sidebar = null;
  var all = Array.from(document.querySelectorAll('nav, aside, div'));
  for (var i = 0; i < all.length; i++) {
    var cs = getComputedStyle(all[i]);
    var r = all[i].getBoundingClientRect();
    if (cs.position === 'fixed' && cs.zIndex === '250' && r.x === 0 && r.height > 400 && r.width > 40) { sidebar = all[i]; break; }
  }
  if (!sidebar) return { error: 'sidebar not found' };

  var sr = sidebar.getBoundingClientRect();
  var px = Math.round(sr.x + sr.width / 2), py = Math.round(sr.y + sr.height / 2);
  var hit = document.elementFromPoint(px, py);
  var hr = host.getBoundingClientRect();

  return {
    probePoint: { x: px, y: py },
    hit: hit ? { tag: hit.tagName.toLowerCase(), cls: String(hit.className || '').slice(0, 70) } : null,
    hitIsHost: !!(host && hit && (host === hit || host.contains(hit))),
    hitIsSidebar: !!(sidebar && hit && sidebar.contains(hit)),
    hostZ: getComputedStyle(host).zIndex,
    hostRect: { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) },
    sidebarZ: getComputedStyle(sidebar).zIndex,
  };
})()`);

console.log(JSON.stringify(result, null, 2));
console.log(
  `\nVERDICT: the ＋ door scrim ${result.hitIsHost ? "COVERS" : "DOES NOT COVER"} the sidebar` +
    `  (host z=${result.hostZ}, sidebar z=${result.sidebarZ})`,
);

await page.screenshot({ path: ".scratch/simdoor-open.png", animations: "disabled", caret: "hide" });
await browser.close();
