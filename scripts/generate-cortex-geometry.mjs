/**
 * generate-cortex-geometry.mjs — BUILD-TIME ONLY (never imported by the app).
 *
 * Emits `src/lib/brain/cortex-geometry.json`: a parcellated cortical surface for the Room's
 * brain view — two views (lateral + medial, left hemisphere), each tessellated into Voronoi
 * parcels grouped into the seven canonical Yeo networks.
 *
 * WHY WE AUTHOR OUR OWN SURFACE: TRIBE v2 (the reference for this UI) is CC-BY-NC-4.0 and the
 * fsaverage geometry it renders on is FreeSurfer-derived — neither can ship in a commercial
 * product. So the outlines here are our own artwork: anatomically faithful in topology (frontal
 * pole → central sulcus → occipital pole, temporal lobe under the sylvian fissure; the medial
 * view carries the callosal hole), without reusing anyone's mesh. What sells a parcel map at UI
 * scale is DENSITY + correct topology + a continuous heat ramp, not exact vertex coordinates.
 *
 * The output is static data — d3-delaunay is a devDependency used here and never bundled.
 *
 *   node scripts/generate-cortex-geometry.mjs
 *
 * Deterministic: a fixed PRNG seed, so re-running reproduces the identical file (the geometry is
 * committed; regenerate only when the outlines or parcel count change).
 */

import { Delaunay } from 'd3-delaunay';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'brain', 'cortex-geometry.json');

// The drawing box both views share.
const W = 300;
const H = 200;
/** Target parcels per view (Schaefer-1000 is ~250 parcels per hemisphere per view at this scale). */
const PARCELS_PER_VIEW = 220;
const LLOYD_ITERS = 4;

// ── Seeded PRNG (mulberry32) — same generator the app uses, so "deterministic" means the same
//    thing on both sides of the build.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Chaikin corner-cutting — turns a coarse hand-authored control polygon into an organic,
//    smooth outline (a cortex has no straight edges).
function chaikin(pts, iters = 3) {
  let out = pts;
  for (let k = 0; k < iters; k++) {
    const next = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out = next;
  }
  return out;
}

const pointInPoly = (p, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Inside the cortex ribbon = inside the outline AND outside the callosal hole. */
const inSurface = (p, view) => pointInPoly(p, view.outline);

// ── The surface artwork ──────────────────────────────────────────────────────
// Control polygons, clockwise, frontal pole at LEFT. Chaikin smooths them into the real curve.

// Left hemisphere, LATERAL: frontal pole → superior frontal → parietal → occipital pole →
// under the temporal lobe → temporal pole → back up to the frontal underside.
const LATERAL_CTRL = [
  [22, 104], [30, 74], [50, 52], [80, 36], [118, 27], [158, 25], [196, 30],
  [228, 44], [254, 64], [272, 90], [278, 114], [270, 136], [252, 150],
  [232, 158], [214, 168], [188, 176], [156, 179], [126, 176], [100, 168],
  [80, 156], [66, 142], [58, 126], [44, 122], [30, 116],
];

// Left hemisphere, MEDIAL: rounder (no temporal hang). No hole is cut — instead the callosal
// region is the MEDIAL WALL: parcels there carry no cortical signal and stay neutral gray, which
// is exactly how a surface plot (pysurfer/nilearn) renders it. A cut-out hole read as a snail.
const MEDIAL_CTRL = [
  [24, 100], [32, 72], [54, 50], [86, 34], [124, 26], [162, 25], [198, 31],
  [230, 46], [254, 68], [268, 94], [268, 122], [254, 146], [228, 160],
  [194, 168], [156, 170], [118, 167], [86, 158], [58, 142], [36, 124],
];
/** The medial wall (corpus callosum + subcortical) — an ellipse; parcels inside carry no data. */
const MEDIAL_WALL = { cx: 150, cy: 128, rx: 58, ry: 34 };

/** Decorative sulci — drawn OVER the parcels at low opacity so the surface reads as folded. */
const LATERAL_SULCI = [
  'M 96 44 C 118 66 132 92 140 120',      // central sulcus
  'M 62 118 C 104 106 158 106 208 120',   // sylvian fissure
  'M 92 146 C 130 136 176 136 216 146',   // superior temporal sulcus
  'M 196 44 C 214 66 226 88 232 112',     // intraparietal
  'M 40 92 C 60 84 80 82 98 86',          // inferior frontal
];
const MEDIAL_SULCI = [
  'M 150 30 C 152 52 150 70 146 88',      // cingulate (upper)
  'M 226 60 C 236 84 240 108 236 132',    // parieto-occipital
  'M 244 118 C 224 128 206 136 190 148',  // calcarine
  'M 70 74 C 92 68 114 70 132 78',        // medial prefrontal
];

// ── Yeo-7 networks ───────────────────────────────────────────────────────────
// polarity: 'task' = task-positive (engagement → cream/sage ramp); 'default' = the default-mode
// system (mind-wandering → the coral ramp). Task-positive/DMN anticorrelation is real, and it is
// what lets the locked dosage rule hold: coral still means "you are losing them".
const NETWORKS = [
  { id: 'visual', label: 'Visual', polarity: 'task', note: 'what they see' },
  { id: 'somatomotor', label: 'Somatomotor', polarity: 'task', note: 'the urge to act' },
  { id: 'dorsal_attention', label: 'Dorsal attention', polarity: 'task', note: 'focus, held on purpose' },
  { id: 'salience', label: 'Salience', polarity: 'task', note: 'what grabs them' },
  { id: 'limbic', label: 'Limbic', polarity: 'task', note: 'feeling & value' },
  { id: 'control', label: 'Frontoparietal', polarity: 'task', note: 'working it out' },
  { id: 'default', label: 'Default mode', polarity: 'default', note: 'mind-wandering' },
];

// Network anchors per view — a parcel joins its nearest anchor's network. Positions follow the
// canonical topography (visual at the occipital pole, somatomotor along the central sulcus,
// DMN at the medial prefrontal + precuneus + angular gyrus, and so on).
const LATERAL_ANCHORS = [
  ['visual', 258, 122], ['visual', 268, 100], ['visual', 244, 142],
  ['somatomotor', 122, 48], ['somatomotor', 150, 58], ['somatomotor', 96, 62],
  ['dorsal_attention', 196, 58], ['dorsal_attention', 220, 84],
  ['salience', 128, 96], ['salience', 168, 100], ['salience', 92, 100],
  ['limbic', 84, 146], ['limbic', 120, 158],
  ['control', 46, 92], ['control', 62, 66], ['control', 212, 128],
  ['default', 232, 106], ['default', 168, 152], ['default', 40, 110],
];
const MEDIAL_ANCHORS = [
  ['visual', 236, 128], ['visual', 250, 106], ['visual', 214, 148],
  ['somatomotor', 146, 40], ['somatomotor', 178, 46],
  ['dorsal_attention', 202, 60],
  ['salience', 116, 62], ['salience', 96, 96],
  ['limbic', 74, 140], ['limbic', 150, 158], ['limbic', 186, 152],
  ['control', 88, 50],
  ['default', 52, 98], ['default', 62, 122], ['default', 214, 86], ['default', 232, 66], ['default', 100, 150],
];

const inWall = (p, wall) =>
  wall != null &&
  ((p[0] - wall.cx) / wall.rx) ** 2 + ((p[1] - wall.cy) / wall.ry) ** 2 <= 1;

function buildView(id, label, ctrl, wall, sulci, anchors, rng) {
  const outline = chaikin(ctrl, 3).map(([x, y]) => [round(x), round(y)]);
  const view = { id, label, outline, hole: null, wall: wall ?? null, sulci };

  // Seeds — dart-throwing with a minimum separation, so the tessellation is even (a Poisson-ish
  // field), not clumped. A clumped field is what makes generated maps look fake.
  const minDist = Math.sqrt((W * H * 0.55) / PARCELS_PER_VIEW) * 0.78;
  const seeds = [];
  let guard = 0;
  while (seeds.length < PARCELS_PER_VIEW && guard < PARCELS_PER_VIEW * 400) {
    guard++;
    const p = [rng() * W, rng() * H];
    if (!inSurface(p, view)) continue;
    if (seeds.some((s) => (s[0] - p[0]) ** 2 + (s[1] - p[1]) ** 2 < minDist * minDist)) continue;
    seeds.push(p);
  }

  // Lloyd relaxation — pull each seed to its cell's centroid, then back inside the surface. This
  // is what makes the parcels read as an even cortical parcellation rather than random blobs.
  let pts = seeds;
  for (let k = 0; k < LLOYD_ITERS; k++) {
    const d = Delaunay.from(pts);
    const v = d.voronoi([0, 0, W, H]);
    pts = pts.map((p, i) => {
      const cell = v.cellPolygon(i);
      if (!cell) return p;
      const c = centroid(cell);
      // A centroid can leave the ribbon (concave outline / the callosal hole) — walk it back.
      return inSurface(c, view) ? c : p;
    });
  }

  const delaunay = Delaunay.from(pts);
  const voronoi = delaunay.voronoi([0, 0, W, H]);
  const parcels = pts.map((p, i) => {
    const cell = voronoi.cellPolygon(i);
    const wallParcel = inWall(p, wall);
    return {
      i,
      // A medial-wall parcel carries no cortical signal — it renders neutral, never colored.
      n: wallParcel ? 'wall' : nearestNetwork(p, anchors),
      c: [round(p[0]), round(p[1])],
      // The cell is clipped to the BOX here; the surface outline clips it for real at render time
      // (an SVG clipPath), which is exact and costs nothing.
      p: (cell ?? []).slice(0, -1).map(([x, y]) => [round(x), round(y)]),
    };
  });

  return { ...view, parcels };
}

const centroid = (poly) => {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += f;
    x += (poly[j][0] + poly[i][0]) * f;
    y += (poly[j][1] + poly[i][1]) * f;
  }
  a *= 0.5;
  return Math.abs(a) < 1e-9 ? poly[0] : [x / (6 * a), y / (6 * a)];
};

function nearestNetwork(p, anchors) {
  let best = anchors[0][0];
  let bd = Infinity;
  for (const [net, ax, ay] of anchors) {
    const d = (p[0] - ax) ** 2 + (p[1] - ay) ** 2;
    if (d < bd) {
      bd = d;
      best = net;
    }
  }
  return best;
}

const round = (n) => Math.round(n * 10) / 10;

const rng = mulberry32(20260713);
const views = [
  buildView('lateral', 'Lateral', LATERAL_CTRL, null, LATERAL_SULCI, LATERAL_ANCHORS, rng),
  buildView('medial', 'Medial', MEDIAL_CTRL, MEDIAL_WALL, MEDIAL_SULCI, MEDIAL_ANCHORS, rng),
];

const out = { width: W, height: H, networks: NETWORKS, views };
writeFileSync(OUT, JSON.stringify(out));

for (const v of views) {
  const counts = {};
  for (const p of v.parcels) counts[p.n] = (counts[p.n] ?? 0) + 1;
  console.log(`${v.id}: ${v.parcels.length} parcels`, counts);
}
console.log('→', OUT, (JSON.stringify(out).length / 1024).toFixed(1) + 'KB');
