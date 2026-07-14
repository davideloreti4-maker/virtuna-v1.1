/**
 * cortex-field — the network field painted onto the REAL cortical surface.
 *
 * This replaces the parcellation half of the old `cortex-mesh.ts`. The geometry half is gone: we no
 * longer GENERATE a brain (an ellipsoid + Perlin noise), we load one — a FreeSurfer surface
 * reconstructed from a T1-weighted MRI (`public/brain/cortex.glb`, CC-BY dgallichan). Five rejections
 * were all, in the end, about that one distinction.
 *
 * What survives from the old module, because it was never the problem:
 *   parcels → networks → a fixed-bandwidth blend → a signed per-vertex field.
 *
 * ⚠️ THE LANDMINE (handoff §5). The old blend radius was a CONSTANT (0.26) tuned to the procedural
 * mesh's unit scale. Parcel spacing is a function of the geometry — surface area and vertex count —
 * so a hardcoded radius silently becomes wrong the moment the mesh changes, and "wrong" here does not
 * look like an error: it looks like a hard-edged mosaic, or a uniform smear. That is exactly what
 * broke the map last time. So BLEND_R is now DERIVED from the parcel spacing this mesh actually has,
 * and `fieldDiagnostics()` re-runs the gradient probe that catches it.
 */

import {
  NETWORK_IDS,
  mulberry32,
  parcelTexture,
  parcelValue,
  type NetworkId,
  type ParcelTexture,
} from './cortex-sim';

/**
 * Schaefer-scale, bilateral. The old mesh showed one hemisphere and used 340; this surface is a whole
 * brain (both hemispheres + cerebellum), so it carries more area and takes the standard 400.
 */
const PARCEL_COUNT = 400;

/**
 * The HARD CAP on the blend stride. The stride itself (`field.blendK`) is chosen at build time to fit
 * the geometry — see below. This is only the ceiling that stops a pathological mesh from allocating
 * an absurd buffer (at 64 the blend arrays are ~25MB; that is the most we will ever spend).
 */
export const BLEND_K_MAX = 64;

/**
 * ⚠️ THE BANDWIDTH, AND WHY K — NOT THE RADIUS — IS THE THING THAT HAS TO GIVE.
 *
 * The kernel is squeezed from both sides, and the gradient probe measured both walls on this mesh:
 *
 *  - radius too WIDE (2.4x spacing, the old mesh's value) → more parcels land inside it than the
 *    stride can hold, so the K-nearest cut DROPS contributors. Which ones get dropped flips between
 *    adjacent vertices, so the field jumps at the seam. Measured maxStep: 0.279. A mosaic.
 *  - radius too NARROW (backing off to make it fit) → the nearest parcel dominates outright and each
 *    vertex effectively TAKES its parcel's value. Measured maxStep: 0.555. A worse mosaic.
 *
 * Both walls are the same bug: the stride was a hardcoded 24. A whole brain in 3D simply has more
 * parcel neighbours inside a Euclidean ball than the old single hemisphere did, so the honest fix is
 * to keep the wide, smooth bandwidth and SIZE THE STRIDE TO FIT IT — measured on the actual surface,
 * with headroom, so no vertex anywhere truncates.
 *
 * (The deeper reason the ball is crowded: Euclidean distance on a folded surface pulls in parcels
 * that sit across a sulcus — physically near, geodesically far. A geodesic kernel would be the
 * textbook answer; it is not worth its cost here, and a stride that fits makes the field smooth
 * regardless.)
 */
const BLEND_R_IN_SPACINGS = 2.2;
/** Headroom over the measured worst case, so no vertex on the surface truncates. */
const K_HEADROOM = 6;

/**
 * Network topography, in normalised anatomical coordinates on the lateral surface:
 *   `ant` = anterior (+1 frontal pole … −1 occipital pole)
 *   `sup` = superior (+1 vertex … −1 temporal/inferior)
 * The canonical Yeo-7 layout — visual at the occipital pole, somatomotor along the central sulcus,
 * the default-mode system at the angular gyrus and rostral prefrontal, and so on.
 *
 * These are MIRRORED onto both hemispheres, because the Yeo networks are bilateral and this mesh
 * (unlike the old one) has two sides. Anchoring one side only would light the left cortex and leave
 * the right one dead — visible the moment the specimen turns.
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

/**
 * ⚠️ THE MESH'S AXES — measured from the built asset, not assumed.
 *
 *   +X = the subject's RIGHT      (so the LEFT hemisphere, the one plated in every anatomical
 *                                  figure and the one our label claims, is −X)
 *   +Y = SUPERIOR (up)
 *   −Z = ANTERIOR (the frontal pole)   ← note the sign
 *
 * Derived twice and cross-checked: (1) FreeSurfer writes RAS, and the exporter's root rotation maps
 * RAS(x,y,z) → glTF(x, z, −y), which sends +anterior to −Z; (2) rendering from −X puts the cerebellum
 * — which is posterior-inferior in every skull — on the +Z side of the frame. `cortex-field.test.ts`
 * pins this with the cerebellum test, because getting it backwards silently mirrors the entire map
 * front-to-back: visual cortex would light the forehead and nobody would see an error, just a wrong
 * brain.
 */
export const AXES = { left: -1, superior: 1, anterior: -1 } as const;

export interface CortexField {
  /** Per-parcel network assignment. */
  parcelNet: NetworkId[];
  /** Parcel centroids, in mesh space — feed `parcelTexture`'s spatial noise. */
  parcelCx: Float32Array;
  parcelCy: Float32Array;
  /** Per-vertex: the K nearest parcels and their normalised blend weights. */
  blendIdx: Uint16Array;
  blendW: Float32Array;
  vertexCount: number;
  parcelCount: number;
  /** Measured median nearest-parcel distance, in mesh units (mm). The bandwidth is derived from it. */
  spacing: number;
  /** The radius actually used, in mesh units — SELF-TUNED to this geometry, never a constant. */
  blendR: number;
  /** The worst-case number of parcels inside that radius, measured on this surface. */
  parcelsInKernel: number;
  /** The blend stride actually used — SIZED to parcelsInKernel + headroom, never hardcoded. */
  blendK: number;
}

/**
 * Build the parcellation + blend for a surface.
 *
 * The geometry is now FIXED (one shipped asset), so this is computed once per session and shared
 * across every focus — it does NOT depend on the focus seed. That is what lets us delete the old
 * ~500ms per-open mesh build outright rather than merely moving it.
 */
export function buildField(positions: Float32Array, seed = 0x5eed): CortexField {
  const n = positions.length / 3;

  // ── Parcels: farthest-point sampling gives an even parcellation, deterministically. A clumped one
  //    is an instant tell, and an uneven one makes the blend bandwidth mean different things in
  //    different places.
  const rng = mulberry32(seed);
  const first = Math.floor(rng() * n);
  const seeds: number[] = [first];
  const far = new Float32Array(n).fill(Infinity);

  const d2 = (a: number, b: number) => {
    const i = a * 3, j = b * 3;
    return (
      (positions[i]! - positions[j]!) ** 2 +
      (positions[i + 1]! - positions[j + 1]!) ** 2 +
      (positions[i + 2]! - positions[j + 2]!) ** 2
    );
  };

  for (let k = 1; k < PARCEL_COUNT; k++) {
    const s = seeds[k - 1]!;
    let bestI = 0;
    let bestD = -1;
    for (let j = 0; j < n; j++) {
      const d = d2(j, s);
      if (d < far[j]!) far[j] = d;
      if (far[j]! > bestD) {
        bestD = far[j]!;
        bestI = j;
      }
    }
    seeds.push(bestI);
  }

  const parcelCount = seeds.length;

  // ── MEASURE the spacing this geometry actually produced, then set the bandwidth from it.
  //    This is the §5 fix: the old constant was silently wrong for any mesh but the one it was
  //    tuned on, and a wrong bandwidth does not throw — it just draws a mosaic.
  const nn: number[] = [];
  for (let k = 0; k < parcelCount; k++) {
    let best = Infinity;
    for (let m = 0; m < parcelCount; m++) {
      if (m === k) continue;
      const d = d2(seeds[k]!, seeds[m]!);
      if (d < best) best = d;
    }
    nn.push(Math.sqrt(best));
  }
  nn.sort((a, b) => a - b);
  const spacing = nn[Math.floor(parcelCount / 2)]!;

  // ── Keep the wide bandwidth, and SIZE THE STRIDE TO IT. Measure the worst-case crowding over a
  //    sample that walks the whole surface (every 313th vertex — coprime with everything in sight,
  //    so it does not land repeatedly on one lobe), then give the stride headroom above it.
  let blendR = spacing * BLEND_R_IN_SPACINGS;
  // EXACT, over every vertex — not a sample. A sample (every 313rd vertex) measured 20 and the probe
  // still failed at maxStep 0.324: the true worst case lives on vertices the sample never visited, and
  // those few vertices truncate, and a handful of truncating vertices is all a visible seam needs.
  // O(n x parcels) — the same cost as the blend loop below, paid once per session.
  const worstCountAt = (r: number): number => {
    const rr = r * r;
    let worst = 0;
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let k = 0; k < parcelCount; k++) if (d2(i, seeds[k]!) < rr) c++;
      if (c > worst) worst = c;
    }
    return worst;
  };

  let parcelsInKernel = worstCountAt(blendR);
  // Only if even the cap cannot hold this geometry do we narrow the radius — and then we say so,
  // because a narrowed radius is the beginning of the mosaic.
  while (parcelsInKernel + K_HEADROOM > BLEND_K_MAX && blendR > spacing) {
    blendR *= 0.9;
    parcelsInKernel = worstCountAt(blendR);
  }
  const blendK = Math.min(BLEND_K_MAX, parcelsInKernel + K_HEADROOM);

  // ── Networks. Anchors are placed in the mesh's own frame from the bbox, MIRRORED across the
  //    midline, and snapped to the nearest actual surface vertex so no anchor floats inside the brain.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = i * 3;
    minX = Math.min(minX, positions[v]!); maxX = Math.max(maxX, positions[v]!);
    minY = Math.min(minY, positions[v + 1]!); maxY = Math.max(maxY, positions[v + 1]!);
    minZ = Math.min(minZ, positions[v + 2]!); maxZ = Math.max(maxZ, positions[v + 2]!);
  }
  const hx = (maxX - minX) / 2, hy = (maxY - minY) / 2, hz = (maxZ - minZ) / 2;
  const cx = (maxX + minX) / 2, cy = (maxY + minY) / 2, cz = (maxZ + minZ) / 2;

  const anchors3: { net: NetworkId; x: number; y: number; z: number }[] = [];
  for (const [net, ant, sup] of ANCHORS) {
    for (const side of [-1, 1] as const) {
      // 0.82 of the half-width puts the anchor out on the lateral surface rather than at the midline.
      const target = {
        x: cx + side * 0.82 * hx,
        y: cy + sup * 0.78 * hy,
        z: cz + AXES.anterior * ant * 0.82 * hz,
      };
      // Snap to the nearest real vertex ON THE CORRECT SIDE — a raw bbox point sits in mid-air.
      let bi = -1, bd = Infinity;
      for (let i = 0; i < n; i++) {
        const v = i * 3;
        const px = positions[v]!;
        if (Math.sign(px - cx) !== side) continue;
        const d =
          (px - target.x) ** 2 +
          (positions[v + 1]! - target.y) ** 2 +
          (positions[v + 2]! - target.z) ** 2;
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0) continue;
      const v = bi * 3;
      anchors3.push({ net, x: positions[v]!, y: positions[v + 1]!, z: positions[v + 2]! });
    }
  }

  const parcelNet: NetworkId[] = [];
  const parcelCx = new Float32Array(parcelCount);
  const parcelCy = new Float32Array(parcelCount);
  for (let k = 0; k < parcelCount; k++) {
    const v = seeds[k]! * 3;
    const px = positions[v]!, py = positions[v + 1]!, pz = positions[v + 2]!;
    parcelCx[k] = px;
    parcelCy[k] = py;
    let best: NetworkId = anchors3[0]!.net;
    let bd = Infinity;
    for (const a of anchors3) {
      const d = (px - a.x) ** 2 + (py - a.y) ** 2 + (pz - a.z) ** 2;
      if (d < bd) { bd = d; best = a.net; }
    }
    parcelNet.push(best);
  }

  // ── Per-vertex blend over the K nearest parcels. Fixed bandwidth, compactly supported: the kernel
  //    is exactly ZERO at blendR, so a parcel entering or leaving the K-nearest set carries no weight
  //    when it does. That is what makes the field continuous across parcel borders.
  const blendIdx = new Uint16Array(n * blendK);
  const blendW = new Float32Array(n * blendK);
  const bi = new Array<number>(blendK);
  const bd = new Array<number>(blendK);

  for (let i = 0; i < n; i++) {
    bi.fill(0);
    bd.fill(Infinity);
    for (let k = 0; k < parcelCount; k++) {
      const d = d2(i, seeds[k]!);
      for (let q = 0; q < blendK; q++) {
        if (d < bd[q]!) {
          for (let r = blendK - 1; r > q; r--) {
            bd[r] = bd[r - 1]!;
            bi[r] = bi[r - 1]!;
          }
          bd[q] = d;
          bi[q] = k;
          break;
        }
      }
    }
    let sum = 0;
    for (let q = 0; q < blendK; q++) {
      const u = Math.sqrt(bd[q]!) / blendR;
      const w = u >= 1 ? 0 : (1 - u) * (1 - u);
      blendW[i * blendK + q] = w;
      blendIdx[i * blendK + q] = bi[q]!;
      sum += w;
    }
    if (sum <= 1e-9) {
      // Nothing inside the radius at all — fall back to the nearest parcel rather than divide by zero.
      blendW[i * blendK] = 1;
      sum = 1;
    }
    for (let q = 0; q < blendK; q++) blendW[i * blendK + q] = blendW[i * blendK + q]! / sum;
  }

  return {
    parcelNet, parcelCx, parcelCy, blendIdx, blendW,
    vertexCount: n, parcelCount, spacing, blendR, parcelsInKernel, blendK,
  };
}

/** Per-parcel texture: how hot a parcel runs relative to its network, plus its own slow drift. */
export function parcelTextures(field: CortexField, seed: number): ParcelTexture[] {
  return Array.from({ length: field.parcelCount }, (_, k) =>
    parcelTexture(k, seed, field.parcelCx[k]!, field.parcelCy[k]!),
  );
}

/**
 * The predicted BOLD as a SIGNED per-vertex field: task-positive networks push positive, the
 * default-mode system pushes negative (a real anticorrelation — and the reason the LOCKED accent
 * dosage rule survives, because coral only ever means "you are losing them").
 */
export function surfaceValues(
  field: CortexField,
  textures: ParcelTexture[],
  bold: Record<NetworkId, number>,
  t: number,
): Float32Array {
  const parcels = new Float32Array(field.parcelCount);
  for (let k = 0; k < field.parcelCount; k++) {
    const net = field.parcelNet[k]!;
    parcels[k] = parcelValue(bold[net], textures[k]!, t) * NETWORK_POLARITY[net];
  }
  const out = new Float32Array(field.vertexCount);
  const K = field.blendK;
  for (let i = 0; i < field.vertexCount; i++) {
    let v = 0;
    for (let q = 0; q < K; q++) {
      const b = i * K + q;
      v += field.blendW[b]! * parcels[field.blendIdx[b]!]!;
    }
    out[i] = v;
  }
  return out;
}

/**
 * THE GRADIENT PROBE (handoff §5) — the test that catches a broken bandwidth.
 *
 * A wrong blend radius does not throw. It produces either a hard-edged mosaic (radius too small —
 * the nearest parcel wins outright) or a uniform smear (radius too large — every vertex averages the
 * whole brain). Both look "fine" in a thumbnail. What separates them is the DISTRIBUTION OF
 * NEIGHBOURING-VERTEX DIFFERENCES: a smooth field has a small maximum step and a small mean step; a
 * mosaic has a big maximum step at the borders; a smear has an almost-zero maximum AND no range.
 *
 * So this reports the numbers the tests assert on, rather than anyone eyeballing a render.
 */
export function fieldDiagnostics(
  field: CortexField,
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  values: Float32Array,
): {
  maxStep: number;
  meanStep: number;
  /** The real smoothness metric: the biggest field change ACROSS ONE PARCEL SPACING. */
  maxSlopePerSpacing: number;
  range: number;
  parcelsInRadius: number;
} {
  let maxStep = 0;
  let maxSlope = 0; // per unit distance
  let sum = 0;
  let count = 0;

  // ⚠️ MEASURE THE GRADIENT, NOT THE STEP.
  //
  // The first version of this probe asserted |Δvalue| per EDGE and assumed edges are ~1mm apart. They
  // are not: meshopt leaves long triangles in flat regions, and the worst edge on this mesh is nearly
  // a full parcel spacing long. So a perfectly smooth field showed a 0.324 "step" and the probe read
  // it as a mosaic — a series measured without its x-axis. (Same trap as §10.3, where two of three
  // trace designs plotted noise as data.)
  //
  // What actually distinguishes a mosaic from a smooth field is the SLOPE: a mosaic jumps a large
  // value across a near-zero distance. So normalise by edge length, then express it in the only unit
  // that means anything here — field change per parcel spacing.
  const edge = (a: number, b: number) => {
    const d = Math.abs(values[a]! - values[b]!);
    if (d > maxStep) maxStep = d;
    sum += d;
    count++;
    const len = Math.hypot(
      positions[a * 3]! - positions[b * 3]!,
      positions[a * 3 + 1]! - positions[b * 3 + 1]!,
      positions[a * 3 + 2]! - positions[b * 3 + 2]!,
    );
    if (len > 1e-6) {
      const slope = d / len;
      if (slope > maxSlope) maxSlope = slope;
    }
  };
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]!, b = indices[t + 1]!, c = indices[t + 2]!;
    edge(a, b); edge(b, c); edge(c, a);
  }

  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    lo = Math.min(lo, values[i]!);
    hi = Math.max(hi, values[i]!);
  }

  // How many parcels actually land inside the kernel — must be several, and must stay under BLEND_K
  // or the kernel is truncated and the mosaic returns on the hidden side of the surface.
  let inRadius = 0;
  const probe = Math.floor(field.vertexCount / 2);
  for (let q = 0; q < field.blendK; q++) if (field.blendW[probe * field.blendK + q]! > 0) inRadius++;

  return {
    maxStep,
    meanStep: sum / Math.max(1, count),
    maxSlopePerSpacing: maxSlope * field.spacing,
    range: hi - lo,
    parcelsInRadius: inRadius,
  };
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
