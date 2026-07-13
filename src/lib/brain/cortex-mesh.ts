/**
 * cortex-mesh — a folded cortical hemisphere, authored by us, built at runtime.
 *
 * WHY THIS EXISTS: the first two cuts of the brain view drew a flat Voronoi map and read as a leaf.
 * What makes a brain legible as a brain is not colour and not parcel density — it is the FOLDING:
 * gyral crowns catching the light, sulci cutting dark creases between them. So the surface is a real
 * 3D mesh with real normals, and the shading does the work.
 *
 * LICENSING (binding): TRIBE v2 is CC-BY-NC-4.0 and renders on FreeSurfer-derived fsaverage
 * geometry. Neither may ship in a commercial product. Nothing here is derived from either: the
 * shape is an ellipsoid sculpted by hand-tuned constants, and the folds are our own Perlin field.
 * We reproduce the *look of the physics*, never anyone's data.
 *
 * Deterministic and pure: same seed → same mesh, no wall-clock, no Math.random. It is built once
 * per seed and memoized. Nothing here touches the DOM, so it is safe to unit-test headlessly — but
 * it is only ever CALLED from the client (the WebGL view), so its cost never lands on SSR.
 *
 * The build is ~10k vertices of pure arithmetic (tens of ms), which is why the mesh is generated in
 * the browser instead of shipped: a baked mesh of this size would be ~500KB of JSON.
 */

import {
  NETWORK_IDS,
  mulberry32,
  parcelTexture,
  parcelValue,
  type NetworkId,
  type ParcelTexture,
} from './cortex-sim';

// ── The anatomy, as constants ────────────────────────────────────────────────
/** Half-extents of the base ellipsoid: anterior-posterior × superior-inferior × lateral. */
const A = 1.0;
const B = 0.70;
const C = 0.62;
/** The medial face is nearly FLAT — a hemisphere is a D in cross-section, not an egg. */
const MEDIAL_FLATTEN = 0.16;
/** Fold field: spatial frequency (≈ how many gyri span the brain) and displacement amplitude.
 *  7.2 was too fine — it packed the surface with small isotropic bumps and the whole object read as
 *  a WALNUT. A real cortex has a few dozen broad gyri, not a hundred lumps. */
const FOLD_FREQ = 9.4;
const FOLD_AMP = 0.044;
/** Sulcal creases sit at the fold field's zero-crossings; this is how wide they cut. Narrow: real
 *  gyri are broad ribbons separated by THIN deep sulci, not a field of round walnut lumps. */
const SULCUS_WIDTH = 0.30;
/** The sylvian fissure — the one fold deep enough to be anatomy rather than texture. Keep it SHORT
 *  and THIN: a long dark line across the middle of the render stops reading as a lateral fissure and
 *  starts reading as the interhemispheric midline, which flips the whole image into a top-down view. */
const SYLVIAN_DEPTH = 0.150;
const SYLVIAN_WIDTH = 0.070;
/** Subdivision level of the base icosahedron. 6 → 40,962 vertices / 81,920 faces — the resolution
 *  the sulci need: at level 5 a crease is only 2-3 vertices wide and reads as a lump. */
const SUBDIV = 6;
/**
 * Parcels over the WHOLE closed surface (Schaefer-scale on the lateral face we actually show).
 *
 * They are seeded everywhere, not just on the visible lateral face, even though the medial wall
 * never faces the camera. If the seeds stop at the rim, every vertex on the medial side falls
 * outside the blend radius, the kernel collapses to nearest-parcel, and the hard-edged mosaic comes
 * back — on the hidden side, where it is invisible to the eye but corrupts the surface field.
 */
const PARCEL_COUNT = 340;
/**
 * Each vertex blends the K nearest parcels — this is what dissolves the polygon edges. Both the K
 * and the KERNEL matter, and getting either wrong silently rebuilds the mosaic:
 *
 *  - an inverse-distance kernel (w = 1/d²) is so peaked that the nearest parcel wins outright, so a
 *    vertex simply TAKES its parcel's value and the borders come back hard (measured: adjacent
 *    vertices jumping a full 1.0 where a task-positive parcel abuts a default-mode one);
 *  - any kernel whose bandwidth is set by the nearest neighbour has the same failure, because the
 *    nearest still dominates whenever it happens to be much closer than the rest.
 *
 * What works is a FIXED bandwidth, wide enough to always span several parcels (BLEND_R ≈ 2 parcel
 * widths), decaying to exactly zero at its edge so a parcel entering or leaving the K-nearest set
 * does so with zero weight. Real fMRI surface maps are spatially smoothed for exactly this reason.
 *
 * K must also EXCEED the number of parcels that fall inside the radius, or the kernel is truncated:
 * parcels that ought to contribute get cut for being outside the K nearest, and which ones get cut
 * flips between adjacent vertices — the same discontinuity, wearing a different hat.
 */
export const BLEND_K = 24;
/** The blend radius, in mesh units. Parcel spacing is ≈ 0.11, so this spans ~18 parcels < K. */
const BLEND_R = 0.26;

/**
 * Network topography on the lateral surface, in shaped (x, y) coordinates: +x anterior, +y
 * superior. A vertex joins its nearest anchor. These follow the canonical Yeo-7 layout — visual at
 * the occipital pole, somatomotor along the central sulcus, DMN at the angular gyrus and medial
 * prefrontal, and so on.
 */
const ANCHORS: [NetworkId, number, number][] = [
  ['visual', -0.92, -0.06],
  ['visual', -0.86, 0.20],
  ['visual', -0.80, -0.30],
  ['somatomotor', 0.02, 0.60],
  ['somatomotor', -0.20, 0.55],
  ['somatomotor', 0.20, 0.52],
  ['dorsal_attention', -0.48, 0.44],
  ['dorsal_attention', 0.44, 0.42],
  ['salience', 0.26, 0.06],
  ['salience', 0.02, 0.20],
  ['salience', -0.10, -0.10],
  ['limbic', 0.58, -0.42],
  ['limbic', 0.22, -0.54],
  ['limbic', -0.14, -0.52],
  ['control', 0.72, 0.30],
  ['control', 0.50, 0.16],
  ['control', -0.62, 0.28],
  ['default', 0.88, 0.02],
  ['default', -0.56, 0.04],
  ['default', -0.40, -0.36],
];

// ── Perlin gradient noise (ours) ─────────────────────────────────────────────
const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Classic gradient noise, ≈[-1, 1]. */
function perlin3(x: number, y: number, z: number, seed: number): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const Z = Math.floor(z);
  const fx = x - X;
  const fy = y - Y;
  const fz = z - Z;
  const u = fade(fx);
  const v = fade(fy);
  const w = fade(fz);
  const dot = (cx: number, cy: number, cz: number) => {
    const g = GRAD3[hash3(X + cx, Y + cy, Z + cz, seed) % 12]!;
    return g[0]! * (fx - cx) + g[1]! * (fy - cy) + g[2]! * (fz - cz);
  };
  const x00 = lerp(dot(0, 0, 0), dot(1, 0, 0), u);
  const x10 = lerp(dot(0, 1, 0), dot(1, 1, 0), u);
  const x01 = lerp(dot(0, 0, 1), dot(1, 0, 1), u);
  const x11 = lerp(dot(0, 1, 1), dot(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The FOLD FIELD → cortical curvature at a point on the surface, 0 (deep in a sulcus) … 1 (a gyral
 * crown). Two octaves of anisotropic noise; the creases fall on the field's zero-crossings, which is
 * why they come out as a connected network of thin valleys between broad rounded gyri — the way a
 * real cortex folds, and not like a golf ball.
 */
function curvatureAt(x: number, y: number, z: number, seed: number): number {
  // ── DOMAIN WARP. This is what turns corduroy into cortex.
  //
  // Anisotropic noise on its own gives you straight parallel bands — a ribbed shell. Real gyri are
  // ribbons that MEANDER: they swell, bend around each other and fork. Warping the sample point by
  // a slow, large-scale noise before evaluating the fold field buys exactly that wandering, and it
  // is the single cheapest thing that stops the surface looking generated.
  const wx = 0.28 * perlin3(x * 1.7, y * 1.7, z * 1.7, seed ^ 0x51ed);
  const wy = 0.28 * perlin3(x * 1.7 + 4.7, y * 1.7 + 1.3, z * 1.7 - 2.1, seed ^ 0x2f3d);
  const X = x + wx;
  const Y = y + wy;
  const Z = z + 0.5 * wx;

  // ── ANISOTROPY. The previous field was near-isotropic (0.60 : 1.25, barely 2:1) and produced
  // round lumps — the "walnut / cauliflower" the owner kept rejecting. Real gyri are long: the
  // superior temporal, the middle frontal, the pre/postcentral all run as extended ribbons. So the
  // noise domain is heavily COMPRESSED along the antero-posterior axis (features vary slowly
  // front-to-back → they stretch that way) and STRETCHED across it (features vary fast top-to-bottom
  // → they stay narrow). That is a ~4.5:1 ratio, and it is the difference between a brain and a nut.
  const n =
    perlin3(X * FOLD_FREQ * 0.42, Y * FOLD_FREQ * 1.50, Z * FOLD_FREQ * 0.72, seed) +
    0.42 * perlin3(X * FOLD_FREQ * 0.95, Y * FOLD_FREQ * 2.70, Z * FOLD_FREQ * 1.45, seed ^ 0x9e37);
  const a = Math.abs(n);

  // The crease network: 0 in a sulcus, 1 once clear of it. On its own this SATURATES — everywhere
  // the noise clears SULCUS_WIDTH it pins to exactly 1.0, so every broad region between sulci comes
  // out as a perfectly FLAT plateau, and the render shows conspicuous smooth panels that no real
  // cortex has. A gyral crown is rounded, not a mesa.
  const crease = smoothstep(0.02, SULCUS_WIDTH, a);
  // ...so carry a non-saturating term as well, which keeps curving across the crowns.
  const crown = Math.min(1, a / 1.1);
  return 0.72 * crease + 0.28 * crown;
}

/**
 * The sylvian fissure: 0 on the fissure line, 1 away from it. It runs from the anterior notch
 * (between the frontal and temporal poles) up and back — the fold that separates the temporal lobe
 * from the rest. It must read as a CREASE, not a canyon: too wide and the brain looks sawn in half.
 */
function sylvian(x: number, y: number): number {
  // The fissure line, y = f(x). It springs from the anterior notch — where the profile now actually
  // has one — and sweeps up and back, the way the real lateral fissure runs toward the parietal
  // operculum. This is the cleft the temporal lobe hangs beneath, so it has to travel far enough to
  // BE that boundary; the previous line died almost as soon as it started and read as a scratch.
  const line = -0.34 + 0.40 * smoothstep(0.62, -0.42, x);
  const d = Math.abs(y - line) / SYLVIAN_WIDTH;
  // It still must not cross the WHOLE silhouette: a fissure running pole to pole stops reading as
  // the lateral fissure and starts reading as the interhemispheric midline, which flips the image
  // into a top-down view. So it opens at the notch and fades before the occipital pole.
  const extent = smoothstep(0.72, 0.52, x) * smoothstep(-0.52, -0.26, x);
  return 1 - extent * Math.exp(-d * d);
}

// ── THE PROFILE ───────────────────────────────────────────────────────────────
/**
 * The lateral silhouette of a hemisphere, authored as landmarks: (x, y) with **+x anterior, +y
 * superior**, walked counter-clockwise. This is the outline an eye checks FIRST, and for three
 * rounds it was an egg.
 *
 * It is authored rather than fitted from Gaussian lobes because the two features that matter most —
 * the sylvian notch and the temporal pole — sit only ~0.1 rad apart, so any radial-lobe stack deep
 * enough to cut a real notch also drags the temporal pole out into a beak. An explicit outline
 * decouples them, and it puts the anatomy where it can be read and corrected rather than tuned by
 * feel.
 *
 * The landmarks, in order:
 *  • the frontal pole, and the long rise over the superior frontal gyrus to the vertex;
 *  • the parietal crown, falling away to a TAPERED occipital pole;
 *  • the flat inferior surface — a brain rests on the floor of the skull, it is not round below;
 *  • the TEMPORAL POLE, thrusting forward and down;
 *  • and the NOTCH between that pole and the frontal lobe's orbital surface. That concavity is the
 *    single most recognisable thing about a brain in profile.
 */
const PROFILE: [number, number][] = [
  [0.99, 0.08], // frontal pole
  [0.93, 0.34],
  [0.78, 0.54],
  [0.55, 0.66],
  [0.28, 0.72],
  [0.0, 0.73], // vertex
  [-0.28, 0.7],
  [-0.55, 0.6],
  [-0.78, 0.42],
  [-0.94, 0.18],
  [-1.0, -0.06], // occipital pole
  [-0.92, -0.3],
  [-0.74, -0.46],
  [-0.5, -0.56],
  [-0.22, -0.61], // the flat inferior surface
  [0.06, -0.62],
  [0.34, -0.57],
  [0.58, -0.50],
  [0.72, -0.40], // temporal pole — forward and down, and it really does thrust
  [0.52, -0.20], // THE NOTCH — the outline cuts back in, hard
  [0.72, -0.14], // the frontal lobe's orbital surface, back out
  [0.9, -0.05],
];

/** Samples of the profile's radius, indexed by angle. 720 ≈ half-degree resolution. */
const PROFILE_N = 720;

/**
 * R(θ) for the profile: the factor the parametric ellipse point (A cosθ, B sinθ) is scaled by to
 * land on the authored outline. Built once at module load (~0.1ms), then read by every vertex.
 *
 * A landmark (x, y) sits at parametric angle atan2(y/B, x/A) and radius |(x/A, y/B)| — that is the
 * inverse of how `shape` composes a point, so the outline is reproduced exactly at the landmarks and
 * interpolated between them. The table is then BLURRED (periodically, twice): the landmarks are a
 * polygon, and a polygon's corners would otherwise crease the surface into visible facets. The blur
 * is deliberately narrow — widen it and the notch, which is the whole point, washes out.
 */
const PROFILE_R = ((): Float64Array => {
  const pts = PROFILE.map(([x, y]): [number, number] => [
    Math.atan2(y / B, x / A),
    Math.hypot(x / A, y / B),
  ]).sort((p, q) => p[0] - q[0]);

  const raw = new Float64Array(PROFILE_N);
  for (let i = 0; i < PROFILE_N; i++) {
    const th = -Math.PI + (2 * Math.PI * i) / PROFILE_N;
    // Bracket th between two landmarks, wrapping around the seam.
    let a = pts[pts.length - 1]!;
    let b = pts[0]!;
    for (let k = 0; k < pts.length; k++) {
      if (pts[k]![0] <= th) {
        a = pts[k]!;
        b = pts[(k + 1) % pts.length]!;
      }
    }
    let span = b[0] - a[0];
    if (span <= 0) span += 2 * Math.PI;
    let off = th - a[0];
    if (off < 0) off += 2 * Math.PI;
    const f = span > 0 ? off / span : 0;
    raw[i] = a[1] + (b[1] - a[1]) * f;
  }

  let cur = raw;
  const RADIUS = 7; // ~3.5° — enough to round a corner, too little to erase the notch
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float64Array(PROFILE_N);
    for (let i = 0; i < PROFILE_N; i++) {
      let sum = 0;
      for (let k = -RADIUS; k <= RADIUS; k++) {
        sum += cur[(i + k + PROFILE_N) % PROFILE_N]!;
      }
      next[i] = sum / (2 * RADIUS + 1);
    }
    cur = next;
  }
  return cur;
})();

/** The profile's radius at a parametric angle, linearly interpolated off the smoothed table. */
function profileRadius(th: number): number {
  const u = ((th + Math.PI) / (2 * Math.PI)) * PROFILE_N;
  const i0 = ((Math.floor(u) % PROFILE_N) + PROFILE_N) % PROFILE_N;
  const i1 = (i0 + 1) % PROFILE_N;
  const f = u - Math.floor(u);
  return PROFILE_R[i0]! * (1 - f) + PROFILE_R[i1]! * f;
}

/**
 * The base shape. An ellipsoid is a potato; a brain has a PROFILE, and the profile is what the eye
 * checks first. In the lateral plane (θ = 0 anterior, θ = π/2 superior) the silhouette is an ellipse
 * modulated by three features that a plain ellipse lacks:
 *
 *   • the anterior NOTCH — the temporal pole sits back and below the frontal pole, and the gap
 *     between them is the single most recognisable thing about a brain in profile;
 *   • the TEMPORAL POLE bulging forward-down beneath it;
 *   • a drawn-in occipital pole and a full parietal crown.
 */
function shape(ux: number, uy: number, uz: number): [number, number, number] {
  // The silhouette comes from the AUTHORED PROFILE (see PROFILE / profileRadius), not from a stack
  // of Gaussian lobes. Radial lobes could never draw a brain: every attempt to deepen the sylvian
  // notch enough to read also blew the temporal pole out into a beak, because the two features
  // overlap in angle. An explicit outline decouples them.
  const R = profileRadius(Math.atan2(uy, ux));

  const x = A * ux * R;
  const y = B * uy * R;
  let z = C * uz;

  // Through-thickness. The frontal pole narrows through the temple, the occipital tapers, and the
  // temporal lobe is THINNER than the mass above it — that last one is what keeps the temporal lobe
  // legible as a lobe in a 3/4 view instead of merging into the hemisphere's bulk.
  const frontTaper = 1 - 0.24 * smoothstep(0.35, 1.0, ux);
  const backTaper = 1 - 0.12 * smoothstep(0.50, 1.0, -ux);
  const tempTaper = 1 - 0.16 * smoothstep(-0.10, -0.62, uy);
  z *= frontTaper * backTaper * tempTaper;

  // The medial face is a flat wall, not a bulge.
  if (z < 0) z *= MEDIAL_FLATTEN;

  return [x, y, z];
}

// ── Icosphere ────────────────────────────────────────────────────────────────
function icosphere(level: number): { pos: number[][]; idx: number[][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const pos: number[][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((p) => normalize(p as [number, number, number]));
  let idx = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let k = 0; k < level; k++) {
    const mid = new Map<string, number>();
    const next: number[][] = [];
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const hit = mid.get(key);
      if (hit !== undefined) return hit;
      const pa = pos[a]!;
      const pb = pos[b]!;
      const m = normalize([pa[0]! + pb[0]!, pa[1]! + pb[1]!, pa[2]! + pb[2]!]);
      pos.push(m);
      const i = pos.length - 1;
      mid.set(key, i);
      return i;
    };
    for (const [a, b, c] of idx) {
      const ab = midpoint(a!, b!);
      const bc = midpoint(b!, c!);
      const ca = midpoint(c!, a!);
      next.push([a!, ab, ca], [b!, bc, ab], [c!, ca, bc], [ab, bc, ca]);
    }
    idx = next;
  }
  return { pos, idx };
}

function normalize(p: [number, number, number] | number[]): number[] {
  const l = Math.hypot(p[0]!, p[1]!, p[2]!) || 1;
  return [p[0]! / l, p[1]! / l, p[2]! / l];
}

// ── The mesh ─────────────────────────────────────────────────────────────────
export interface CortexMesh {
  /** Vertex positions, xyz-interleaved. */
  positions: Float32Array;
  /** Vertex normals, recomputed AFTER folding — this is what the light reads. */
  normals: Float32Array;
  /** Cortical curvature per vertex: 0 = sulcal depth, 1 = gyral crown. Drives the base gray + AO. */
  curv: Float32Array;
  /** Triangle indices. */
  indices: Uint32Array;
  /** Per-vertex: the K nearest parcels, and their (normalized) blend weights. */
  blendIdx: Uint16Array;
  blendW: Float32Array;
  /** Per-parcel network, and the parcel centroid in shaped (x, y) — feeds `parcelTexture`. */
  parcelNet: NetworkId[];
  parcelCx: Float32Array;
  parcelCy: Float32Array;
  vertexCount: number;
  parcelCount: number;
}

const nearestNetwork = (x: number, y: number): NetworkId => {
  let best = ANCHORS[0]![0];
  let bd = Infinity;
  for (const [net, ax, ay] of ANCHORS) {
    const d = (x - ax) ** 2 + (y - ay) ** 2;
    if (d < bd) {
      bd = d;
      best = net;
    }
  }
  return best;
};

function build(seed: number): CortexMesh {
  const { pos: unit, idx } = icosphere(SUBDIV);
  const n = unit.length;

  const positions = new Float32Array(n * 3);
  const curv = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const [ux, uy, uz] = unit[i] as [number, number, number];
    const [sx, sy, sz] = shape(ux, uy, uz);

    // Curvature is sampled on the SMOOTH shape, so the folds do not slide as the shape changes.
    const c = curvatureAt(sx, sy, sz, seed);
    const syl = sylvian(sx, sy);

    // The fissure DARKENS the surface (it is a deep crease, so it shades like one)...
    curv[i] = Math.min(c, syl);

    // ...but the fold DISPLACEMENT keeps using the raw fold field, NOT the fissure-suppressed one.
    // Displacing by min(c, syl) flattens every gyrus within the fissure's falloff, leaving a broad
    // smooth trough across the middle of the brain — which renders as a conspicuous flat panel, the
    // one artifact that instantly gives the surface away as generated. The fissure is an EXTRA groove
    // cut into a fully folded cortex, not an eraser.
    const [nx, ny, nz] = normalize([sx / (A * A), sy / (B * B), sz / (C * C)]) as [number, number, number];
    const d = FOLD_AMP * (c - 0.5) - SYLVIAN_DEPTH * (1 - syl);
    positions[i * 3] = sx + nx * d;
    positions[i * 3 + 1] = sy + ny * d;
    positions[i * 3 + 2] = sz + nz * d;
  }

  // Triangles, wound outward.
  const indices = new Uint32Array(idx.length * 3);
  for (let f = 0; f < idx.length; f++) {
    indices[f * 3] = idx[f]![0]!;
    indices[f * 3 + 1] = idx[f]![1]!;
    indices[f * 3 + 2] = idx[f]![2]!;
  }

  // Vertex normals from the FOLDED mesh — accumulate area-weighted face normals. Without this the
  // folds exist in the geometry but the light cannot see them, and the brain goes flat again.
  const normals = new Float32Array(n * 3);
  for (let f = 0; f < indices.length; f += 3) {
    const a = indices[f]! * 3;
    const b = indices[f + 1]! * 3;
    const c = indices[f + 2]! * 3;
    const ax = positions[a]!, ay = positions[a + 1]!, az = positions[a + 2]!;
    const e1x = positions[b]! - ax, e1y = positions[b + 1]! - ay, e1z = positions[b + 2]! - az;
    const e2x = positions[c]! - ax, e2y = positions[c + 1]! - ay, e2z = positions[c + 2]! - az;
    const fx = e1y * e2z - e1z * e2y;
    const fy = e1z * e2x - e1x * e2z;
    const fz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      normals[v] = normals[v]! + fx;
      normals[v + 1] = normals[v + 1]! + fy;
      normals[v + 2] = normals[v + 2]! + fz;
    }
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!) || 1;
    normals[i * 3] = normals[i * 3]! / l;
    normals[i * 3 + 1] = normals[i * 3 + 1]! / l;
    normals[i * 3 + 2] = normals[i * 3 + 2]! / l;
  }

  // ── Parcels. Farthest-point sampling over ALL vertices gives an even parcellation (a clumped one
  //    is a tell), deterministically.
  const rng = mulberry32(seed);
  const seeds: number[] = [Math.floor(rng() * n)];
  const far = new Float32Array(n).fill(Infinity);
  for (let k = 1; k < PARCEL_COUNT; k++) {
    const s = seeds[k - 1]! * 3;
    let bestI = 0;
    let bestD = -1;
    for (let j = 0; j < n; j++) {
      const v = j * 3;
      const d =
        (positions[v]! - positions[s]!) ** 2 +
        (positions[v + 1]! - positions[s + 1]!) ** 2 +
        (positions[v + 2]! - positions[s + 2]!) ** 2;
      if (d < far[j]!) far[j] = d;
      if (far[j]! > bestD) {
        bestD = far[j]!;
        bestI = j;
      }
    }
    seeds.push(bestI);
  }

  const parcelCount = seeds.length;
  const parcelNet: NetworkId[] = [];
  const parcelCx = new Float32Array(parcelCount);
  const parcelCy = new Float32Array(parcelCount);
  for (let k = 0; k < parcelCount; k++) {
    const v = seeds[k]! * 3;
    const x = positions[v]!;
    const y = positions[v + 1]!;
    parcelCx[k] = x;
    parcelCy[k] = y;
    parcelNet.push(nearestNetwork(x, y));
  }

  // Per-vertex blend over the K nearest parcels (inverse-distance). This is the step that kills the
  // mosaic: a vertex near a parcel border is a genuine MIX of both, so the heat crosses the border
  // as a gradient instead of a visible polygon edge.
  const blendIdx = new Uint16Array(n * BLEND_K);
  const blendW = new Float32Array(n * BLEND_K);
  const bi = new Array<number>(BLEND_K);
  const bd = new Array<number>(BLEND_K);
  for (let i = 0; i < n; i++) {
    bi.fill(0);
    bd.fill(Infinity);
    const v = i * 3;
    for (let k = 0; k < parcelCount; k++) {
      const s = seeds[k]! * 3;
      const d =
        (positions[v]! - positions[s]!) ** 2 +
        (positions[v + 1]! - positions[s + 1]!) ** 2 +
        (positions[v + 2]! - positions[s + 2]!) ** 2;
      // Insertion into the running K-nearest.
      for (let q = 0; q < BLEND_K; q++) {
        if (d < bd[q]!) {
          for (let r = BLEND_K - 1; r > q; r--) {
            bd[r] = bd[r - 1]!;
            bi[r] = bi[r - 1]!;
          }
          bd[q] = d;
          bi[q] = k;
          break;
        }
      }
    }
    // Fixed-bandwidth, compactly supported: several parcels always contribute, and the kernel is
    // exactly zero at BLEND_R so a parcel entering or leaving the set carries no weight when it does.
    let sum = 0;
    for (let q = 0; q < BLEND_K; q++) {
      const d = Math.sqrt(bd[q]!);
      const u = d / BLEND_R;
      const w = u >= 1 ? 0 : (1 - u) * (1 - u);
      blendW[i * BLEND_K + q] = w;
      blendIdx[i * BLEND_K + q] = bi[q]!;
      sum += w;
    }
    if (sum <= 1e-9) {
      // Nothing within the radius (the far medial wall, which never faces the camera): fall back to
      // the nearest parcel rather than dividing by zero.
      blendW[i * BLEND_K] = 1;
      sum = 1;
    }
    for (let q = 0; q < BLEND_K; q++) blendW[i * BLEND_K + q] = blendW[i * BLEND_K + q]! / sum;
  }

  return {
    positions,
    normals,
    curv,
    indices,
    blendIdx,
    blendW,
    parcelNet,
    parcelCx,
    parcelCy,
    vertexCount: n,
    parcelCount,
  };
}

const CACHE = new Map<number, CortexMesh>();

/** The folded cortex for a seed. Memoized — the build is pure, so this is safe to share. */
export function cortexMesh(seed: number): CortexMesh {
  let hit = CACHE.get(seed);
  if (!hit) {
    hit = build(seed);
    CACHE.set(seed, hit);
  }
  return hit;
}

/**
 * Per-parcel texture — how hot a parcel runs relative to its network, and its own slow drift.
 * Computed once per surface, never per frame.
 *
 * `parcelTexture`'s spatial noise was tuned for the old 300×200 drawing box, so the mesh's
 * unit-scale centroids are scaled into that range. Without it the noise is effectively constant
 * across the whole surface and every parcel gets the same bias — a flat, obviously-fake map.
 */
export function parcelTextures(mesh: CortexMesh, seed: number): ParcelTexture[] {
  return Array.from({ length: mesh.parcelCount }, (_, k) =>
    parcelTexture(k, seed, mesh.parcelCx[k]! * 100, mesh.parcelCy[k]! * 100),
  );
}

/**
 * The predicted BOLD as a SIGNED per-vertex field: task-positive networks push positive, the
 * default-mode system pushes negative (a real anticorrelation, and the reason the locked accent
 * dosage rule survives — coral only ever means "you are losing them").
 *
 * Each vertex is an inverse-distance blend of its nearest parcels, so a value crosses a parcel
 * border as a GRADIENT. That is what dissolves the visible mosaic that made the first two cuts of
 * this view read as generated rather than measured.
 */
export function surfaceValues(
  mesh: CortexMesh,
  textures: ParcelTexture[],
  bold: Record<NetworkId, number>,
  t: number,
): Float32Array {
  const parcels = new Float32Array(mesh.parcelCount);
  for (let k = 0; k < mesh.parcelCount; k++) {
    const net = mesh.parcelNet[k]!;
    parcels[k] = parcelValue(bold[net], textures[k]!, t) * NETWORK_POLARITY[net];
  }
  const out = new Float32Array(mesh.vertexCount);
  for (let i = 0; i < mesh.vertexCount; i++) {
    let v = 0;
    for (let q = 0; q < BLEND_K; q++) {
      const b = i * BLEND_K + q;
      v += mesh.blendW[b]! * parcels[mesh.blendIdx[b]!]!;
    }
    out[i] = v;
  }
  return out;
}

/** Network polarity: the default-mode system is the negative pole of the diverging map. */
export const NETWORK_POLARITY: Record<NetworkId, 1 | -1> = {
  visual: 1,
  somatomotor: 1,
  dorsal_attention: 1,
  salience: 1,
  limbic: 1,
  control: 1,
  default: -1,
};

export const NETWORK_META: Record<NetworkId, { label: string; note: string }> = {
  visual: { label: 'Visual', note: 'what they see' },
  somatomotor: { label: 'Somatomotor', note: 'the urge to act' },
  dorsal_attention: { label: 'Dorsal attention', note: 'focus, held on purpose' },
  salience: { label: 'Salience', note: 'what grabs them' },
  limbic: { label: 'Limbic', note: 'feeling & value' },
  control: { label: 'Frontoparietal', note: 'working it out' },
  default: { label: 'Default mode', note: 'mind-wandering' },
};

/** Index of a network in NETWORK_IDS — used to pack per-vertex network ids for the renderer. */
export const netIndex = (id: NetworkId) => NETWORK_IDS.indexOf(id);
