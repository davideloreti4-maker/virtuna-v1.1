/**
 * probe-cards-and-measure.mjs — characters-per-line by the AUDIT'S OWN method, plus card signals.
 *
 * The audit measured measure as column-width / the rendered width of "0". A 0.5em approximation is
 * a DIFFERENT statistic wearing the same name and is not comparable to the 75ch it recorded.
 *
 * Also scrolls the thread region to the top so the pack is in the DOM (the default view pins to the
 * newest turn). ⚠️ `[class*="card"]` matches NOTHING on this surface and the thread region exposes
 * only ~2 data-testids total — selector-based card counts here are unreliable by construction.
 *
 *   node scripts/probe-cards-and-measure.mjs http://localhost:3015 <threadId>
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

const MEASURE = `(() => {
  const thread = document.querySelector('[data-testid="composer-thread-region"]');
  const scope = thread || document.body;

  // ── the audit's ch method: column width ÷ the rendered width of "0" in that exact font
  function chFor(el) {
    const s = getComputedStyle(el);
    const span = document.createElement('span');
    span.textContent = '0';
    span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-family:' +
      s.fontFamily + ';font-size:' + s.fontSize + ';font-weight:' + s.fontWeight;
    document.body.appendChild(span);
    const zero = span.getBoundingClientRect().width;
    span.remove();
    return { ch: Math.round(el.getBoundingClientRect().width / zero), zeroPx: +zero.toFixed(2) };
  }

  // widest long-text paragraph = the reading column
  let bodyEl = null, w = 0;
  for (const el of scope.querySelectorAll('p,div,span')) {
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (t.length < 80) continue;
    const r = el.getBoundingClientRect();
    if (r.width > w) { w = r.width; bodyEl = el; }
  }

  // ── cards: by testid, and by the proof-receipt structure
  const testids = [...new Set([...scope.querySelectorAll('[data-testid]')]
    .map(e => e.getAttribute('data-testid')))];
  const cardish = testids.filter(t => /card|hook|proof|receipt|source/i.test(t));

  const txt = scope.innerText || '';
  const mults = [...txt.matchAll(/([\\d.]+)\\s*×/g)].map(m => m[1]);
  const handles = [...txt.matchAll(/@([a-zA-Z0-9._]{3,})/g)].map(m => m[1]);
  const counts = {};
  for (const h of handles) counts[h] = (counts[h] || 0) + 1;

  const s = bodyEl ? getComputedStyle(bodyEl) : null;
  return {
    body: s ? { fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, width: Math.round(w) } : null,
    measure: bodyEl ? chFor(bodyEl) : null,
    allTestids: testids.length,
    cardishTestids: cardish,
    multipliersOnScreen: [...new Set(mults)],
    handleCounts: Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6),
    hasOriginalDisclaimer: /Original\\s*—\\s*not drawn/i.test(txt),
    disclaimerCount: (txt.match(/Original\\s*—\\s*not drawn/gi) || []).length,
    provenStructure: /PROVEN STRUCTURE/i.test(txt),
    bracketPlaceholders: (txt.match(/\\[[A-Za-z][^\\]]{3,40}\\]/g) || []).slice(0, 6),
    threadChars: txt.length,
  };
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1200, height: 729 }, deviceScaleFactor: 2,
  storageState: state, reducedMotion: "reduce",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector('[data-testid="composer-thread-region"]', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(6000);

// scroll the THREAD REGION (not the body — memory: the scroll lives in an inner region)
await page.evaluate(`document.querySelector('[data-testid="composer-thread-region"]').scrollTop = 0`);
await page.waitForTimeout(2500);

const m = await page.evaluate(MEASURE);
writeFileSync(".scratch/cards-measure.json", JSON.stringify(m, null, 2));
console.log(JSON.stringify(m, null, 2));

await page.screenshot({ path: ".scratch/rewalk-pack-top.png", animations: "disabled", caret: "hide" });
await browser.close();
