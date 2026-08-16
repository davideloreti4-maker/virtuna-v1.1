/**
 * probe-f12-wait-layout.mjs — F-12 "the wait happens in a void", measured in a real browser.
 *
 * THE ROW (2026-08-09): "During the run the progress card sits pinned to the TOP of the viewport
 * with ~600px of empty space between it and the composer. Both benchmarks keep the live turn
 * anchored near the composer so the eye never moves."
 *
 * WHY THIS NEEDS A BROWSER AND NOTHING ELSE. It is a claim about where two boxes sit relative to
 * each other and to the viewport. jsdom has no layout, the suite cannot see it, and the free
 * loop-level probe (probe-f11-stream-timing.ts) never renders anything. Only a real engine with
 * real CSS can answer it.
 *
 * ⚠️ WHAT THIS MEASURES, PRECISELY — read before quoting it.
 * It measures the PURE-CHAT wait: `thread-turn.tsx:315` renders the "Thinking…" dots when
 * `isStreaming && visible.length === 0 && !skillInvolved`. That is the 4-5s of dead air measured
 * in #527. It does NOT measure the SKILL-run wait, which renders `ProgressChecklist` — a taller,
 * stage-driven spine that only exists once `stage` SSE events arrive, which requires a billable
 * generator to actually run. The original F-12 sentence was written about a skill run.
 * So: this probe can CONFIRM the geometry defect on the cheap path, and can never CLEAR it on the
 * expensive one. Treat a clean result here as "the prose wait is fine", never as "F-12 is closed".
 *
 * COST: one prose model call per viewport (no generator dispatches, no credits gated).
 *
 * ⚠️ Screenshots on this app: ambient-room animations NEVER settle, so `networkidle` and the
 * default screenshot stabilisation both hang. Always `animations: 'disabled'` + `caret: 'hide'`.
 * ⚠️ `main` is NOT the scroller on /home — a fullPage screenshot stops at the fold. The geometry
 * below is read from getBoundingClientRect, which is immune to that.
 * ⚠️ One browser context PER viewport, opened AT that size. Resizing a loaded page does not give
 * you the mobile UI.
 *
 *   node scripts/mint-auth-state.mjs http://localhost:3015
 *   node scripts/probe-f12-wait-layout.mjs [--url http://localhost:3015] [--ask "..."]
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const BASE = arg('--url', 'http://localhost:3015');
const ASK = arg('--ask', 'why do most morning routines fail');
/** ms to let the thread hydrate before typing. 0 reproduces the mid-hydration artefact. */
const SETTLE = Number(arg('--settle', '3000'));
/** Bail as soon as the wait label is read — see the loop for why this is a cost control. */
const STOP_ON_LABEL = process.argv.includes('--stop-on-label');
const STATE = '.scratch/auth-state.json';
const OUT = path.join(process.cwd(), '.scratch/f12');
fs.mkdirSync(OUT, { recursive: true });

/**
 * Runs in the page. Finds the wait indicator by its TEXT (the surface exposes almost no testids —
 * `[class*="card"]` matched nothing in the 08-13 rewalk, so selector-based counting is unreliable
 * here) and the composer by its textarea, then reports raw geometry.
 */
const MEASURE = () => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // The wait indicator: thread-loading.tsx renders the label as its own span.
  const all = Array.from(document.querySelectorAll('span, div, p'));
  const waitEl =
    all.find((el) => {
      const t = (el.textContent || '').trim();
      return (
        (t === 'Thinking…' ||
          t === 'Thinking...' ||
          /^(Writing|Reading|Finding|Drafting)\b.*…$/.test(t) ||
          // Stage B (B3) labels the dead zone instead of saying "Thinking…" — e.g. "Looks like a
          // hooks run…". Gated on NEXT_PUBLIC_ENGINE_ONE_BRAIN, which ships dark, so this arm only
          // matches when the flag is on. Without it the probe reports the label as ABSENT, which
          // is indistinguishable from the feature being broken.
          /^Looks like\b.*…$/.test(t)) &&
        el.getBoundingClientRect().height > 0
      );
    }) ?? null;

  // The progress spine, if a skill run produced one (it will not on a prose ask).
  const spineEl =
    all.find((el) => el.className && typeof el.className === 'string' && /progress|spine|checklist/i.test(el.className)) ??
    null;

  const composer = document.querySelector('textarea');
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      top: Math.round(b.top),
      bottom: Math.round(b.bottom),
      left: Math.round(b.left),
      height: Math.round(b.height),
      width: Math.round(b.width),
    };
  };

  const waitRect = r(waitEl);
  const composerRect = r(composer);

  // 🔎 DIAGNOSTIC: every short visible string ending in an ellipsis, in document order. A matcher
  // that returns only its FIRST hit cannot tell "the label is absent" from "the label rendered
  // below something else that also matched". Dump the candidates instead of trusting the matcher.
  const ellipses = all
    .filter((el) => {
      const t = (el.textContent || '').trim();
      return t.length > 0 && t.length < 60 && /[…]$/.test(t) && el.getBoundingClientRect().height > 0;
    })
    .map((el) => (el.textContent || '').trim());

  return {
    vw,
    vh,
    waitText: waitEl ? (waitEl.textContent || '').trim().slice(0, 40) : null,
    ellipses: [...new Set(ellipses)],
    wait: waitRect,
    spineFound: !!spineEl,
    composer: composerRect,
    // THE NUMBER THE ROW IS ABOUT: vertical dead space between the wait indicator and the composer.
    gapToComposer: waitRect && composerRect ? composerRect.top - waitRect.bottom : null,
    // How far from the top of the viewport the wait sits. The row says "pinned to the TOP".
    waitFromViewportTop: waitRect ? waitRect.top : null,
  };
};

async function runViewport(label, contextOpts, viewportNote) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...contextOpts, storageState: STATE });
  const page = await context.newPage();

  const samples = [];
  let err = null;
  try {
    // `networkidle` never settles on this app (ambient animations + HMR-less prod still streams).
    await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('textarea', { timeout: 45000 });

    // 🔴 SETTLE FIRST — this is load-bearing, and getting it wrong invented a defect.
    // The textarea mounts BEFORE the thread's history hydrates. A probe that types the instant it
    // appears is sending mid-hydration, which no creator does: they open the thread, read it, then
    // type. Sending at t=0 strands the live turn at the top of a nearly-empty thread and produces a
    // ~640px gap that is an artefact of the probe, not of the product. `--settle 0` reproduces the
    // artefact on purpose, for comparison.
    await page.waitForTimeout(SETTLE);
    const preSendHeight = await page.evaluate(() => document.body.scrollHeight);

    const ta = page.locator('textarea').first();
    await ta.click();
    await ta.fill(ASK);
    await ta.press('Enter');

    // Poll THROUGH the dead air. #527 measured 4-5s to the first character, so sample across it.
    //
    // ⚠️ DENSE EARLY, SPARSE LATE. A first pass polled every 400ms and showed the wait at 103px
    // from the viewport top on the first sample and 669px on the second — i.e. the ~600px void the
    // row describes exists, but somewhere in a 32ms-595ms window it collapses to ~75px. Those two
    // readings support opposite conclusions ("jarring half-second jump" vs "one invisible frame"),
    // so the sampling rate WAS the finding. 50ms for the first second, then 400ms.
    // `--stop-on-label` closes the browser the moment the wait indicator is captured. The B3
    // `predispatch` frame is sent BEFORE the agent loop starts, from the cheap `guessSkill`
    // heuristic — no model call — so one sample is enough to read the label. Bailing there aborts
    // the SSE before a billable generator is invoked, which matters when the ask is skill-shaped.
    const t0 = Date.now();
    let shotEarly = false;
    let shotSettled = false;
    for (let i = 0; i < (STOP_ON_LABEL ? 12 : 20 + 24); i++) {
      const m = await page.evaluate(MEASURE);
      const t = Date.now() - t0;
      samples.push({ t, ...m });
      if (m.wait && !shotEarly) {
        await page.screenshot({ path: path.join(OUT, `${label}-wait-early.png`), animations: 'disabled', caret: 'hide' });
        shotEarly = true;
      }
      // …and the settled frame, which is what the creator actually looks at for the other ~4.5s.
      if (m.wait && !shotSettled && t > 1500) {
        await page.screenshot({ path: path.join(OUT, `${label}-wait-settled.png`), animations: 'disabled', caret: 'hide' });
        shotSettled = true;
      }
      // 🔴 NOT "stop at the first indicator" — that was this probe's second self-inflicted wrong
      // answer. The indicator mounts as the DEFAULT "Thinking…" and is only RELABELLED when the
      // B3 `predispatch` frame lands over SSE a moment later. Breaking on the first sample reads
      // "Thinking…" every time and looks exactly like the feature being off. Stop only once a
      // label that is NOT the default appears — or run out of samples.
      if (STOP_ON_LABEL && m.wait && m.waitText && !/^Thinking/.test(m.waitText)) break;
      await page.waitForTimeout(i < 20 ? 50 : 400);
    }
  } catch (e) {
    err = e.message;
  }

  await browser.close();
  return { label, viewportNote, samples, err };
}

async function main() {
  if (!fs.existsSync(STATE)) {
    console.error(`MISSING ${STATE} — run: node scripts/mint-auth-state.mjs ${BASE}`);
    process.exit(1);
  }

  const runs = [
    await runViewport('desktop', { viewport: { width: 1440, height: 900 } }, '1440x900 native'),
    await runViewport('mobile', { ...devices['iPhone 14'] }, 'iPhone 14 native context'),
  ];

  for (const run of runs) {
    console.log(`\n=== ${run.label} (${run.viewportNote}) — settle ${SETTLE}ms ===`);
    if (run.err) console.log(`  ⚠️ ${run.err}`);
    const withWait = run.samples.filter((s) => s.wait);
    if (!withWait.length) {
      console.log('  wait indicator NEVER observed in 24 samples over ~9.6s.');
      const s = run.samples[0];
      if (s) console.log(`  viewport ${s.vw}x${s.vh}  composer ${JSON.stringify(s.composer)}`);
      console.log('  → Either the answer beat the first poll, or the indicator does not render here.');
      continue;
    }
    const labels = [...new Set(withWait.map((s) => s.waitText))];
    console.log(`  wait indicator seen in ${withWait.length}/${run.samples.length} samples`);
    console.log(`  DISTINCT labels observed: ${labels.map((l) => `"${l}"`).join(' → ')}`);
    const allEllipses = [...new Set(withWait.flatMap((s) => s.ellipses || []))];
    console.log(`  ALL ellipsis strings on screen during the wait: ${allEllipses.map((l) => `"${l}"`).join(' · ') || '(none)'}`);
    console.log(`  viewport ${withWait[0].vw}x${withWait[0].vh}   spine(skill-run) found: ${withWait[0].spineFound}`);
    console.log('   t(ms)  waitTop  waitBottom  composerTop  GAP');
    for (const s of withWait) {
      console.log(
        `  ${String(s.t).padStart(6)}  ${String(s.wait.top).padStart(7)}  ${String(s.wait.bottom).padStart(10)}` +
          `  ${String(s.composer ? s.composer.top : '—').padStart(11)}  ${String(s.gapToComposer ?? '—').padStart(4)}`,
      );
    }
    const gaps = withWait.map((s) => s.gapToComposer).filter((g) => typeof g === 'number');
    if (gaps.length) {
      const min = Math.min(...gaps);
      const max = Math.max(...gaps);
      console.log(`  → gap to composer: ${min}px … ${max}px   (row claims ~600px of dead space)`);
      console.log(`  → wait sits ${withWait[0].waitFromViewportTop}px from viewport top (row claims "pinned to the TOP")`);
    }
  }

  console.log(`
⚠️ SCOPE: this is the PURE-CHAT wait ("Thinking…", thread-turn.tsx:315) — the 4-5s of dead air
   measured in #527. The SKILL-run wait renders ProgressChecklist, a taller stage-driven spine that
   needs a billable generator to exist. F-12's original sentence was written about a skill run.
   A clean result here means "the prose wait is fine". It CANNOT close F-12.
   Screenshots: .scratch/f12/*.png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
