#!/usr/bin/env node
/**
 * Build the rev-7.5-mock vs shipped-rail comparison page as a publishable Artifact.
 *
 *   node scripts/build-insights-compare-artifact.mjs [out.html]
 *
 * WHY a build step. Same CSP as the review artifact (see build-insights-review-artifact.mjs):
 * no CDN fonts, no external images, no relative paths. Ten full-length rail captures at 880px
 * native cost ~3MB as PNG base64; re-encoded to JPEG they cost ~1.8MB and stay legible at 1:1
 * (checked on the densest block — the nine-signal grid).
 *
 * WHERE THE CAPTURES COME FROM.
 *   rev7-*.png   the mockup, 6 states, shot at rev 7.5 (commit cdfd50cb)
 *   live-*.png   /ambient-v2 -> (2) brain -> creator LIVE adapter / creator TEXT sim, 4 states,
 *                shot 2026-08-01 off this branch with the internal scroller expanded to full
 *                content height.
 *
 * ONE CAPTURE CAVEAT, stated on the page too: the shipped rail reveals on scroll (inline
 * opacity:0/translateY(20px) -> 1). Expanding the scroller without scrolling leaves ~23 nodes
 * invisible and the signal grid + per-second heatmap read as blank voids. The shoot walks the
 * scroller, then forces any surviving reveal to its end state. Every live shot here is the
 * fully-revealed rail, which is what a user sees after scrolling — not a first-paint state.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { chromium } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const REF = `${ROOT}docs/mockups/reference-2026-08-01/`;
const OUT = process.argv[2] || `${process.env.TMPDIR || "/tmp"}/insights-compare.html`;

const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400..600" +
  "&family=Newsreader:opsz,wght@6..72,400&display=swap";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";

/** side · fixture · tab label · what leads the page · the file */
const SHOTS = [
  ["live", "video", "The brain", "Predicted cortex — live WebGL", "live-video-brain.png"],
  ["live", "video", "The audience", "The read", "live-video-audience.png"],
  ["live", "text", "The brain", "Predicted cortex — no video substrate", "live-text-brain.png"],
  ["live", "text", "The audience", "The read", "live-text-audience.png"],
  ["mock", "video", "Overview", "Cortex hero — “at the break”", "rev7-video-overview.png"],
  ["mock", "video", "Audience", "Terrain hero — 90% non-followers", "rev7-video-audience.png"],
  ["mock", "video", "Engagement", "Retention instrument", "rev7-video-engagement.png"],
  ["mock", "text", "Overview", "Cortex hero", "rev7-text-overview.png"],
  ["mock", "text", "Audience", "Terrain hero", "rev7-text-audience.png"],
  ["mock", "text", "Engagement", "The voices", "rev7-text-engagement.png"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent("<body></body>");

const img = {};
for (const s of SHOTS) {
  const file = s[4];
  const src = `data:image/png;base64,${readFileSync(REF + file).toString("base64")}`;
  img[file] = await page.evaluate(async (src) => {
    const i = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
    const cv = document.createElement("canvas");
    cv.width = i.naturalWidth;
    cv.height = i.naturalHeight;
    cv.getContext("2d").drawImage(i, 0, 0);
    return { uri: cv.toDataURL("image/jpeg", 0.6), w: i.naturalWidth, h: i.naturalHeight };
  }, src);
  console.log(`  ${file} ${img[file].w}x${img[file].h} -> ${(img[file].uri.length / 1024).toFixed(0)}KB`);
}

const gf = await (await ctx.request.get(FONT_CSS, { headers: { "user-agent": UA } })).text();
let fontFaces = "";
for (const blk of gf.split("@font-face").slice(1).map((s) => s.split("}")[0])) {
  if (!/unicode-range:[^;]*U\+0000-00FF/.test(blk)) continue; // latin only
  const url = (blk.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
  if (!url) continue;
  const fam = (blk.match(/font-family:\s*'([^']+)'/) || [])[1];
  const wt = (blk.match(/font-weight:\s*([^;]+);/) || [])[1] || "400";
  const buf = await (await ctx.request.get(url)).body();
  fontFaces +=
    `@font-face{font-family:'${fam}';font-style:normal;font-weight:${wt};font-display:swap;` +
    `src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');}\n`;
  console.log(`  ${fam} ${wt} -> ${(buf.length / 1024).toFixed(0)}KB`);
}
await browser.close();

/** CSS px = native / 2 (every capture is deviceScaleFactor 2 at a 440px rail). */
const cssH = (f) => Math.round(img[f].h / 2);
const tallest = Math.max(...SHOTS.map((s) => cssH(s[4])));

const figure = ([side, fixture, tab, leads, file]) => `
  <figure class="shot" data-fixture="${fixture}">
    <figcaption>
      <span class="tab">${tab}</span>
      <span class="leads">${leads}</span>
      <span class="px">${cssH(file)}<i>px</i></span>
    </figcaption>
    <div class="ruler" aria-hidden="true"><span style="height:${(cssH(file) / tallest) * 100}%"></span></div>
    <button type="button" class="plate" data-src="${file}" aria-label="Open ${tab} at full size">
      <img src="${img[file].uri}" alt="${side === "live" ? "Shipped rail" : "Rev 7.5 mock"} — ${tab} tab, ${fixture} fixture" loading="lazy" width="440" height="${cssH(file)}">
    </button>
  </figure>`;

const col = (side) => SHOTS.filter((s) => s[0] === side).map(figure).join("");

const LEDGER = [
  [
    "Tabs",
    "2 — <b>The brain</b> · <b>The audience</b>",
    "3 — <b>Overview</b> · <b>Audience</b> · <b>Engagement</b>",
    "The timeline instrument moves out of the brain tab and becomes Engagement’s hero; the answer moves to Overview.",
  ],
  [
    "Page weight",
    "2 025 – 2 278 px per tab",
    "1 044 – 1 273 px per tab",
    "The shipped rail is the <em>denser</em> surface — roughly 1.8×. The mock is not adding material, it is cutting it.",
  ],
  [
    "Chrome",
    "Mono uppercase section rules, hairline-heavy",
    "Plain-text card headers, sticky tabbar, identity row above it",
    "TikTok Studio idiom: identity once, then sticky tabs inside the scroll.",
  ],
  [
    "Copy",
    "Full sentences under each figure",
    "≤6-word fragments; reads annotated on the figure",
    "The rev 7.1 bar — numbers in tiles, type only points.",
  ],
  [
    "The answer",
    "A serif verdict line at the foot of the brain tab",
    "One answer block on Overview: verdict + one clause + a routing fix chip",
    "Appears exactly once, and the chip jumps to the evidence.",
  ],
  [
    "Figures",
    "Cortex on brain; terrain on audience",
    "Cortex / terrain / the post itself — each exactly once",
    "Same two heroes kept, plus the playing post as Engagement’s instrument.",
  ],
];

const ONLY_LIVE = [
  ["The nine breakdown signals", "9 scored cells — Visual Pull 68 · Voice Impact 37 · Cognitive Grip 50 …"],
  ["Raw network activation", "7 σ bars, z-scored vs the clip’s own baseline"],
  ["Activation per second", "10 systems × the clip, one cell per second"],
  ["The unlock", "“Fix too slow” + a projected <b>+9% would stop</b>"],
  ["How to read these numbers", "The disclosure block under the numbers"],
  ["Who spreads it", "Modeled reach — saw it · reshared · their networks"],
  ["The swing · confidence", "Room-level confidence footer"],
];

const ONLY_MOCK = [
  ["Identity row", "Thumb · title · TikTok 5-stat row · a quiet “projected” tag — once, above the tabs"],
  ["Key metrics tiles", "Label · big number · delta vs the creator’s own median"],
  ["The routing fix chip", "Video → Engagement parked on the break; text → “Why they stopped”"],
  ["The retention instrument", "Mini post + playhead-synced progress line + curve + moment chips + one-line transcript"],
  ["Where it would surface", "Traffic sources, on Overview"],
  ["Best window", "7–9pm sitting on the Tue bar"],
];

const row = ([a, b, c, d]) => `<tr><th scope="row">${a}</th><td>${b}</td><td>${c}</td><td class="why">${d}</td></tr>`;
const item = ([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`;

const body = `
<div class="page">

  <header class="masthead">
    <p class="eyebrow">Insight drill · comparison bench</p>
    <h1>What renders today, next to rev&nbsp;7.5</h1>
    <p class="standfirst">
      The shipped rail and the mock, both at their true 440&nbsp;px, both at full content height.
      Captured 1&nbsp;August&nbsp;2026 off <code>task/insights-rework</code>.
    </p>
    <dl class="meta">
      <div><dt>Shipped</dt><dd><code>/ambient-v2</code> → ② brain → creator LIVE&nbsp;/&nbsp;TEXT</dd></div>
      <div><dt>Mock</dt><dd>rev 7.5 · <code>cdfd50cb</code></dd></div>
      <div><dt>Status</dt><dd>Awaiting your adjustments — nothing is built in <code>src/</code> yet</dd></div>
    </dl>
  </header>

  <section class="voice">
    <p class="quote">Nobody wants to read all these sentences — it doesn’t feel nice to read the UI.</p>
    <p class="attrib">The note that started rev 7. Everything on the right is downstream of it.</p>
  </section>

  <section class="ledger">
    <h2>The structural delta</h2>
    <div class="scroller">
      <table>
        <thead>
          <tr><th scope="col"></th><th scope="col">Shipped today</th><th scope="col">Rev 7.5</th><th scope="col">Why it moved</th></tr>
        </thead>
        <tbody>${LEDGER.map(row).join("")}</tbody>
      </table>
    </div>
  </section>

  <section class="lists">
    <div class="panel loss">
      <h3>Only on the shipped rail</h3>
      <p class="note">Material the mock currently drops. Each one is a decision to confirm or reverse.</p>
      <ul>${ONLY_LIVE.map(item).join("")}</ul>
    </div>
    <div class="panel gain">
      <h3>Only in the mock</h3>
      <p class="note">New structure, none of it built yet.</p>
      <ul>${ONLY_MOCK.map(item).join("")}</ul>
    </div>
  </section>

  <section class="bench" id="bench" data-fixture="video">
    <div class="switch" role="group" aria-label="Fixture">
      <span class="switch-label">Fixture</span>
      <button type="button" data-set="video" aria-pressed="true">Video</button>
      <button type="button" data-set="text" aria-pressed="false">Text</button>
      <span class="hint">Both sides swap together</span>
    </div>

    <div class="cols">
      <div class="col">
        <div class="colhead"><h2>Shipped today</h2><p>2 tabs · the rail as it renders</p></div>
        ${col("live")}
      </div>
      <div class="col">
        <div class="colhead"><h2>Rev 7.5</h2><p>3 tabs · the mock</p></div>
        ${col("mock")}
      </div>
    </div>
  </section>

  <section class="caveats">
    <h2>Two things the capture turned up</h2>
    <ol>
      <li>
        <b>The shipped rail is denser than the mock, not sparser.</b>
        Handoff §2 records it as “thin and sparse below the hero” — that reading is stale. The
        grounded-cortex wiring on this branch switched on three grounded-only sections (σ bars,
        the per-second heatmap, the attention curve) that did not render when §2 was written.
      </li>
      <li>
        <b>The rail reveals on scroll.</b> Every block enters at <code>opacity:0 / translateY(20px)</code>.
        A capture that expands the scroller without walking it renders the signal grid and the
        heatmap as blank voids. The live shots here are walked and then forced to the end state —
        what you see after scrolling, not at first paint.
      </li>
    </ol>
  </section>
</div>

<div class="lightbox" id="lb" hidden>
  <button type="button" class="lb-close" aria-label="Close">Close ✕</button>
  <div class="lb-scroll"><img alt=""></div>
</div>`;

const css = `
:root{
  --ground:#141413; --panel:#1f1f1e; --well:#262624;
  --cream:#ece7de; --dim:rgba(236,231,222,.55); --faint:rgba(236,231,222,.30);
  --line:rgba(255,255,255,.06); --line-2:rgba(255,255,255,.10);
  --coral:#FF6363;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --serif:'Newsreader',Georgia,serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
}
/* The subject is a dark-UI rail; the bench deliberately stays on the product's own ground in
   both themes so the captures are never judged against a surface they will never sit on. */
:root[data-theme="light"],:root[data-theme="dark"]{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--cream);font-family:var(--sans);
  font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
.page{max-width:1160px;margin:0 auto;padding:64px 28px 96px;display:flex;flex-direction:column;gap:64px}
h1,h2,h3{margin:0;font-weight:500;letter-spacing:-.012em;text-wrap:balance}
p{margin:0}
code{font-family:var(--mono);font-size:.88em;color:var(--dim)}
b{font-weight:500}

.masthead{display:flex;flex-direction:column;gap:14px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
h1{font-size:34px;line-height:1.15}
.standfirst{max-width:62ch;color:var(--dim)}
.meta{display:flex;flex-wrap:wrap;gap:10px 32px;margin:10px 0 0;padding-top:18px;border-top:1px solid var(--line)}
.meta div{display:flex;flex-direction:column;gap:3px}
.meta dt{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.meta dd{margin:0;font-size:13.5px;color:var(--dim)}

.voice{border-left:2px solid var(--line-2);padding-left:22px;display:flex;flex-direction:column;gap:8px}
.quote{font-family:var(--serif);font-size:24px;line-height:1.32;letter-spacing:-.01em;max-width:34ch}
.attrib{font-size:13px;color:var(--faint)}

.ledger h2,.caveats h2{font-size:13px;font-family:var(--mono);letter-spacing:.12em;
  text-transform:uppercase;color:var(--faint);margin-bottom:18px}
.scroller{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:720px}
thead th{background:var(--well);text-align:left;padding:11px 16px;font-weight:400;
  font-family:var(--mono);font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--faint)}
tbody th,tbody td{padding:14px 16px;vertical-align:top;border-top:1px solid var(--line)}
tbody th{font-weight:400;color:var(--cream);white-space:nowrap;width:1%;text-align:left}
tbody td{color:var(--dim)}
td.why{color:var(--faint);font-size:12.5px}

.lists{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}
.panel{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:22px}
.panel h3{font-size:15px;margin-bottom:6px}
.panel .note{font-size:12.5px;color:var(--faint);margin-bottom:16px}
.panel ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.panel li{display:flex;flex-direction:column;gap:2px;padding-left:14px;position:relative;font-size:13px}
.panel li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;border-radius:50%}
.loss li::before{background:var(--coral)}
.gain li::before{background:var(--cream)}
.panel li span{color:var(--dim)}

.bench{display:flex;flex-direction:column;gap:22px}
.switch{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:10px}
.switch-label{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.switch button{font:inherit;font-size:13px;color:var(--dim);background:transparent;
  border:1px solid var(--line);border-radius:8px;padding:5px 14px;cursor:pointer;transition:.14s}
.switch button:hover{border-color:var(--line-2);color:var(--cream)}
.switch button[aria-pressed="true"]{background:var(--well);color:var(--cream);border-color:var(--line-2)}
.hint{margin-left:auto;font-size:12px;color:var(--faint)}

.cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;align-items:start}
.col{display:flex;flex-direction:column;gap:26px;min-width:0}
.colhead{display:flex;flex-direction:column;gap:2px;padding-bottom:12px;border-bottom:1px solid var(--line-2)}
.colhead h2{font-size:17px}
.colhead p{font-size:12.5px;color:var(--faint)}

/* The plate is pinned to 440px — the rail's real width (AmbientDetail.tsx:321). Letting it
   stretch to the column would upscale both captures and quietly misreport the scale being judged. */
/* Track 1 is a FIXED 2px, not auto: the figcaption spans both tracks, and an auto track absorbs
   its min-content width — which silently shrank the plate to 371-400px, i.e. the two captures were
   being compared at different scales. 2 + 12 gap + 440 = 454. */
.shot{margin:0;display:grid;grid-template-columns:2px minmax(0,440px);grid-template-rows:auto auto;
  column-gap:12px;row-gap:8px;max-width:454px}
.shot[hidden]{display:none}
.shot figcaption{grid-column:1/-1;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.tab{font-size:14px;color:var(--cream)}
.leads{font-size:12px;color:var(--faint);flex:1;min-width:0}
.px{font-family:var(--mono);font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}
.px i{font-style:normal;color:var(--faint);margin-left:2px}
.ruler{grid-column:1;width:2px;background:var(--line);border-radius:2px;display:flex;align-items:flex-start}
.ruler span{display:block;width:100%;background:var(--line-2);border-radius:2px}
.plate{grid-column:2;padding:0;margin:0;border:1px solid var(--line);border-radius:12px;
  background:#181817;overflow:hidden;cursor:zoom-in;display:block;width:100%;transition:border-color .14s}
.plate:hover{border-color:var(--line-2)}
.plate img{display:block;width:100%;height:auto}

.caveats ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:14px;
  font-size:13.5px;color:var(--dim);max-width:74ch}
.caveats li::marker{color:var(--faint);font-family:var(--mono);font-size:12px}
.caveats b{color:var(--cream)}

.lightbox{position:fixed;inset:0;z-index:50;background:rgba(10,10,9,.94);display:flex;
  flex-direction:column;align-items:center}
.lightbox[hidden]{display:none}
.lb-close{align-self:flex-end;margin:14px 18px;font:inherit;font-size:13px;color:var(--dim);
  background:var(--panel);border:1px solid var(--line-2);border-radius:8px;padding:6px 14px;cursor:pointer}
.lb-close:hover{color:var(--cream)}
.lb-scroll{flex:1;overflow:auto;width:100%;display:flex;justify-content:center;padding:0 16px 32px}
.lb-scroll img{width:440px;max-width:100%;height:auto;align-self:flex-start;
  border:1px solid var(--line);border-radius:12px}

:where(button,a):focus-visible{outline:2px solid var(--cream);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media (max-width:900px){
  .page{padding:44px 18px 72px;gap:48px}
  h1{font-size:27px}
  .cols{grid-template-columns:minmax(0,1fr);gap:44px}
}`;

const js = `
(function(){
  var bench=document.getElementById('bench');
  var shots=[].slice.call(bench.querySelectorAll('.shot'));
  function apply(f){
    bench.dataset.fixture=f;
    shots.forEach(function(s){ s.hidden = s.dataset.fixture!==f; });
    bench.querySelectorAll('.switch button').forEach(function(b){
      b.setAttribute('aria-pressed', String(b.dataset.set===f));
    });
  }
  bench.querySelectorAll('.switch button').forEach(function(b){
    b.addEventListener('click',function(){ apply(b.dataset.set); });
  });
  apply('video');

  var lb=document.getElementById('lb'), lbImg=lb.querySelector('img');
  function close(){ lb.hidden=true; lbImg.removeAttribute('src'); document.body.style.overflow=''; }
  document.querySelectorAll('.plate').forEach(function(p){
    p.addEventListener('click',function(){
      var src=p.querySelector('img');
      lbImg.src=src.src; lbImg.alt=src.alt;
      lb.hidden=false; document.body.style.overflow='hidden';
      lb.querySelector('.lb-close').focus();
    });
  });
  lb.querySelector('.lb-close').addEventListener('click',close);
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.parentNode.className==='lb-scroll') close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!lb.hidden) close(); });
})();`;

// No <!DOCTYPE>/<html>/<head>/<body> — the Artifact publisher supplies that skeleton.
writeFileSync(
  OUT,
  `<title>Insight drill — shipped rail vs rev 7.5</title>\n<style>\n${fontFaces}\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`,
);
console.log(`\n-> ${OUT}  ${(statSync(OUT).size / 1024 / 1024).toFixed(2)}MB`);
