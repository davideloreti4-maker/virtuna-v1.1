/**
 * probe-audit-rewalk.mjs — re-measure the 2026-08-09 audit's viewport findings.
 *
 * Covers F-9, F-10, F-13, F-14, F-15 (desktop) and F-16..F-20 (mobile), in NATIVE viewport
 * contexts. Read-only: opens an EXISTING thread by cookie, dispatches nothing, spends no credits.
 *
 *   node scripts/mint-auth-state.mjs http://localhost:3015
 *   node scripts/probe-audit-rewalk.mjs http://localhost:3015 <threadId>
 *
 * Traps this encodes (each cost time): native contexts, never a resized page · domcontentloaded
 * + explicit wait, never networkidle (the dev HMR socket never settles) · the scroll container is
 * [data-testid="composer-thread-region"], never the body · a bare "() => {…}" string in
 * page.evaluate returns the FUNCTION (unserialisable -> undefined), so it is invoked as `(${FN})()`.
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
  const px = v => parseFloat(v) || 0;
  const thread = document.querySelector('[data-testid="composer-thread-region"]');
  const scope  = thread || document.body;
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

  // ── text roles: size x weight x colour across the thread's rendered text
  const roles = new Map();
  let body = null, widest = 0;
  for (const el of scope.querySelectorAll('*')) {
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (t.length < 12 || !vis(el)) continue;
    const s = getComputedStyle(el);
    roles.set(s.fontSize + '/' + s.fontWeight + '/' + s.color, (roles.get(s.fontSize + '/' + s.fontWeight + '/' + s.color) || 0) + 1);
    const w = el.getBoundingClientRect().width;
    if (t.length > 80 && w > widest) { widest = w; body = { fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, width: Math.round(w), family: s.fontFamily.split(',')[0] }; }
  }

  // ── headings + unnamed icon buttons + small targets
  const headings = scope.querySelectorAll('h1,h2,h3,h4').length;
  const btns = [...document.querySelectorAll('button,a[href],[role="button"]')].filter(vis);
  const unnamed = btns.filter(b => {
    const n = (b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText || '').trim();
    return n.length === 0;
  }).length;
  const small32 = btns.filter(b => b.getBoundingClientRect().height < 32).length;
  const small40 = btns.filter(b => { const r = b.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).length;

  // ── accent dosage (LOCKED rule): count elements painted with the coral accent
  const ACCENT = ['255, 99, 99', '#FF6363'];
  let accent = 0;
  for (const el of document.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    const blob = s.color + s.backgroundColor + s.borderTopColor + s.fill;
    if (ACCENT.some(a => blob.includes(a))) accent++;
  }

  // ── F-13: is the composer backdrop a solid fill or a gradient mask?
  const bd = document.querySelector('[data-testid="composer-backdrop"]');
  const bdS = bd ? getComputedStyle(bd) : null;
  // WARNING: the fade is a MASK, not a background-image (globals.css .composer-veil) -- the fill
  // stays the bg-background TOKEN so the page colour is never re-typed as a hex here. Reading only
  // backgroundImage reported "none" on a WORKING fade and would have re-opened F-13 as a false
  // regression. Same for the F-18 scrim. (No backticks in this string: MEASURE is a template
  // literal, and one backtick in a comment ends it mid-function.)
  const scrim = document.querySelector('.nav-scrim');
  const scrimS = scrim ? getComputedStyle(scrim) : null;

  // ── F-1 / F-6 / F-7 signals straight off the DOM
  const cards = [...document.querySelectorAll('[class*="card"],[data-testid*="card"]')].filter(vis);
  const txt = scope.innerText || '';
  const mult = [...txt.matchAll(/([\\d.]+)\\s*×/g)].map(m => m[1]);
  const handles = [...txt.matchAll(/@([a-zA-Z0-9._]+)/g)].map(m => m[1]);
  const dupHandle = handles.reduce((a, h) => { a[h] = (a[h] || 0) + 1; return a; }, {});

  const composer = document.querySelector('[data-testid="composer-backdrop"]')?.parentElement
                || document.querySelector('form');
  const cRect = composer ? composer.getBoundingClientRect() : null;

  return {
    viewport: { w: innerWidth, h: innerHeight },
    threadFound: !!thread,
    body,
    measureCh: body ? Math.round(body.width / (px(body.fontSize) * 0.5)) : null,
    distinctTextRoles: roles.size,
    topRoles: [...roles.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),
    headings, unnamedButtons: unnamed, under32: small32, under40: small40,
    accentElements: accent,
    composerBackdrop: bdS ? {
      backgroundImage: bdS.backgroundImage,
      backgroundColor: bdS.backgroundColor,
      maskImage: bdS.maskImage || bdS.webkitMaskImage,
      // The real question F-13 asks: is the top edge a hard cut? A mask or a gradient both answer no.
      fadesAtTop: /gradient/.test(bdS.maskImage || bdS.webkitMaskImage || '') || /gradient/.test(bdS.backgroundImage || ''),
    } : 'ABSENT',
    navScrim: scrimS ? {
      height: Math.round(scrim.getBoundingClientRect().height),
      backgroundColor: scrimS.backgroundColor,
      maskImage: scrimS.maskImage || scrimS.webkitMaskImage,
      pointerEvents: scrimS.pointerEvents,
      visible: scrim.getBoundingClientRect().height > 0,
    } : 'ABSENT',
    composerRect: cRect ? { top: Math.round(cRect.top), height: Math.round(cRect.height), bottom: Math.round(cRect.bottom) } : null,
    deadSpaceBelowComposer: cRect ? Math.round(innerHeight - cRect.bottom) : null,
    cardCount: cards.length,
    multipliersOnScreen: [...new Set(mult)].slice(0, 8),
    repeatedHandles: Object.entries(dupHandle).filter(([,n]) => n > 1),
    docOverflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    threadScrollable: thread ? thread.scrollHeight > thread.clientHeight : null,
    threadScrollHeight: thread ? thread.scrollHeight : null,
  };
}`;

async function walk(name, viewport, isMobile) {
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
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));

  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-testid="composer-thread-region"]', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000); // client-rendered; no networkidle on this app

  // A bare "() => {...}" string evaluates to the FUNCTION (unserialisable → undefined).
  // Invoke it as an expression so the return value crosses the bridge.
  const m = await page.evaluate(`(${MEASURE})()`);
  m.consoleErrors = errors.length;
  m.consoleSample = errors.slice(0, 3);

  await page.screenshot({
    path: `.scratch/rewalk-${name}.png`,
    animations: "disabled",
    caret: "hide",
  });
  await browser.close();
  return m;
}

const desktop = await walk("desktop", { width: 1200, height: 729 }, false);
const mobile = await walk("mobile", { width: 393, height: 660 }, true);
const out = { thread: THREAD, desktop, mobile };
writeFileSync(".scratch/rewalk.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
