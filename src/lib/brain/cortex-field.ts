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
  contrastBold,
  NETWORK_IDS,
  mulberry32,
  parcelTexture,
  parcelValue,
  type NetworkId,
  type ParcelTexture,
} from './cortex-sim';

/**
 * ⚠️ RAISED 400 → 1200 TO MATCH THE REFERENCE'S GRAIN (the 2026-07-15 rebuild). 400 parcels painted
 * broad CONTINENTS; the reference (thesapientcompany.com/intelligence) is fine-grained and mottled,
 * and that grain is the single biggest reason theirs reads as a scan and ours read as gouache.
 *
 * More parcels = smaller spacing = finer features at a SAFE blend multiple. The key measurement:
 * `maxSlopePerSpacing` (the mosaic guard in cortex-field.test) is scale-invariant at a fixed
 * `BLEND_R_IN_SPACINGS` — ~0.79 whether 800 or 1600 parcels — so the map gets finer WITHOUT hardening
 * into a mosaic, as long as the radius-in-spacings stays put. 1200 is the sweet spot: 31% finer
 * absolute spacing than the old 400, comfortable slope margin, blendK 53 (< the 64 cap).
 *
 * The build is one-time and memoized (`CortexCanvas` FIELD cache); `surfaceValues` runs at the ~372ms
 * scan tick, not per frame, so the larger blend stride costs nothing that matters. Whole brain (both
 * hemispheres + cerebellum), FreeSurfer surface — so parcels are bilateral by construction.
 */
const PARCEL_COUNT = 1200;

/**
 * The HARD CAP on the blend stride. The stride itself (`field.blendK`) is chosen at build time to fit
 * the geometry — see below. This is only the ceiling that stops a pathological mesh from allocating
 * an absurd buffer (at 64 the blend arrays are ~25MB; that is the most we will ever spend).
 */
export const BLEND_K_MAX = 64;

/**
 * ⚠️ THE BANDWIDTH — HOW SMOOTH, IN UNITS OF PARCEL SPACING. Grain comes from PARCEL_COUNT (finer
 * parcels), NOT from tightening this — tighten it and the map hardens into a mosaic.
 *
 * The kernel is `(1 − u)²`, so the nearest parcel always weighs most. Squeeze the radius and it
 * dominates outright — each vertex effectively TAKES its parcel's value and the borders go hard.
 * Measured on THIS mesh, mottle off, the mosaic guard `maxSlopePerSpacing` (< 1.0):
 *
 *  - radius 1.3× spacing → 2.84.  A hard mosaic. This is the wall, and it is why finer grain does NOT
 *    come from a tighter radius (three rounds burned learning that the hard way — see git log).
 *  - radius 2.0× spacing → 1.13.  Still over the guard on the finer parcellation.
 *  - radius 2.4× spacing → 0.79.  Smooth, with margin — and scale-invariant, so it holds as parcels
 *    rise. THIS is the value: keep the radius SMOOTH and buy grain by adding parcels instead.
 *
 * Both walls are ultimately the stride: a whole brain in 3D has many parcel neighbours inside a
 * Euclidean ball, so the stride (`blendK`) is SIZED TO FIT the radius — measured on the actual
 * surface, with headroom, so no vertex truncates. (Euclidean distance on a folded surface pulls in
 * parcels across a sulcus — physically near, geodesically far; a geodesic kernel would be the textbook
 * answer, not worth its cost here, and a stride that fits makes the field smooth regardless.)
 */
const BLEND_R_IN_SPACINGS = 2.4;
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
  // ── THE DEFAULT-MODE SYSTEM. Five anchors, not three, and this is a CORRECTION rather than a tuning.
  //
  // The DMN is the LARGEST of the Yeo-7 networks — rostral medial prefrontal, posterior
  // cingulate/precuneus, the angular gyrus and lateral temporal cortex, roughly a quarter of the
  // surface. It had three anchors out of twenty (15%), which quietly made it the smallest thing on the
  // map. That is not a cosmetic error: coral means "you are losing them", it is the entire finding this
  // card exists to deliver, and with the map painted as a contrast the DMN's territory was too small
  // and too cool to light AT ALL. Measured on the real model, across a whole encounter where the
  // audience visibly walks out: 0.0% of the surface went coral. The card had lost the ability to say
  // the one thing it is for, and every unit test still passed, because they asserted against synthetic
  // vectors hotter than anything the model actually produces.
  ['default', 0.88, 0.02],   // rostral medial prefrontal
  ['default', -0.56, 0.04],  // angular gyrus
  ['default', -0.40, -0.36], // lateral temporal
  ['default', -0.70, 0.34],  // posterior cingulate / precuneus
  ['default', 0.62, -0.30],  // ventromedial prefrontal
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
  /**
   * Per-vertex: the single NEAREST parcel — what the hover readout names.
   *
   * It used to be read off `blendIdx[v * blendK]`, which only worked because the blend list was kept
   * sorted by distance — and keeping it sorted meant an O(K) insertion per candidate, which is half
   * of what made this function take 2.4 seconds. The list is now unordered (a weighted sum does not
   * care), so the nearest parcel is tracked here instead, for free.
   */
  nearest: Uint16Array;
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
 * ⚠️ THE SPATIAL GRID — and why the brute-force version had to die.
 *
 * The first cut of this file tested EVERY vertex against EVERY parcel: 64,397 × 400, each hit doing
 * an O(K) sorted insertion into a stride-43 list. ≈1.1 billion operations, and it blocked the main
 * thread for 2,605ms on first open (measured, not estimated). The previous session deleted a 500ms
 * mesh build and replaced it with something five times worse, because nobody probed it.
 *
 * The kernel is COMPACTLY SUPPORTED — a parcel at or beyond `blendR` contributes exactly zero weight
 * — so the only parcels that can matter to a vertex are the ones inside that ball. Bucket the parcels
 * into a uniform grid whose cell IS blendR and every one of them is guaranteed to sit in the vertex's
 * own cell or the 26 around it. ~1.4 parcels per cell here, so a vertex tests ~38 candidates instead
 * of 400, and the sorted insertion is gone entirely (see `nearest`).
 *
 * §5 warns that a spatial grid is exactly where the old map bugs lived. That warning is about
 * CORRECTNESS, and the answer is not to avoid the grid — it is to keep the gradient probes green
 * (`cortex-field.test.ts`), because a bucketing bug shows up as a mosaic, and the probes measure
 * mosaics.
 */
interface ParcelGrid {
  cell: number;
  nx: number; ny: number; nz: number;
  minX: number; minY: number; minZ: number;
  /** CSR: parcels of cell c are items[start[c] … start[c + 1]). */
  start: Int32Array;
  items: Uint16Array;
}

function buildParcelGrid(px: Float32Array, count: number, cell: number): ParcelGrid {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let k = 0; k < count; k++) {
    const v = k * 3;
    minX = Math.min(minX, px[v]!); maxX = Math.max(maxX, px[v]!);
    minY = Math.min(minY, px[v + 1]!); maxY = Math.max(maxY, px[v + 1]!);
    minZ = Math.min(minZ, px[v + 2]!); maxZ = Math.max(maxZ, px[v + 2]!);
  }
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const ny = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / cell) + 1);

  const cells = nx * ny * nz;
  const counts = new Int32Array(cells + 1);
  const cellOf = new Int32Array(count);
  for (let k = 0; k < count; k++) {
    const v = k * 3;
    const ix = Math.min(nx - 1, Math.max(0, Math.floor((px[v]! - minX) / cell)));
    const iy = Math.min(ny - 1, Math.max(0, Math.floor((px[v + 1]! - minY) / cell)));
    const iz = Math.min(nz - 1, Math.max(0, Math.floor((px[v + 2]! - minZ) / cell)));
    const c = (iz * ny + iy) * nx + ix;
    cellOf[k] = c;
    counts[c + 1]!++;
  }
  for (let c = 0; c < cells; c++) counts[c + 1]! += counts[c]!;
  const start = counts;
  const cursor = Int32Array.from(start);
  const items = new Uint16Array(count);
  for (let k = 0; k < count; k++) items[cursor[cellOf[k]!]!++] = k;

  return { cell, nx, ny, nz, minX, minY, minZ, start, items };
}

/**
 * THE TRAVERSAL, stated once in prose because it is written out TWICE below (in `worstCountAt` and in
 * the blend loop) rather than shared as a callback — measured, the closure form costs ~40% of the
 * innermost loop, and this loop is the whole reason the function was slow.
 *
 * Visit every parcel in the point's own cell and the 26 around it. That set is a SUPERSET of the ball
 * of radius `cell`, never a subset — so the caller must still check the true distance. (Skipping that
 * check is the classic grid bug: the corner of a cell is `cell·√3` from its centre, not `cell`.)
 *
 * If you fix a bug in one copy, fix it in the other.
 */

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

  const d2 = (a: number, b: number) => {
    const i = a * 3, j = b * 3;
    return (
      (positions[i]! - positions[j]!) ** 2 +
      (positions[i + 1]! - positions[j + 1]!) ** 2 +
      (positions[i + 2]! - positions[j + 2]!) ** 2
    );
  };

  /**
   * Farthest-point sampling picks each parcel centre as far as possible from the ones already
   * chosen — an even parcellation, deterministically. It is inherently O(parcels × candidates), so
   * the lever is the CANDIDATE SET, not the algorithm: it runs over every FPS_STRIDE'th vertex
   * (~16k of 64k) rather than all of them.
   *
   * That is not an approximation of any consequence. The thing being sampled is a 400-point layout
   * whose spacing comes out at ~13 vertices' worth of surface; thinning the candidates by 4 cannot
   * move a centroid by more than a fraction of that, and the gradient probes measure the field the
   * layout produces, not the layout. What it buys is real: 25.7M distance tests become 6.4M.
   */
  const FPS_STRIDE = 2;
  const candCount = Math.ceil(n / FPS_STRIDE);
  const seeds: number[] = [Math.floor(rng() * candCount) * FPS_STRIDE];
  const far = new Float32Array(candCount).fill(Infinity);

  for (let k = 1; k < PARCEL_COUNT; k++) {
    const s = seeds[k - 1]!;
    let bestI = 0;
    let bestD = -1;
    for (let c = 0; c < candCount; c++) {
      const j = c * FPS_STRIDE;
      const d = d2(j, s);
      if (d < far[c]!) far[c] = d;
      if (far[c]! > bestD) {
        bestD = far[c]!;
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
  // The parcel centroids, in their own contiguous buffer — the grid and every distance test below
  // work off this rather than double-indirecting through `seeds` into the vertex array.
  const pp = new Float32Array(parcelCount * 3);
  for (let k = 0; k < parcelCount; k++) {
    const v = seeds[k]! * 3;
    pp[k * 3] = positions[v]!;
    pp[k * 3 + 1] = positions[v + 1]!;
    pp[k * 3 + 2] = positions[v + 2]!;
  }
  /** Squared distance from vertex `i` to parcel `k`. */
  const vp2 = (i: number, k: number) => {
    const a = i * 3, b = k * 3;
    return (
      (positions[a]! - pp[b]!) ** 2 +
      (positions[a + 1]! - pp[b + 1]!) ** 2 +
      (positions[a + 2]! - pp[b + 2]!) ** 2
    );
  };

  let blendR = spacing * BLEND_R_IN_SPACINGS;
  // EXACT, over every vertex — not a sample. A sample (every 313rd vertex) measured 20 and the probe
  // still failed at maxStep 0.324: the true worst case lives on vertices the sample never visited, and
  // those few vertices truncate, and a handful of truncating vertices is all a visible seam needs.
  // Exactness is now CHEAP, because the grid means each vertex only tests its own neighbourhood.
  let grid = buildParcelGrid(pp, parcelCount, blendR);
  const worstCountAt = (r: number): number => {
    const rr = r * r;
    let worst = 0;
    for (let i = 0; i < n; i++) {
      let c = 0;
      // Inlined on purpose — see the note on `forEachNearParcel`. The callback form costs ~40% here.
      const g = grid;
      const x = positions[i * 3]!, y = positions[i * 3 + 1]!, z = positions[i * 3 + 2]!;
      const ix = Math.floor((x - g.minX) / g.cell);
      const iy = Math.floor((y - g.minY) / g.cell);
      const iz = Math.floor((z - g.minZ) / g.cell);
      for (let dz = -1; dz <= 1; dz++) {
        const cz = iz + dz;
        if (cz < 0 || cz >= g.nz) continue;
        for (let dy = -1; dy <= 1; dy++) {
          const cy2 = iy + dy;
          if (cy2 < 0 || cy2 >= g.ny) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const cx2 = ix + dx;
            if (cx2 < 0 || cx2 >= g.nx) continue;
            const cell = (cz * g.ny + cy2) * g.nx + cx2;
            const end = g.start[cell + 1]!;
            for (let s = g.start[cell]!; s < end; s++) if (vp2(i, g.items[s]!) < rr) c++;
          }
        }
      }
      if (c > worst) worst = c;
    }
    return worst;
  };

  let parcelsInKernel = worstCountAt(blendR);
  // Only if even the cap cannot hold this geometry do we narrow the radius — and then we say so,
  // because a narrowed radius is the beginning of the mosaic.
  while (parcelsInKernel + K_HEADROOM > BLEND_K_MAX && blendR > spacing) {
    blendR *= 0.9;
    // The grid's cell IS the radius — narrow one and the other must follow, or the 3×3×3 neighbourhood
    // stops being a superset of the ball and parcels start going missing on one side of a vertex.
    // That is the §5 bug, and it draws a mosaic rather than throwing.
    grid = buildParcelGrid(pp, parcelCount, blendR);
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
    // ⚠️ NORMALISE the centroid before it reaches `parcelTexture`, and feed it the axes we actually
    // LOOK at.
    //
    // Two traps here. (1) Its spatial noise was tuned for a ~±100 coordinate range; the shipped mesh
    // is quantized ints in the ±30,000s, and fed raw the noise is effectively constant across the
    // whole surface — every parcel gets the same bias, which is a flat, obviously-fake map. (2) The
    // noise takes two coordinates, and they must be the two that vary across the VISIBLE lateral
    // face: anterior-posterior (z) and superior-inferior (y). Feeding it left-right (x) makes the
    // bias near-constant along the very axis the camera is looking down, so no clusters can form.
    parcelCx[k] = ((pz - cz) / hz) * 100;   // anterior ⇄ posterior
    parcelCy[k] = ((py - cy) / hy) * 100;   // superior ⇄ inferior
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
  const nearest = new Uint16Array(n);
  const rr = blendR * blendR;

  const g = grid;
  for (let i = 0; i < n; i++) {
    const base = i * blendK;
    let q = 0;
    let sum = 0;
    let bestD = Infinity;
    let bestK = 0;

    // Only the parcels INSIDE the ball can carry weight — the kernel is exactly zero at blendR — and
    // the stride is sized (above) so that every one of them fits. So there is nothing to sort and
    // nothing to evict: take them in whatever order the grid hands them over.
    //
    // Inlined rather than calling `forEachNearParcel`: this is the innermost loop of the whole build
    // and the closure call costs ~40% of it. The traversal is identical — if you fix a bug in one,
    // fix it in the other.
    const x = positions[i * 3]!, y = positions[i * 3 + 1]!, z = positions[i * 3 + 2]!;
    const ix = Math.floor((x - g.minX) / g.cell);
    const iy = Math.floor((y - g.minY) / g.cell);
    const iz = Math.floor((z - g.minZ) / g.cell);
    for (let dz = -1; dz <= 1; dz++) {
      const cz = iz + dz;
      if (cz < 0 || cz >= g.nz) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const cyy = iy + dy;
        if (cyy < 0 || cyy >= g.ny) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const cxx = ix + dx;
          if (cxx < 0 || cxx >= g.nx) continue;
          const cell = (cz * g.ny + cyy) * g.nx + cxx;
          const end = g.start[cell + 1]!;
          for (let s = g.start[cell]!; s < end; s++) {
            const k = g.items[s]!;
            const d = vp2(i, k);
            if (d < bestD) { bestD = d; bestK = k; }
            if (d >= rr || q >= blendK) continue;
            const u = Math.sqrt(d) / blendR;
            const w = (1 - u) * (1 - u);
            blendIdx[base + q] = k;
            blendW[base + q] = w;
            sum += w;
            q++;
          }
        }
      }
    }

    if (sum <= 1e-9) {
      // Nothing inside the radius at all. The 3×3×3 neighbourhood cannot see far enough to say which
      // parcel is truly nearest, so fall back to an exhaustive scan for this one vertex — it happens
      // for a handful of stragglers at most, and a wrong answer here is a hard-edged speck.
      let bd = Infinity;
      for (let k = 0; k < parcelCount; k++) {
        const d = vp2(i, k);
        if (d < bd) { bd = d; bestK = k; }
      }
      blendIdx[base] = bestK;
      blendW[base] = 1;
      nearest[i] = bestK;
      continue;
    }

    for (let s = 0; s < q; s++) blendW[base + s] = blendW[base + s]! / sum;
    nearest[i] = bestK;
  }

  return {
    parcelNet, parcelCx, parcelCy, blendIdx, blendW, nearest,
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
 *
 * ⚠️ It is painted as a CONTRAST AGAINST REST, not as raw BOLD (`contrastBold`). Raw BOLD lit 57% of
 * the cortex, because six of our seven networks are task-positive and "engaged" therefore meant
 * "nearly everything is on". A real statistical map is a difference, and it is mostly grey.
 */
export function surfaceValues(
  field: CortexField,
  textures: ParcelTexture[],
  bold: Record<NetworkId, number>,
  t: number,
): Float32Array {
  const response = contrastBold(bold);
  const parcels = new Float32Array(field.parcelCount);
  for (let k = 0; k < field.parcelCount; k++) {
    const net = field.parcelNet[k]!;
    // ⚠️ NO POLARITY FLIP. It used to multiply by NETWORK_POLARITY so the default-mode system painted
    // on the cold side — a device that was only needed because `contrastBold` was UNSIGNED and could
    // not produce a cold value on its own. It is signed now, so flipping the DMN's sign would invert
    // it twice: a suppressed DMN (contrast < 0) would come out POSITIVE and paint an engaged brain's
    // mind-wandering regions WARM. What we paint is the canonical figure — the signed contrast itself,
    // task minus rest — where warm is "above this system's own resting level" and cold is "below it".
    // That is what the reference's colours mean, and it is what our colorbar now says they mean.
    parcels[k] = parcelValue(response[net], textures[k]!, t);
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
