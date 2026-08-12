/**
 * probe-surface-live.mjs — LOOK at a real surface, signed in, in a real browser.
 *
 * WHY THIS EXISTS: on 2026-08-04 the home thread was found to have no scroll management at all —
 * a creator sent a message, the agent answered in ~4s, and the screen stayed PIXEL-IDENTICAL
 * because the answer rendered 700px below the fold. It had survived ~5,200 tests, five merged PRs
 * and every wire-level probe in scripts/, because none of them can see a viewport. The only thing
 * that found it was opening a browser and looking.
 *
 * This is that check, made cheap and repeatable. It reports the facts a screenshot cannot be
 * trusted for and a unit test cannot reach:
 *   - every scrollable region: is it parked away from the bottom? is content stranded below?
 *   - elements rendered BELOW the fold (the defect above; content above the fold is just history)
 *   - horizontal overflow (⚠️ `scrollWidth === clientWidth` is NOT proof there is none — an
 *     ancestor can clip instead of scroll, so the ancestor chain is walked too)
 *   - console errors + pageerrors
 *   - reading measure / leading on `.md` blocks
 *
 * FREE. It only loads a page; it sends nothing and spends no credits.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   # 1. a dev server (a slot worktree must NOT use :3000 — see CLAUDE.md)
 *   npm run dev -- --port 3005
 *
 *   # 2. a signed-in storage state (~2.3s, regenerate whenever it 307s to /login)
 *   set -a; . ./.env.local; set +a
 *   E2E_BASE_URL=http://localhost:3005 \
 *     node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts
 *
 *   # 3. probe
 *   node scripts/probe-surface-live.mjs /home
 *   node scripts/probe-surface-live.mjs /home,/discover,/library     # several at once
 *   SHOTS=1 node scripts/probe-surface-live.mjs /home                # + screenshots
 *   VIEWPORT=390x844 node scripts/probe-surface-live.mjs /home       # ⚠️ see MOBILE below
 *
 * ── Traps this file already accounts for (each cost real time) ───────────────
 *  - `waitUntil: 'networkidle'` NEVER settles here (dev HMR socket). Always `domcontentloaded`
 *    plus an explicit wait for a real element.
 *  - The MCP screenshot tool HANGS on this app — the ambient animations never settle. Raw
 *    Playwright with `animations: 'disabled'` + `caret: 'hide'` is the only thing that works.
 *  - The app SSRs to a near-empty shell. A short `body` is NOT proof the route is broken.
 *  - MOBILE: resizing a loaded page does not give you the mobile UI — components measure at
 *    MOUNT. VIEWPORT is applied before navigation for exactly this reason; never resize after.
 *  - Playwright's `.click()` auto-scrolls the target into view, which legitimately releases the
 *    thread's autoscroll pin. When measuring scroll around a click, do NOT also call
 *    `scrollIntoViewIfNeeded()` — you will measure your own harness.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:3005';
const STATE = process.env.STATE ?? resolve(process.cwd(), 'e2e/auth/state.json');
const ROUTES = (process.argv[2] ?? '/home').split(',').map((r) => r.trim()).filter(Boolean);
const [VW, VH] = (process.env.VIEWPORT ?? '1440x900').split('x').map(Number);
const SHOTS = process.env.SHOTS === '1';
const OUT = process.env.OUT ?? resolve(process.cwd(), '.scratch/surface-shots');

/** Distance from the bottom still counted as "showing the newest content". Mirrors PIN_THRESHOLD_PX. */
const BOTTOM_SLACK = 120;

/**
 * Regions that stream new content in and MUST therefore stay pinned to the bottom. Everything else
 * is a list, where opening at the top is correct. Keep this in sync with the surfaces that own a
 * useThreadAutoscroll-style contract.
 */
const STREAMING_REGIONS = new Set(['composer-thread-region']);

if (SHOTS) mkdirSync(OUT, { recursive: true });

/** Runs in the page. Returns only facts — no verdicts, so the caller can judge. */
function collect(slack) {
  const round = (n) => Math.round(n);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height), bottom: round(r.bottom) };
  };
  const label = (el) =>
    el.getAttribute('data-testid') ??
    `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(/\s+/).slice(0, 2).join('.') : ''}`;

  const all = Array.from(document.querySelectorAll('*'));

  const scrollers = all
    .filter((el) => {
      const cs = getComputedStyle(el);
      return /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4;
    })
    .map((el) => ({
      el: label(el),
      scrollTop: round(el.scrollTop),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      below: el.scrollHeight - el.clientHeight - round(el.scrollTop),
      paddingBottom: getComputedStyle(el).paddingBottom,
    }));

  // Rendered BELOW the fold — the defect that made a whole answer invisible.
  //
  // ⚠️ Only below. Content at NEGATIVE y is history the creator has scrolled past, which is normal
  // and swamps the signal: the first version of this probe flagged 25 such nodes on a healthy
  // thread. Below the fold is the case that costs you — it is content the creator has never seen
  // and has no cue exists.
  const OFFSCREEN_TAGS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE']);
  const belowFold = all
    .filter((el) => {
      if (OFFSCREEN_TAGS.has(el.tagName)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 12) return false;
      const txt = (el.innerText || '').trim();
      if (!txt) return false;
      // leaf-ish only, so a wrapper does not re-report its children
      if (el.children.length > 3) return false;
      return r.top >= window.innerHeight;
    })
    .slice(0, 25)
    .map((el) => ({ el: label(el), box: box(el), text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70) }));

  // Horizontal overflow. scrollWidth === clientWidth is a FALSE PASS when an ancestor clips.
  const hOverflow = all
    .filter((el) => {
      if (el.scrollWidth <= el.clientWidth + 2) return false;
      return /auto|scroll|visible/.test(getComputedStyle(el).overflowX) === false || el.scrollWidth > el.clientWidth + 2;
    })
    .slice(0, 15)
    .map((el) => ({ el: label(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: getComputedStyle(el).overflowX }));

  const docScrollWidth = document.documentElement.scrollWidth;
  const bodyOverflows = docScrollWidth > window.innerWidth + 2;

  const md = Array.from(document.querySelectorAll('.md')).map((el) => {
    const cs = getComputedStyle(el);
    return { box: box(el), fontSize: cs.fontSize, lineHeight: cs.lineHeight, maxWidth: cs.maxWidth };
  });

  return {
    url: location.pathname + location.search,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    windowScroll: { y: round(window.scrollY), docHeight: document.documentElement.scrollHeight },
    scrollers,
    belowFold,
    hOverflow,
    bodyOverflows,
    docScrollWidth,
    md,
    testids: Array.from(document.querySelectorAll('[data-testid]'))
      .map((e) => e.getAttribute('data-testid'))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 60),
    bodyChars: (document.body.innerText || '').replace(/\s+/g, ' ').trim().length,
    slack,
  };
}

const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const ctx = await browser.newContext({
  storageState: STATE,
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 2,
  isMobile: VW < 700,
  hasTouch: VW < 700,
});

let findings = 0;

for (const route of ROUTES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 200)));

  console.log(`\n${'='.repeat(72)}\n${route}   ${VW}x${VH}\n${'='.repeat(72)}`);
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // never networkidle — see the header
    //
    // `form, h1` are here because the ONBOARDING routes have none of the other three. /login
    // renders <LoginForm /> straight out of the page with no <main>, no textarea and no
    // data-testid, so the original selector waited the full 120s and reported "✗ did not load"
    // on a page that renders fine. A probe that cannot open the signed-OUT half of the product
    // is a probe that will keep reporting the signed-out half is broken.
    await page.waitForSelector('main, textarea, [data-testid], form, h1', { timeout: 120000 });
    await page.waitForTimeout(3500);
  } catch (e) {
    console.log(`  ✗ did not load: ${e.message.split('\n')[0]}`);
    findings++;
    await page.close();
    continue;
  }

  // Landing on /login means the storage state expired — UNLESS /login is what was asked for, or
  // the route legitimately bounces anonymous visitors there. Comparing against the REQUESTED
  // route is the whole fix: the bare `includes('/login')` reported a stale state while probing
  // /login itself, which is the one route where arriving at /login is a pass.
  if (page.url().includes('/login') && !route.startsWith('/login')) {
    console.log(
      `  ✗ ${route} redirected to /login — either the storage state is stale (regenerate it, see` +
        ' header) or this route requires auth and the probe is running anonymously.',
    );
    findings++;
    await page.close();
    continue;
  }

  const r = await page.evaluate(collect, BOTTOM_SLACK);

  console.log(`  body ${r.bodyChars} chars · window.scrollY ${r.windowScroll.y} · doc ${r.windowScroll.docHeight}px`);

  if (!r.scrollers.length) {
    console.log('  scroll regions: none (content fits, or the page scrolls the window)');
  }
  for (const s of r.scrollers) {
    // ⚠️ "not at the bottom" is a DEFECT only for a region that streams new content into view.
    // A list (/library, /discover) correctly opens at the TOP, and flagging that is noise — the
    // first version of this probe called a healthy saved-items list a finding.
    const streaming = STREAMING_REGIONS.has(s.el);
    const stranded = streaming && s.below > BOTTOM_SLACK;
    console.log(
      `  ${stranded ? '⚠' : '·'} scroller [${s.el}]${streaming ? ' (streams — must stay pinned)' : ''} top=${s.scrollTop} of ${s.scrollHeight}/${s.clientHeight} → ${s.below}px below`,
    );
    if (stranded) findings++;
  }

  // Below-fold content inside a scrollable LIST is just "scroll down"; inside a streaming region
  // it is the defect this probe exists for.
  const inStreamingRegion = r.scrollers.some((s) => STREAMING_REGIONS.has(s.el) && s.below > BOTTOM_SLACK);
  if (r.belowFold.length && inStreamingRegion) {
    findings += r.belowFold.length;
    console.log(`  ⚠ ${r.belowFold.length} element(s) rendered BELOW the fold in a streaming region — the creator never sees these:`);
    for (const o of r.belowFold.slice(0, 8)) console.log(`      y=${o.box.y} [${o.el}] "${o.text}"`);
  } else if (r.belowFold.length) {
    console.log(`  · ${r.belowFold.length} element(s) below the fold (scrollable content — scroll down reaches them)`);
  }

  if (r.bodyOverflows) {
    findings++;
    console.log(`  ⚠ the PAGE scrolls horizontally (doc ${r.docScrollWidth} > viewport ${r.viewport.w})`);
  }
  for (const h of r.hOverflow.slice(0, 6)) {
    console.log(`  · h-overflow [${h.el}] ${h.scrollWidth} > ${h.clientWidth} (overflow-x: ${h.overflowX})`);
  }

  for (const m of r.md) {
    console.log(`  · .md measure ${m.box.w}px (max ${m.maxWidth}) ${m.fontSize}/${m.lineHeight}`);
  }

  if (errors.length) {
    findings += errors.length;
    console.log(`  ⚠ ${errors.length} console error(s):`);
    for (const e of errors.slice(0, 6)) console.log(`      ${e}`);
  } else {
    console.log('  · console clean');
  }

  if (SHOTS) {
    const file = resolve(OUT, `${route.replace(/\W+/g, '_')}_${VW}x${VH}.png`);
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
    console.log(`  [shot] ${file}`);
  }

  await page.close();
}

console.log(`\n${findings === 0 ? '✓ nothing flagged' : `⚠ ${findings} thing(s) flagged — LOOK at them, a flag is a lead, not a verdict`}`);
await browser.close();
