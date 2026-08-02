// Builds a standalone HTML sketch of the reworked Discover from the REAL data.
// v3 — three zones instead of a wall of lookalike shelves:
//   ① Outliers  — the proof feed over outlier_teardowns (baselined ≥3×, <100×)
//   ② Collections — the 105 curated groupings (teardown_collections, unchanged ask)
//   ③ Sources   — tracked_accounts + competitor_profiles merged, promoted from a link
// Honesty rules mirror the shipped ones (prompt.ts receipt/fmtMultiplier,
// retrieve.ts hasKnownBaseline/honestMultiplier, outlier-gate MIN_OUTLIER_MULTIPLIER).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd(); // run from the repo root
const { teardowns, memberships, watched, tracked, competitors, competitorVideos } = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.scratch/corpus.json'), 'utf8'),
);

const CATS = [
  { id: 'formats', label: 'Formats', blurb: 'The shape of the whole video.' },
  { id: 'visual_hooks', label: 'Visual hooks', blurb: 'What the first frame does to stop the scroll.' },
  { id: 'editing_styles', label: 'Editing styles', blurb: 'How the cut carries the story.' },
  { id: 'signature_series', label: 'Signature series', blurb: 'Repeatable formats a creator owns.' },
];
const NICHE_LABEL = (n) => n.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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
    m: showNumber ? m : 0,
    mult: showNumber ? (m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`) : null,
    // Above ~100× the ratio is a thin-baseline artifact, not a signal to trust.
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
const fmtFoll = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const NOW = Date.parse('2026-08-02');
const ago = (iso) => {
  if (!iso) return null;
  const d = Math.floor((NOW - Date.parse(iso)) / 86400000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${(d / 365).toFixed(1)}y ago`;
};

// ── ① the outliers feed — proven only, extremes excluded ───────────────────
// The feed is the trust surface: baselined, ≥3×, and <100× (56 thin-baseline
// artifacts stay findable inside their collections, flagged ⚠, never here).
const feed = teardowns
  .map((t) => ({ t, r: receiptOf(t) }))
  .filter(({ r }) => r.proven && !r.extreme)
  .map(({ t, r }) => ({
    id: t.id,
    cover: t.cover_url, durable: DURABLE(t.cover_url),
    // Spoken hook first: the card shows a real video, not the reusable template
    // (the template belongs to the teardown detail and the collection rows).
    hook: t.spoken_hook || t.hook_template || (t.why_it_works || '').slice(0, 70) || '—',
    template: t.hook_template || null,
    handle: t.creator_handle, niche: t.niche || null,
    arch: t.hook_archetype ? NICHE_LABEL(t.hook_archetype.replace(/_/g, '-')) : null,
    views: fmtViews(t.views), viewsN: Number(t.views) || 0,
    when: ago(t.posted_at), ts: Date.parse(t.posted_at) || 0,
    mult: r.mult, m: r.m, basis: r.basis,
    why: t.why_it_works || null,
  }));
const nicheCounts = {};
for (const f of feed) if (f.niche) nicheCounts[f.niche] = (nicheCounts[f.niche] || 0) + 1;
const niches = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1])
  .map(([id, n]) => ({ id, label: NICHE_LABEL(id), n }));

// ── ② collections, read from the curated table ─────────────────────────────
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
    items: items.slice(0, 16).map((r) => {
      const rc = receiptOf(r);
      return {
        cover: r.cover_url, durable: DURABLE(r.cover_url),
        hook: r.hook_template || r.spoken_hook || '',
        handle: r.creator_handle,
        arch: r.hook_archetype ? NICHE_LABEL(r.hook_archetype.replace(/_/g, '-')) : null,
        views: fmtViews(r.views), when: ago(r.posted_at),
        why: r.why_it_works ? r.why_it_works.slice(0, 190) : null,
        proven: rc.proven, showNumber: rc.showNumber, mult: rc.mult, extreme: rc.extreme, basis: rc.basis,
      };
    }),
  };
}).filter((c) => c.items.length > 0);

// ── ③ sources — tracked_accounts ∪ competitor_profiles, one list ───────────
// The cbum/chrisbumstead duplicate is exactly what the merge dissolves.
const ALIAS = { chrisbumstead: 'cbum' }; // tracked handle → competitor tiktok_handle
const watchedByHandle = new Map();
for (const w of watched) {
  const key = ALIAS[w.creator_handle] || w.creator_handle;
  const agg = watchedByHandle.get(key) || { n: 0, best: 0, newest: 0 };
  agg.n += 1;
  const m = honest(w.outlier_multiplier);
  if (m && m > agg.best) agg.best = m;
  const ts = Date.parse(w.posted_at) || 0;
  if (ts > agg.newest) agg.newest = ts;
  watchedByHandle.set(key, agg);
}
const vidsByCompetitor = new Map();
for (const v of competitorVideos) {
  const agg = vidsByCompetitor.get(v.competitor_id) || { n: 0, newest: null };
  agg.n += 1;
  if (!agg.newest || v.posted_at > agg.newest) agg.newest = v.posted_at;
  vidsByCompetitor.set(v.competitor_id, agg);
}
const compByHandle = new Map(competitors.map((c) => [c.tiktok_handle, c]));
const seen = new Set();
const sources = [];
for (const c of competitors) {
  // A failed scrape with no salvageable profile is held back, never rendered as junk.
  const junk = !c.follower_count && (!c.display_name || c.display_name !== c.tiktok_handle && c.follower_count === 0);
  const held = c.scrape_status === 'failed' && !c.follower_count;
  const w = watchedByHandle.get(c.tiktok_handle);
  const cv = vidsByCompetitor.get(c.id);
  seen.add(c.tiktok_handle);
  sources.push({
    handle: c.tiktok_handle, name: held ? c.tiktok_handle : (c.display_name || c.tiktok_handle),
    avatar: c.avatar_url || null, followers: c.follower_count ? fmtFoll(c.follower_count) : null,
    outliers: w ? { n: w.n, best: `${w.best.toFixed(1)}×` } : null,
    videos: cv ? { n: cv.n, when: ago(cv.newest) } : null,
    merged: c.tiktok_handle === 'cbum' ? '@chrisbumstead' : null,
    held,
  });
}
for (const t of tracked) {
  const key = ALIAS[t.handle] || t.handle;
  if (seen.has(key)) continue;
  const w = watchedByHandle.get(key);
  sources.push({
    handle: key, name: key, avatar: null, followers: null,
    outliers: w ? { n: w.n, best: `${w.best.toFixed(1)}×` } : null,
    videos: null, merged: null, held: false,
  });
}
sources.sort((a, b) => Number(a.held) - Number(b.held) || (b.outliers?.n || 0) - (a.outliers?.n || 0));

// Latest-from-sources strip: recent competitor videos with covers, 2 per creator.
const perSrc = new Map();
const latest = competitorVideos
  .filter((v) => v.cover_url)
  .sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at))
  .filter((v) => {
    const c = competitors.find((x) => x.id === v.competitor_id);
    if (!c) return false;
    const n = (perSrc.get(c.tiktok_handle) ?? 0) + 1;
    perSrc.set(c.tiktok_handle, n);
    return n <= 2;
  })
  .slice(0, 10)
  .map((v) => {
    const c = competitors.find((x) => x.id === v.competitor_id);
    return {
      cover: v.cover_url,
      caption: (v.caption || 'Untitled').slice(0, 70),
      handle: c.tiktok_handle,
      views: fmtViews(v.views), when: ago(v.posted_at),
    };
  });

const totals = {
  videos: teardowns.length,
  proven: feed.length,
  collections: collections.length,
  creators: new Set(teardowns.map((t) => t.creator_handle)).size,
};
const DATA = JSON.stringify({ feed, niches, collections, cats: CATS, sources, latest, totals });

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discover — rework sketch v3</title>
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
main{padding:26px 34px 90px;max-width:1240px}
h1{font-size:22px;font-weight:600;letter-spacing:-.01em}
.sub{color:var(--fg3);font-size:13px;margin-top:3px}
.omni{display:flex;gap:8px;margin:18px 0 6px}
.omni .field{flex:1;display:flex;align-items:center;gap:9px;background:var(--composer);border:1px solid var(--border);border-radius:8px;padding:0 12px;height:42px}
.omni input{flex:1;background:none;border:0;outline:0;color:var(--fg);font:400 14px Inter,sans-serif}
.omni input::placeholder{color:var(--fg3)}
.pullbtn{height:42px;padding:0 15px;border-radius:8px;background:var(--chip);border:1px solid var(--border);color:var(--fg2);font:600 13px Inter;display:flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap}
.cost{font-size:11px;color:var(--fg3);padding:2px 6px;border-radius:5px;background:rgba(255,255,255,.06)}
.omnihint{font-size:11.5px;color:var(--fg3)}
.omnihint b{color:var(--fg2);font-weight:600}
.jump{display:flex;gap:16px;margin-top:10px;font-size:12px;color:var(--fg3)}
.jump a{color:var(--fg3);text-decoration:none;font-weight:500}
.jump a:hover{color:var(--fg)}
.jump .n{color:var(--fg2);font-weight:600}

/* ── zones ── */
.zone{border-top:1px solid var(--border);margin-top:36px;padding-top:26px}
.zhead{display:flex;align-items:baseline;gap:12px;margin-bottom:2px}
.zhead h2{font-size:17px;font-weight:600;letter-spacing:-.008em}
.zhead .zn{font-size:11.5px;color:var(--fg3);font-variant-numeric:tabular-nums}
.zhead .more{margin-left:auto;font-size:12px;color:var(--fg3);cursor:pointer;font-weight:500;white-space:nowrap}
.zhead .more:hover{color:var(--fg)}
.zsub{font-size:12.5px;color:var(--fg3);margin-bottom:14px;max-width:640px}

/* ① outliers feed */
.filters{display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.nchip{font-size:11.5px;font-weight:500;padding:5px 10px;border-radius:7px;background:none;border:1px solid var(--border);color:var(--fg3);cursor:pointer;font-family:inherit;white-space:nowrap}
.nchip:hover{color:var(--fg2);border-color:var(--border-h)}
.nchip.on{background:rgba(255,255,255,.09);color:var(--fg);border-color:transparent}
.sorts{margin-left:auto;display:flex;gap:2px;background:var(--composer);border:1px solid var(--border);border-radius:7px;padding:2px}
.sorts button{font:500 11.5px Inter;padding:4px 9px;border-radius:5px;border:0;background:none;color:var(--fg3);cursor:pointer}
.sorts button.on{background:rgba(255,255,255,.09);color:var(--fg)}
.fgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:13px}
.fcard{background:var(--thread);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s}
.fcard:hover{border-color:var(--border-h);transform:translateY(-1px)}
.fcov{position:relative;height:214px;background:linear-gradient(150deg,#312f2b,#1c1b19)}
.fcov img{width:100%;height:100%;object-fit:cover;display:block}
.fcov .m{position:absolute;left:7px;top:7px;font-size:11px;font-weight:600;padding:3px 7px;border-radius:6px;background:rgba(20,24,18,.82);color:var(--positive);font-variant-numeric:tabular-nums}
.fb{padding:9px 10px 11px}
.fhook{font-size:12.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
.fmeta{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--fg3);margin-top:6px}
.fmeta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zfoot{display:flex;align-items:center;gap:12px;margin-top:14px}
.showall{font:600 12.5px Inter;padding:8px 14px;border-radius:8px;background:var(--chip);border:1px solid var(--border);color:var(--fg2);cursor:pointer}
.showall:hover{color:var(--fg);border-color:var(--border-h)}
.fresh{font-size:11.5px;color:var(--fg3)}
.fresh b{color:var(--fg2);font-weight:600}

/* ② collections */
.shelf{margin-bottom:26px}
.shead{display:flex;align-items:baseline;gap:9px;margin-bottom:2px}
.shead h3{font-size:14px;font-weight:600;letter-spacing:-.005em}
.shead .subs{font-size:11.5px;color:var(--fg3)}
.shead .more{margin-left:auto;font-size:12px;color:var(--fg3);cursor:pointer;font-weight:500;white-space:nowrap}
.shead .more:hover{color:var(--fg)}
.sblurb{font-size:12px;color:var(--fg3);margin-bottom:11px}
.track{display:flex;gap:13px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.track::-webkit-scrollbar{display:none}
.track>*{flex:0 0 208px}
.track.wrap{flex-wrap:wrap;overflow:visible}
.col{background:var(--thread);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s}
.col:hover{border-color:var(--border-h);transform:translateY(-1px)}
.mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:72px 72px;gap:1px;background:rgba(255,255,255,.05)}
.mosaic>*{min-width:0;min-height:0;overflow:hidden}
.mosaic img{width:100%;height:100%;object-fit:cover;display:block}
.mosaic .ph{background:linear-gradient(150deg,#312f2b,#1c1b19)}
.colb{padding:10px 12px 12px}
.kick{font-size:9.5px;letter-spacing:.085em;text-transform:uppercase;color:var(--fg3);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.colt{font-size:13px;font-weight:600;margin:4px 0 8px;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.colm{display:flex;gap:6px}
.pill{font-size:10.5px;font-weight:500;padding:2.5px 7px;border-radius:5px;background:rgba(255,255,255,.06);color:var(--fg3);font-variant-numeric:tabular-nums}
.pill.proven{background:rgba(142,166,138,.14);color:var(--positive)}

/* ③ sources */
.latest{margin-bottom:18px}
.sv{background:var(--thread);border:1px solid var(--border);border-radius:10px;overflow:hidden;flex:0 0 128px!important}
.svcov{position:relative;height:118px;background:linear-gradient(150deg,#312f2b,#1c1b19)}
.svcov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.svfall{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 44px Georgia,serif;color:rgba(236,231,222,.14)}
.svb{padding:7px 9px 9px}
.svcap{font-size:11px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--fg2)}
.svmeta{display:flex;justify-content:space-between;font-size:10px;color:var(--fg3);margin-top:5px}
.srcs{display:flex;flex-direction:column;gap:8px;max-width:760px}
.src{display:flex;align-items:center;gap:13px;background:var(--thread);border:1px solid var(--border);border-radius:12px;padding:11px 15px}
.src:hover{border-color:var(--border-h)}
.src.held{opacity:.6}
.ava{width:38px;height:38px;border-radius:50%;object-fit:cover;flex:none;background:linear-gradient(150deg,#312f2b,#1c1b19)}
.ava.ph{display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--fg3);font-size:15px}
.srcb{flex:1;min-width:0}
.srcn{font-size:13.5px;font-weight:600}
.srcn .h{color:var(--fg3);font-weight:400;font-size:12px;margin-left:7px}
.srcn .mg{color:var(--fg3);font-weight:400;font-size:11px;margin-left:7px;padding:2px 6px;background:rgba(255,255,255,.05);border-radius:5px}
.srcs2{font-size:11.5px;color:var(--fg3);margin-top:2px}
.srcm{display:flex;align-items:center;gap:7px;flex:none}
.srcm .mult{font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(142,166,138,.14);color:var(--positive);font-variant-numeric:tabular-nums}
.srcm .quiet{font-size:11.5px;color:var(--fg3);font-variant-numeric:tabular-nums}
.addrow{display:flex;align-items:center;gap:10px;border:1px dashed rgba(255,255,255,.13);border-radius:12px;padding:12px 15px;max-width:760px;margin-top:8px}
.addrow p{font-size:12px;color:var(--fg3);flex:1}
.btn{font:600 12.5px Inter;padding:8px 13px;border-radius:8px;background:var(--action);color:var(--action-fg);border:0;cursor:pointer}

/* drill-in + teardown detail */
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
.td{display:flex;gap:22px;max-width:900px}
.tdcov{width:236px;height:314px;border-radius:12px;object-fit:cover;flex:none;background:linear-gradient(150deg,#312f2b,#1c1b19)}
.tdb .hook{font-size:16.5px;line-height:1.45;font-weight:500}
.tdb .why{font-size:13px;color:var(--fg2);line-height:1.65;margin-top:12px;max-width:560px}
.tdb .why b{color:var(--fg);font-weight:600}
.tdrow{display:flex;gap:7px;margin-top:14px;flex-wrap:wrap}
.hide{display:none}
.note{border:1px dashed rgba(255,255,255,.12);border-radius:10px;padding:13px 15px;color:var(--fg3);font-size:12.5px;line-height:1.6}
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
    <div id="page">
      <h1>Discover</h1>
      <p class="sub" id="sub"></p>
      <div class="omni">
        <div class="field"><span style="color:var(--fg3)">⌕</span>
          <input id="q" placeholder="Search outliers, formats, hooks, creators — or paste a @handle"></div>
        <button class="pullbtn">Pull live <span class="cost">5 credits</span></button>
      </div>
      <p class="omnihint">Searching the library is instant and free. <b>Pull live</b> only lights up for a handle or URL we don't already hold — that one spends credits, and says so before you press it.</p>
      <div class="jump">Jump to
        <a href="#z-outliers"><span class="n">Outliers</span></a>
        <a href="#z-collections"><span class="n">Collections</span></a>
        <a href="#z-sources"><span class="n">Sources</span></a>
      </div>
      <div id="zones"></div>
    </div>
    <div id="detail" class="hide"></div>
  </main>
</div>
<script>
const D = ${DATA};
const $ = (s) => document.querySelector(s);
$('#sub').textContent = D.totals.videos + ' torn-down videos · ' + D.totals.proven +
  ' proven outliers · ' + D.totals.collections + ' collections · ' + D.totals.creators + ' creators';

const CATLABEL = {formats:'FORMATS',visual_hooks:'VISUAL HOOKS',editing_styles:'EDITING STYLES',signature_series:'SIGNATURE SERIES'};
let niche = null, sort = 'recent', expanded = false;

function fcard(f, i){
  const img = f.durable ? '<img loading="lazy" src="'+f.cover+'" alt="" onerror="this.remove()">' : '';
  return '<article class="fcard" data-f="'+i+'"><div class="fcov">'+img+
    '<span class="m">▲ '+f.mult+'</span></div>'+
    '<div class="fb"><div class="fhook">'+f.hook+'</div>'+
    '<div class="fmeta"><span>@'+f.handle+'</span><span>'+f.views+' · '+(f.when||'')+'</span></div></div></article>';
}
function feedList(f){
  let list = D.feed.filter(x => (!niche || x.niche === niche) &&
    (!f || x.hook.toLowerCase().includes(f) || x.handle.toLowerCase().includes(f) || (x.niche||'').includes(f)));
  if (sort === 'recent') list = list.slice().sort((a,b) => b.ts - a.ts);
  if (sort === 'mult') list = list.slice().sort((a,b) => b.m - a.m);
  if (sort === 'views') list = list.slice().sort((a,b) => b.viewsN - a.viewsN);
  return list;
}
function zOutliers(f){
  const list = feedList(f);
  const vis = expanded || f ? list : list.slice(0, 12);
  const chips = ['<button class="nchip'+(niche?'':' on')+'" data-n="">All · '+D.feed.length+'</button>']
    .concat(D.niches.slice(0, 7).map(n =>
      '<button class="nchip'+(niche===n.id?' on':'')+'" data-n="'+n.id+'">'+n.label+' · '+n.n+'</button>'))
    .join('') + (D.niches.length > 7 ? '<button class="nchip">+'+(D.niches.length-7)+' more</button>' : '');
  return '<section class="zone" id="z-outliers" style="border-top:0;margin-top:26px;padding-top:0">'+
    '<div class="zhead"><h2>Outliers</h2><span class="zn">'+list.length+' proven</span></div>'+
    '<p class="zsub">Videos that beat their creator\\'s usual views by 3× or more — measured against each account\\'s own baseline, never against a stranger\\'s. Ratios on baselines too thin to trust are kept out of this feed.</p>'+
    '<div class="filters">'+chips+
    '<div class="sorts">'+[['recent','Recent'],['mult','Highest ×'],['views','Most viewed']].map(s =>
      '<button data-s="'+s[0]+'" class="'+(sort===s[0]?'on':'')+'">'+s[1]+'</button>').join('')+'</div></div>'+
    (vis.length ? '<div class="fgrid">'+vis.map((x) => fcard(x, D.feed.indexOf(x))).join('')+'</div>'
      : '<div class="note">No outliers match. Paste a <b>@handle</b> above to pull fresh material instead.</div>')+
    '<div class="zfoot">'+(!expanded && !f && list.length > 12
      ? '<button class="showall" id="more">Show all '+list.length+' →</button>' : '')+
    '<span class="fresh">Corpus refreshed <b>Jul 14</b> · newest video <b>Jun 10</b> · nothing auto-refreshes yet — <b>Pull live</b> brings in fresh material on demand.</span></div></section>';
}
function colCard(c, eager){
  const kick = CATLABEL[c.cat] + (c.sub ? ' · ' + c.sub.toUpperCase() : '');
  let mosaic = '<div class="mosaic">';
  for (let i = 0; i < 4; i++) mosaic += c.covers[i]
    ? '<img '+(eager ? '' : 'loading="lazy" ')+'src="'+c.covers[i]+'" alt="">' : '<div class="ph"></div>';
  mosaic += '</div>';
  return '<article class="col" data-i="'+c.idx+'">'+mosaic+
   '<div class="colb"><div class="kick" title="'+kick+'">'+kick+'</div>'+
   '<div class="colt" title="'+c.name+'">'+c.name+'</div><div class="colm">'+
   '<span class="pill">'+c.n+' video'+(c.n===1?'':'s')+'</span>'+
   (c.proven?'<span class="pill proven">'+c.proven+' proven</span>':'')+'</div></div></article>';
}
function zCollections(f){
  let html = '<section class="zone" id="z-collections"><div class="zhead"><h2>Collections</h2>'+
    '<span class="zn">'+D.totals.collections+' curated</span></div>'+
    '<p class="zsub">The corpus grouped four ways — the shape of the video, the first frame, the cut, and the series a creator owns. Every collection was curated by hand, not derived.</p>';
  for (const cat of D.cats){
    const list = D.collections.filter(c => c.cat===cat.id && (!f || c.name.toLowerCase().includes(f) || (c.sub||'').toLowerCase().includes(f)))
      .sort((a,b) => b.n - a.n);
    if (!list.length) continue;
    const subs = [...new Set(list.map(c => c.sub).filter(Boolean))];
    html += '<div class="shelf"><div class="shead"><h3>'+cat.label+'</h3>'+
      (subs.length ? '<span class="subs">'+subs.slice(0,3).join(' · ')+(subs.length>3?' · +'+(subs.length-3):'')+'</span>' : '')+
      '<span class="more">See all '+list.length+' →</span></div>'+
      '<p class="sblurb">'+cat.blurb+'</p>'+
      '<div class="track'+(f?' wrap':'')+'">'+list.map((c,i) => colCard(c, i < 6)).join('')+'</div></div>';
  }
  return html + '</section>';
}
function zSources(f){
  const list = D.sources.filter(s => !f || s.handle.toLowerCase().includes(f) || s.name.toLowerCase().includes(f));
  const rows = list.map(s => {
    const ava = s.avatar ? '<img class="ava" src="'+s.avatar+'" alt="">'
      : '<div class="ava ph">'+s.handle[0].toUpperCase()+'</div>';
    const meta = s.held ? 'scrape failed — held back until a clean read, never rendered as junk'
      : [s.followers ? s.followers+' followers' : null,
         s.videos ? s.videos.n+' recent videos held · newest '+s.videos.when : null].filter(Boolean).join(' · ');
    const right = s.held ? '<span class="quiet">re-scrape queued</span>'
      : (s.outliers ? '<span class="mult">'+s.outliers.n+' outliers · best '+s.outliers.best+'</span>' : '<span class="quiet">no measured outliers yet</span>');
    return '<div class="src'+(s.held?' held':'')+'">'+ava+
      '<div class="srcb"><div class="srcn">'+s.name+'<span class="h">@'+s.handle+'</span>'+
      (s.merged ? '<span class="mg">merged '+s.merged+'</span>' : '')+'</div>'+
      '<div class="srcs2">'+meta+'</div></div>'+
      '<div class="srcm">'+right+'<span class="quiet">›</span></div></div>';
  }).join('');
  return '<section class="zone" id="z-sources"><div class="zhead"><h2>Sources</h2>'+
    '<span class="zn">'+D.sources.length+' tracked</span></div>'+
    '<p class="zsub">Creators and competitors, one list — tracked accounts and competitor watchlists were the same idea stored twice, so they merged. A source\\'s outliers surface in the feed above and its profile page keeps the deep comparison.</p>'+
    (D.latest.length ? '<div class="latest"><div class="shead"><h3>Latest from your sources</h3>'+
      '<span class="subs">recent posts, not yet measured</span></div><div style="height:8px"></div>'+
      '<div class="track">'+D.latest.map(v =>
        // Fallback sits UNDER the img: a dead signed-CDN cover removes itself and
        // leaves a designed caption poster, never a broken-image glyph.
        '<article class="sv"><div class="svcov"><div class="svfall">”</div>'+
        '<img loading="lazy" src="'+v.cover+'" alt="" onerror="this.remove()"></div>'+
        '<div class="svb"><div class="svcap">'+v.caption+'</div>'+
        '<div class="svmeta"><span>@'+v.handle+'</span><span>'+v.views+' · '+v.when+'</span></div></div></article>').join('')+
      '</div></div>' : '')+
    '<div class="srcs">'+rows+'</div>'+
    '<div class="addrow"><p>Track any creator or competitor — their new posts land here and their outliers join the feed.</p><button class="btn">Add a source</button></div>'+
    '</section>';
}
function render(filter){
  const f = (filter || '').trim().toLowerCase();
  $('#zones').innerHTML = zOutliers(f) + zCollections(f) + zSources(f);
  document.querySelectorAll('.nchip[data-n]').forEach(el => el.onclick = () => { niche = el.dataset.n || null; render($('#q').value); });
  document.querySelectorAll('.sorts button').forEach(el => el.onclick = () => { sort = el.dataset.s; render($('#q').value); });
  const more = $('#more'); if (more) more.onclick = () => { expanded = true; render($('#q').value); };
  document.querySelectorAll('.col').forEach(el => el.onclick = () => colDetail(+el.dataset.i));
  document.querySelectorAll('.fcard').forEach(el => el.onclick = () => tdDetail(+el.dataset.f));
}
function open(html){ $('#detail').innerHTML = html; $('#page').classList.add('hide'); $('#detail').classList.remove('hide');
  $('#bk').onclick = () => { $('#detail').classList.add('hide'); $('#page').classList.remove('hide'); };
  window.scrollTo(0,0); }
function colDetail(i){
  const c = D.collections.find(x => x.idx === i);
  const kick = CATLABEL[c.cat] + (c.sub ? ' · ' + c.sub.toUpperCase() : '');
  const rows = c.items.map(t => {
    const thumb = t.durable ? '<img class="thumb" loading="lazy" src="'+t.cover+'" alt="">' : '<div class="thumb"></div>';
    const mult = !t.showNumber
      ? '<span class="mult cur" title="No baseline recorded — no claim made">curated</span>'
      : t.extreme
        ? '<span class="mult cur" title="Ratio against a very thin baseline — shown, but not treated as proof">'+t.mult+' ⚠</span>'
        : '<span class="mult">▲ '+t.mult+'</span>';
    return '<div class="row">'+thumb+'<div class="rowb"><div class="hook">'+(t.hook||'—')+'</div>'+
      '<div class="by">Inspired by @'+(t.handle||'unknown')+(t.showNumber ? ' · '+t.mult+' '+t.basis : '')+(t.when ? ' · '+t.when : '')+'</div></div>'+
      '<div class="rowm">'+(t.arch ? '<span class="chip">'+t.arch+'</span>' : '')+mult+
      '<span class="views">◉ '+t.views+'</span><button class="remix">Remix →</button></div></div>';
  }).join('');
  open('<button class="back" id="bk">← Discover</button>'+
    '<div class="kick" style="margin-bottom:3px">'+kick+'</div>'+
    '<div class="zhead"><h2 style="font-size:20px">'+c.name+'</h2><span class="zn">'+c.n+' videos · '+c.proven+' proven</span></div>'+
    '<p class="zsub">Every row is a real video we tore down. The number is measured against that creator\\'s own usual views — a row with no baseline says <b>curated</b> and makes no claim.</p>'+
    '<div class="rows">'+rows+'</div>');
}
function tdDetail(i){
  const f = D.feed[i];
  const cov = f.durable ? '<img class="tdcov" src="'+f.cover+'" alt="">' : '<div class="tdcov"></div>';
  open('<button class="back" id="bk">← Discover</button>'+
    '<div class="td">'+cov+'<div class="tdb">'+
    '<div class="kick" style="margin-bottom:8px">'+(f.niche ? f.niche.replace(/-/g,' ').toUpperCase() : 'OUTLIER')+(f.arch ? ' · '+f.arch.toUpperCase() : '')+'</div>'+
    '<div class="hook">'+f.hook+'</div>'+
    '<div class="by" style="margin-top:8px">@'+f.handle+' · <b style="color:var(--positive)">▲ '+f.mult+'</b> '+(f.basis||'')+' · '+f.views+' views'+(f.when ? ' · '+f.when : '')+'</div>'+
    (f.why ? '<p class="why"><b>Why it works —</b> '+f.why+'</p>' : '')+
    (f.template && f.template !== f.hook ? '<p class="why"><b>Template —</b> '+f.template+'</p>' : '')+
    '<div class="tdrow"><button class="remix">Remix this →</button><button class="showall">See its collections</button></div>'+
    '</div></div>');
}
$('#q').oninput = (e) => { $('#detail').classList.add('hide'); $('#page').classList.remove('hide'); render(e.target.value); };
render('');
</script></body></html>`;

const out = path.join(ROOT, 'docs/mockups/discover-rework-2026-08-02.html');
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB');
console.log('feed:', feed.length, '| collections:', collections.length, '| sources:', sources.length, '| latest:', latest.length);
