// Builds a standalone HTML sketch of the reworked Discover from the REAL data.
// Collections come from `teardown_collections` (the curated taxonomy), NOT derived
// from the teardown columns. Honesty rules mirror the shipped ones (prompt.ts
// receipt/fmtMultiplier, retrieve.ts hasKnownBaseline/honestMultiplier,
// outlier-gate MIN_OUTLIER_MULTIPLIER).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd(); // run from the repo root
const { teardowns, memberships, watched } = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.scratch/corpus.json'), 'utf8'),
);

// Shelf order = value order. Formats first (biggest + most legible to a creator).
const CATS = [
  { id: 'formats', label: 'Formats', blurb: 'The shape of the whole video.' },
  { id: 'visual_hooks', label: 'Visual hooks', blurb: 'What the first frame does to stop the scroll.' },
  { id: 'editing_styles', label: 'Editing styles', blurb: 'How the cut carries the story.' },
  { id: 'signature_series', label: 'Signature series', blurb: 'Repeatable formats a creator owns.' },
];

const DURABLE = (u) => !!u && /supabase\.co|ytimg\.com/.test(u);
const byId = new Map(teardowns.map((t) => [t.id, t]));

// ── the shipped honesty gate ───────────────────────────────────────────────
const MIN_PROVEN = 3;
const honest = (m) => {
  const n = typeof m === 'string' ? parseFloat(m) : m;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};
function receiptOf(r) {
  const m = honest(r.outlier_multiplier);
  const baselined = Boolean(r.baseline_label && String(r.baseline_label).trim());
  const showNumber = baselined && m !== null && m >= 1;
  return {
    proven: baselined && m !== null && m >= MIN_PROVEN,
    showNumber,
    mult: showNumber ? (m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`) : null,
    // Above ~100× the ratio is a thin-baseline artifact, not a signal to trust.
    // Still shown (it is the source's own number) but never in proven-green.
    extreme: showNumber && m >= 100,
    basis: r.baseline_label ?? null,
  };
}
const fmtViews = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
};
const ago = (iso) => {
  if (!iso) return null;
  const d = Math.floor((Date.parse('2026-08-01') - Date.parse(iso)) / 86400000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

// ── collections, read from the curated table ───────────────────────────────
const grouped = new Map();
for (const m of memberships) {
  const key = m.category + '|' + m.name;
  if (!grouped.has(key)) grouped.set(key, { ...m, ids: [] });
  grouped.get(key).ids.push(m.teardown_id);
}
const collections = [...grouped.values()].map((c, idx) => {
  const items = c.ids.map((id) => byId.get(id)).filter(Boolean)
    // Views, not multiplier: sorting by ratio puts thin-baseline artifacts on top.
    .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  return {
    idx,
    cat: c.category,
    sub: c.subcategory || null,
    name: c.name,
    n: c.ids.length,
    proven: items.filter((r) => receiptOf(r).proven).length,
    covers: items.filter((r) => DURABLE(r.cover_url)).slice(0, 4).map((r) => r.cover_url),
    items: items.slice(0, 16).map((r) => ({
      cover: r.cover_url, durable: DURABLE(r.cover_url),
      hook: r.hook_template || r.spoken_hook || '',
      handle: r.creator_handle,
      arch: r.hook_archetype ? r.hook_archetype.replace(/[-_]+/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()) : null,
      views: fmtViews(r.views), when: ago(r.posted_at),
      why: r.why_it_works ? r.why_it_works.slice(0, 190) : null,
      ...receiptOf(r),
    })),
  };
}).filter((c) => c.items.length > 0);

// ── the one real slice of scraped_videos: watched-channel outliers ─────────
const perCreator = new Map();
const yours = watched
  .filter((w) => w.metadata?.cover_url)
  .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
  // Max 2 per creator. Unpicked, one prolific account takes the whole shelf
  // (khaby.lame held 6 of 8 slots) and the shelf stops reading as "your creators".
  .filter((w) => {
    const n = (perCreator.get(w.creator_handle) ?? 0) + 1;
    perCreator.set(w.creator_handle, n);
    return n <= 2;
  })
  .slice(0, 10)
  .map((w) => ({
    cover: w.metadata.cover_url,
    caption: (w.description || 'Untitled').slice(0, 80),
    handle: w.creator_handle,
    views: fmtViews(w.views), when: ago(w.posted_at),
    ...receiptOf(w),
  }));

const totals = {
  videos: teardowns.length,
  collections: collections.length,
  creators: new Set(teardowns.map((t) => t.creator_handle)).size,
  proven: teardowns.filter((t) => receiptOf(t).proven).length,
};
const DATA = JSON.stringify({ collections, yours, totals, cats: CATS });

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discover — rework sketch v2</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--app:#1f1f1e;--chip:#2c2c2b;--thread:#252524;--composer:#1a1a19;
 --fg:#ece7de;--fg2:#c2bdb4;--fg3:#8a857c;--accent:#FF6363;--action:#ece7de;--action-fg:#1c1b19;
 --positive:#8ea68a;--border:rgba(255,255,255,.06);--border-h:rgba(255,255,255,.10)}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--app);color:var(--fg);font:400 14px/1.5 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.app{display:grid;grid-template-columns:232px 1fr;min-height:100vh}
.rail{background:var(--chip);border-right:1px solid var(--border);padding:14px 10px;display:flex;flex-direction:column;gap:2px}
.logo{color:var(--accent);font-weight:700;font-size:15px;padding:6px 8px 14px}
.nav{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;color:var(--fg2);font-size:13px;font-weight:500;cursor:pointer}
.nav.on{background:rgba(255,255,255,.06);color:var(--fg)}
.rail .hr{height:1px;background:var(--border);margin:10px 4px}
.rail .lab{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--fg3);padding:12px 9px 5px;font-weight:600}
main{padding:26px 0 90px 34px;max-width:1240px}
.pad{padding-right:34px}
h1{font-size:22px;font-weight:600;letter-spacing:-.01em}
.sub{color:var(--fg3);font-size:13px;margin-top:3px}
.omni{display:flex;gap:8px;margin:18px 0 6px}
.omni .field{flex:1;display:flex;align-items:center;gap:9px;background:var(--composer);border:1px solid var(--border);border-radius:8px;padding:0 12px;height:42px}
.omni input{flex:1;background:none;border:0;outline:0;color:var(--fg);font:400 14px Inter,sans-serif}
.omni input::placeholder{color:var(--fg3)}
.pullbtn{height:42px;padding:0 15px;border-radius:8px;background:var(--chip);border:1px solid var(--border);color:var(--fg2);font:600 13px Inter;display:flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap}
.cost{font-size:11px;color:var(--fg3);padding:2px 6px;border-radius:5px;background:rgba(255,255,255,.06)}
.omnihint{font-size:11.5px;color:var(--fg3);margin-bottom:26px}
.omnihint b{color:var(--fg2);font-weight:600}

/* ── shelves ── */
.shelf{margin-bottom:30px}
.shead{display:flex;align-items:baseline;gap:9px;margin-bottom:2px}
.shead h2{font-size:14px;font-weight:600;letter-spacing:-.005em}
.shead .subs{font-size:11.5px;color:var(--fg3)}
.shead .more{margin-left:auto;font-size:12px;color:var(--fg3);cursor:pointer;font-weight:500;white-space:nowrap}
.shead .more:hover{color:var(--fg)}
.sblurb{font-size:12px;color:var(--fg3);margin-bottom:12px}
.track{display:flex;gap:13px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.track::-webkit-scrollbar{display:none}
.track>*{flex:0 0 232px}
.track.wrap{flex-wrap:wrap;overflow:visible}

.col{background:var(--thread);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s}
.col:hover{border-color:var(--border-h);transform:translateY(-1px)}
.mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:80px 80px;gap:1px;background:rgba(255,255,255,.05)}
.mosaic>*{min-width:0;min-height:0;overflow:hidden}
.mosaic img{width:100%;height:100%;object-fit:cover;display:block}
.mosaic .ph{background:linear-gradient(150deg,#312f2b,#1c1b19)}
.colb{padding:10px 12px 12px}
.kick{font-size:9.5px;letter-spacing:.085em;text-transform:uppercase;color:var(--fg3);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.colt{font-size:13.5px;font-weight:600;margin:4px 0 8px;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.colm{display:flex;gap:6px}
.pill{font-size:10.5px;font-weight:500;padding:2.5px 7px;border-radius:5px;background:rgba(255,255,255,.06);color:var(--fg3);font-variant-numeric:tabular-nums}
.pill.proven{background:rgba(142,166,138,.14);color:var(--positive)}

/* video card (the "yours" shelf) */
/* Cover height matches the collection mosaic (161px) so every shelf shares one
   card rhythm. At 9:16 these ran 306px tall and the watch shelf swamped the
   library it exists to introduce. */
.vid{background:var(--thread);border:1px solid var(--border);border-radius:12px;overflow:hidden;flex:0 0 176px!important}
.vid img{width:100%;height:161px;object-fit:cover;display:block}
.vb{padding:9px 10px 11px}
.vcap{font-size:12.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vmeta{display:flex;justify-content:space-between;font-size:11px;color:var(--fg3);margin:5px 0 7px}
.vp{display:flex;gap:5px}

/* empty-watchlist invitation */
.invite{display:flex;align-items:center;gap:14px;border:1px dashed rgba(255,255,255,.13);border-radius:12px;padding:15px 17px}
.invite p{font-size:12.5px;color:var(--fg3);flex:1}
.btn{font:600 12.5px Inter;padding:8px 13px;border-radius:8px;background:var(--action);color:var(--action-fg);border:0;cursor:pointer}

/* drill-in */
.back{display:inline-flex;gap:6px;font-size:12.5px;color:var(--fg3);cursor:pointer;margin-bottom:14px;background:none;border:0;font-family:inherit}
.back:hover{color:var(--fg)}
.rows{display:flex;flex-direction:column;gap:8px}
.row{display:flex;align-items:center;gap:14px;background:var(--thread);border:1px solid var(--border);border-radius:12px;padding:10px 14px 10px 10px}
.row:hover{border-color:var(--border-h)}
.thumb{width:60px;height:80px;border-radius:7px;object-fit:cover;flex:none;background:linear-gradient(150deg,#312f2b,#1c1b19)}
.rowb{flex:1;min-width:0}
.hook{font-size:14px;line-height:1.4}
.by{font-size:12px;color:var(--fg3);margin-top:3px}
.rowm{display:flex;align-items:center;gap:7px;flex:none}
.chip{font-size:11px;font-weight:500;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,.06);color:var(--fg2)}
.mult{font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(142,166,138,.14);color:var(--positive);font-variant-numeric:tabular-nums}
.mult.cur{background:rgba(255,255,255,.06);color:var(--fg3);font-weight:500}
.views{font-size:11.5px;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,.06);color:var(--fg3);font-variant-numeric:tabular-nums}
.remix{font:600 12px Inter;padding:7px 12px;border-radius:7px;background:var(--action);color:var(--action-fg);border:0;cursor:pointer;flex:none}
.hide{display:none}
.note{border:1px dashed rgba(255,255,255,.12);border-radius:10px;padding:13px 15px;color:var(--fg3);font-size:12.5px;line-height:1.6;margin-top:8px}
.note b{color:var(--fg2);font-weight:600}
</style></head><body>
<div class="app">
  <aside class="rail">
    <div class="logo">◠◠</div><div class="nav">＋ New Thread</div><div class="hr"></div>
    <div class="nav on">◎ Discover</div><div class="nav">◍ Audience</div><div class="nav">▤ Library</div>
    <div class="lab">Threads</div>
    <div class="nav" style="font-weight:400">3 hooks for …</div>
    <div class="nav" style="font-weight:400">morning routine …</div>
  </aside>
  <main>
    <div class="pad">
      <h1>Discover</h1>
      <p class="sub" id="sub"></p>
      <div class="omni">
        <div class="field"><span style="color:var(--fg3)">⌕</span>
          <input id="q" placeholder="Search proven videos, formats, hooks — or paste a @handle"></div>
        <button class="pullbtn">Pull live <span class="cost">5 credits</span></button>
      </div>
      <p class="omnihint">Searching the library is instant and free. <b>Pull live</b> only lights up for a handle or URL we don't already hold — that one spends credits, and says so before you press it.</p>
    </div>
    <div id="shelves"></div>
    <div id="detail" class="hide pad"></div>
  </main>
</div>
<script>
const D = ${DATA};
const $ = (s) => document.querySelector(s);
$('#sub').textContent = D.totals.videos + ' torn-down videos · ' + D.totals.collections +
  ' collections · ' + D.totals.creators + ' creators · ' + D.totals.proven + ' clear the 3× proof bar';

const CATLABEL = {formats:'FORMATS',visual_hooks:'VISUAL HOOKS',editing_styles:'EDITING STYLES',signature_series:'SIGNATURE SERIES'};
function mosaic(cv){let h='<div class="mosaic">';for(let i=0;i<4;i++)h+=cv[i]?'<img loading="lazy" src="'+cv[i]+'" alt="">':'<div class="ph"></div>';return h+'</div>';}
function colCard(c){
  const kick = CATLABEL[c.cat] + (c.sub ? ' · ' + c.sub.toUpperCase() : '');
  return '<article class="col" data-i="'+c.idx+'">'+mosaic(c.covers)+
   '<div class="colb"><div class="kick" title="'+kick+'">'+kick+'</div>'+
   '<div class="colt" title="'+c.name+'">'+c.name+'</div><div class="colm">'+
   '<span class="pill">'+c.n+' video'+(c.n===1?'':'s')+'</span>'+
   (c.proven?'<span class="pill proven">'+c.proven+' proven</span>':'')+'</div></div></article>';
}
function vidCard(v){
  return '<article class="vid"><img loading="lazy" src="'+v.cover+'" alt="">'+
   '<div class="vb"><div class="vcap">'+v.caption+'</div>'+
   '<div class="vmeta"><span>@'+v.handle+'</span><span>'+(v.when||'')+'</span></div><div class="vp">'+
   (v.showNumber&&!v.extreme?'<span class="mult">▲ '+v.mult+'</span>':'')+
   '<span class="views">◉ '+v.views+'</span></div></div></article>';
}
function render(filter){
  const f=(filter||'').trim().toLowerCase();
  let html='';
  // Shelf 1 — the user's own material leads. Empty watchlist reads as an invitation.
  if(!f){
    html+='<section class="shelf pad"><div class="shead"><h2>From creators you watch</h2>'+
      '<span class="subs">'+D.yours.length+' recent outliers · 5 creators</span>'+
      '<span class="more" id="mgr">Manage sources →</span></div>'+
      '<p class="sblurb">Measured against each creator\\'s own baseline — the only part of the old feed with a real signal behind it.</p>'+
      (D.yours.length
        ? '<div class="track">'+D.yours.map(vidCard).join('')+'</div>'
        : '<div class="invite"><p>You\\'re not watching anyone yet. Add a creator and their outliers land here.</p><button class="btn">Add a creator</button></div>')+
      '</section>';
  }
  for(const cat of D.cats){
    const list=D.collections.filter(c=>c.cat===cat.id&&(!f||c.name.toLowerCase().includes(f)||(c.sub||'').toLowerCase().includes(f)))
      .sort((a,b)=>b.n-a.n);
    if(!list.length) continue;
    const subs=[...new Set(list.map(c=>c.sub).filter(Boolean))];
    html+='<section class="shelf"><div class="shead pad"><h2>'+cat.label+'</h2>'+
      (subs.length?'<span class="subs">'+subs.slice(0,3).join(' · ')+(subs.length>3?' · +'+(subs.length-3):'')+'</span>':'')+
      '<span class="more">See all '+list.length+' →</span></div>'+
      '<p class="sblurb pad">'+cat.blurb+'</p>'+
      '<div class="track'+(f?' wrap':'')+'" style="'+(f?'':'padding-right:34px')+'">'+list.map(colCard).join('')+'</div></section>';
  }
  $('#shelves').innerHTML = html || '<div class="pad"><div class="note">Nothing in the library matches that. Paste a <b>@handle</b> above to pull it live instead.</div></div>';
  document.querySelectorAll('.col').forEach(el=>el.onclick=()=>detail(+el.dataset.i));
}
function detail(i){
  const c=D.collections.find(x=>x.idx===i);
  const kick=CATLABEL[c.cat]+(c.sub?' · '+c.sub.toUpperCase():'');
  const rows=c.items.map(t=>{
    const thumb=t.durable?'<img class="thumb" loading="lazy" src="'+t.cover+'" alt="">':'<div class="thumb"></div>';
    const mult=!t.showNumber
      ?'<span class="mult cur" title="No baseline recorded — no claim made">curated</span>'
      :t.extreme
        ?'<span class="mult cur" title="Ratio against a very thin baseline — shown, but not treated as proof">'+t.mult+' ⚠</span>'
        :'<span class="mult">▲ '+t.mult+'</span>';
    return '<div class="row">'+thumb+'<div class="rowb"><div class="hook">'+(t.hook||'—')+'</div>'+
      '<div class="by">Inspired by @'+(t.handle||'unknown')+(t.showNumber?' · '+t.mult+' '+t.basis:'')+(t.when?' · '+t.when:'')+'</div></div>'+
      '<div class="rowm">'+(t.arch?'<span class="chip">'+t.arch+'</span>':'')+mult+
      '<span class="views">◉ '+t.views+'</span><button class="remix">Remix →</button></div></div>';
  }).join('');
  $('#detail').innerHTML='<button class="back" id="bk">← Discover</button>'+
    '<div class="kick" style="margin-bottom:3px">'+kick+'</div>'+
    '<div class="shead"><h2 style="font-size:20px">'+c.name+'</h2><span class="subs">'+c.n+' videos · '+c.proven+' proven</span></div>'+
    '<p class="sblurb">Every row is a real video we tore down. The number is measured against that creator\\'s own usual views — a row with no baseline says <b>curated</b> and makes no claim.</p>'+
    '<div class="rows">'+rows+'</div>';
  $('#shelves').classList.add('hide');$('#detail').classList.remove('hide');
  $('#bk').onclick=()=>{$('#detail').classList.add('hide');$('#shelves').classList.remove('hide')};
  window.scrollTo(0,0);
}
$('#q').oninput=(e)=>{$('#detail').classList.add('hide');$('#shelves').classList.remove('hide');render(e.target.value)};
render('');
</script></body></html>`;

const out = path.join(ROOT, 'docs/mockups/discover-rework-2026-08-01.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
console.log('collections:', collections.length, '| yours:', yours.length, '| proven:', totals.proven);
