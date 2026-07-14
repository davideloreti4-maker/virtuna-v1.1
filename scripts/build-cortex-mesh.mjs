/**
 * build-cortex-mesh — turns the raw anatomical download into the asset the app ships.
 *
 * SOURCE (not committed — 12.5MB, and it is not ours to redistribute unprocessed):
 *   "Brain" by dgallichan — https://sketchfab.com/3d-models/brain-cadd2bde67404c43b2359a6a3281d84a
 *   CC-BY-4.0 (credit required, commercial use allowed). Generated with FreeSurfer from a
 *   T1-weighted MRI scan — i.e. a REAL cortical surface, the same class of object TRIBE renders.
 *   Download → glTF → unzip → pass the scene.gltf path as argv[2].
 *
 * WHY THIS SCRIPT EXISTS (three things the raw file cannot give us):
 *
 *  1. SIZE. 215,601 verts / 377,701 tris / 12.5MB is not shippable. We weld, simplify to ≤65,535
 *     verts (the 16-bit index ceiling — under it, indices halve in size) and quantize. Target ≤3MB.
 *
 *  2. CURVATURE. The shader's `aCurv` drives ALL sulcal shading — gyral crowns light, sulcal
 *     depths dark. A real mesh does not ship curvature, and this one's COLOR_0 is all zeros
 *     (verified: min=max=mean=0). So we COMPUTE mean curvature here and BAKE it into the asset.
 *     Doing it at load instead would re-introduce exactly the ~500ms main-thread stall that the
 *     procedural build cost us and that this whole swap exists to delete.
 *
 *  3. ORIENTATION. FreeSurfer RAS ≠ our camera. We centre the mesh on its own bbox so the
 *     canvas never has to know about the source's coordinate frame.
 *
 * Run:  node scripts/build-cortex-mesh.mjs <path-to-scene.gltf>
 * Out:  public/brain/cortex.glb  (+ public/brain/LICENSE.txt — the CC-BY credit ships WITH it)
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMeshQuantization } from '@gltf-transform/extensions';
import { weld, join, simplify, prune, dedup, quantize, flatten, clearNodeTransform } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node scripts/build-cortex-mesh.mjs <path-to-scene.gltf>');
  process.exit(1);
}
const OUT = resolve('public/brain/cortex.glb');

/** The 16-bit index ceiling. Landing under it halves every index in the file. */
const MAX_VERTS = 65_535;

await MeshoptSimplifier.ready;
// The source declares KHR_materials_pbrSpecularGlossiness (a legacy Sketchfab export). We throw its
// materials away regardless — the shader owns the look — but the reader still has to parse them.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);

const countVerts = () =>
  doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + p.getAttribute('POSITION').getCount(), 0);
const countTris = () =>
  doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);

console.log(`source        : ${countVerts().toLocaleString()} verts / ${countTris().toLocaleString()} tris`);

// The download is ONE surface exploded into 4 chunks of ≤65,532 verts (a GLES 16-bit-index
// workaround — the node is literally named "final.stl.cleaner.materialmerger.gles"). Weld the
// seams back together and join the chunks, or the simplifier decimates each piece in isolation
// and leaves cracks along the boundaries between them.
await doc.transform(
  dedup(),
  flatten(),
  weld({ tolerance: 0.0001 }),
  join(),
);

// ⚠️ BAKE OUT THE NODE TRANSFORM, or the levelling below is a lie.
//
// Sketchfab's export carries a root rotation node (the RAS → glTF Y-up conversion). Rotating the
// VERTEX data without clearing that node means three re-applies the rotation at load: measured, the
// file said the bbox was 140 x 133 x 188 while three saw 140 x 188 x 133 — Y and Z silently swapped.
// Every axis the app relies on would have been wrong, and the render would have looked merely...
// off. So: put the vertices in world space and leave the node at identity.
for (const node of doc.getRoot().listNodes()) clearNodeTransform(node);
console.log(`welded+joined : ${countVerts().toLocaleString()} verts / ${countTris().toLocaleString()} tris (node transforms baked out)`);

// Simplify to land under the 16-bit ceiling. `error` is in mesh units (mm here) — 0.35mm is well
// under the width of a sulcus, so the folding survives; that folding is the entire point of the mesh.
// simplify()'s ratio is on TRIANGLE count. Measured on this mesh: verts ≈ 0.69 × tris, so aiming
// at the vertex ceiling directly overshoots (it produced 72,744 verts — just over). Solve for tris.
const VERTS_PER_TRI = 0.69;
const targetTris = (MAX_VERTS / VERTS_PER_TRI) * 0.97;   // 3% headroom under the ceiling
const ratio = Math.min(1, targetTris / countTris());
await doc.transform(
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0035, lockBorder: true }),
  prune(),
);
console.log(`simplified    : ${countVerts().toLocaleString()} verts / ${countTris().toLocaleString()} tris`);

// ── MEAN CURVATURE, computed here and baked in ────────────────────────────────────────────────
//
// For each vertex: the mean of the normal component of the edges leaving it, i.e.
//     H(v) ≈ mean over neighbours j of  n(v) · (p(j) − p(v)) / |p(j) − p(v)|
// Neighbours sitting BELOW the tangent plane (a pit — a sulcus) push this negative; neighbours
// above it (a ridge — a gyral crown) push it positive. That sign is exactly what the shader wants,
// and unlike a cotangent Laplacian it does not blow up on the sliver triangles a decimator leaves.
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const nrm = prim.getAttribute('NORMAL');
    const idx = prim.getIndices();
    const n = pos.getCount();

    const sum = new Float64Array(n);
    const deg = new Uint32Array(n);
    const pi = [0, 0, 0], pj = [0, 0, 0], ni = [0, 0, 0];

    const accumulate = (a, b) => {
      pos.getElement(a, pi); pos.getElement(b, pj); nrm.getElement(a, ni);
      const ex = pj[0] - pi[0], ey = pj[1] - pi[1], ez = pj[2] - pi[2];
      const len = Math.hypot(ex, ey, ez);
      if (len < 1e-9) return;
      sum[a] += (ni[0] * ex + ni[1] * ey + ni[2] * ez) / len;
      deg[a] += 1;
    };

    const ix = idx.getArray();
    for (let t = 0; t < ix.length; t += 3) {
      const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]];
      accumulate(a, b); accumulate(a, c);
      accumulate(b, a); accumulate(b, c);
      accumulate(c, a); accumulate(c, b);
    }

    let curv = new Float32Array(n);
    for (let i = 0; i < n; i++) curv[i] = deg[i] ? sum[i] / deg[i] : 0;

    // Two Laplacian smoothing passes. Raw per-vertex curvature is speckled by decimation noise;
    // FreeSurfer smooths its curv map for the same reason. Without this the cortex reads as
    // sandpaper — which is precisely the "bark texture" failure the procedural mesh died of.
    const adj = Array.from({ length: n }, () => []);
    for (let t = 0; t < ix.length; t += 3) {
      const [a, b, c] = [ix[t], ix[t + 1], ix[t + 2]];
      adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
    }
    for (let pass = 0; pass < 2; pass++) {
      const next = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = curv[i], k = 1;
        for (const j of adj[i]) { s += curv[j]; k++; }
        next[i] = s / k;
      }
      curv = next;
    }

    // Normalise to [-1, 1] on a ROBUST range (2nd/98th percentile), not min/max — a handful of
    // decimation spikes would otherwise squash the whole cortex into the middle of the scale and
    // flatten every sulcus. (This is the same trap §10.3 caught in the trace: never min-max a
    // series whose extremes are noise.)
    const sorted = Float32Array.from(curv).sort();
    const lo = sorted[Math.floor(n * 0.02)], hi = sorted[Math.floor(n * 0.98)];
    const span = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, curv[i] / span));

    const acc = doc.createAccessor('curvature')
      .setType('SCALAR')
      .setArray(out)
      .setBuffer(doc.getRoot().listBuffers()[0]);
    prim.setAttribute('_CURV', acc);

    const neg = out.filter((v) => v < -0.15).length;
    const pos_ = out.filter((v) => v > 0.15).length;
    console.log(
      `curvature     : baked _CURV over ${n.toLocaleString()} verts · ` +
      `${Math.round((100 * neg) / n)}% sulcal / ${Math.round((100 * pos_) / n)}% gyral ` +
      `(a real cortex is roughly half and half — if this reads 0%/0% the mesh is a smooth blob)`,
    );
  }
}

// ── LEVEL THE BRAIN ───────────────────────────────────────────────────────────────────────────
//
// This is an MRI in NATIVE SCANNER SPACE: the subject's head was tilted in the scanner, and the mesh
// inherits that tilt. Measured on the raw asset, the two ends of the A-P axis reach wildly different
// heights (one tops out at 48% of the brain's height, the other at 90%) — the whole specimen is
// nose-down.
//
// That is not just a camera nuisance. The network anchors are placed in NORMALISED anatomical
// coordinates ("superior 0.6, anterior 0.02" = roughly the central sulcus), and a tilt shears that
// coordinate frame — so every parcel lands somewhere slightly wrong, and "visual cortex at the
// occipital pole" quietly stops being true. Levelling here means the app can trust its own axes.
//
// PCA gives the frame for free: a brain is longest front-to-back (A-P ≈ 182mm), then top-to-bottom
// (S-I ≈ 142mm), then side-to-side (L-R ≈ 134mm), so the principal axes come out in exactly that
// order. Only the SIGNS need anatomy, and each one has an unambiguous physical tell:
//
//   • UP is the side the BRAINSTEM does not point at. The stem is a narrow stalk descending from the
//     base; the vertex is a broad dome. So the end whose extreme vertices are tightly clustered in
//     cross-section is INFERIOR.
//   • POSTERIOR is the side the CEREBELLUM hangs under. Once level, the posterior-inferior region
//     dips below the anterior-inferior one, because the cerebellum sits below the occipital lobe and
//     nothing comparable sits below the frontal pole.
//   • LEFT/RIGHT cannot be read off a near-symmetric brain, so we simply refuse to mirror it: the
//     rotation is forced to a positive determinant, which preserves the scan's original handedness.
//     (A mirrored brain is anatomically a different person's, and nothing in the render would say so.)
{
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const pos = prim.getAttribute('POSITION');
  const nrm = prim.getAttribute('NORMAL');
  const n = pos.getCount();
  const p = [0, 0, 0];

  const mean = [0, 0, 0];
  for (let i = 0; i < n; i++) { pos.getElement(i, p); for (let k = 0; k < 3; k++) mean[k] += p[k] / n; }

  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, p);
    const d = [p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += (d[a] * d[b]) / n;
  }

  // Jacobi eigen-decomposition of a symmetric 3x3.
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const A = C.map((r) => r.slice());
  for (let sweep = 0; sweep < 24; sweep++) {
    let p_ = 0, q_ = 1, off = Math.abs(A[0][1]);
    for (const [a, b] of [[0, 2], [1, 2]]) if (Math.abs(A[a][b]) > off) { off = Math.abs(A[a][b]); p_ = a; q_ = b; }
    if (off < 1e-10) break;
    const theta = (A[q_][q_] - A[p_][p_]) / (2 * A[p_][q_]);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    const R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    R[p_][p_] = c; R[q_][q_] = c; R[p_][q_] = s; R[q_][p_] = -s;
    const An = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++)
      for (let k = 0; k < 3; k++) for (let l = 0; l < 3; l++) An[a][b] += R[k][a] * A[k][l] * R[l][b];
    const Vn = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++)
      for (let k = 0; k < 3; k++) Vn[a][b] += V[a][k] * R[k][b];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { A[a][b] = An[a][b]; V[a][b] = Vn[a][b]; }
  }

  const order = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);
  const evec = (j) => [V[0][order[j]], V[1][order[j]], V[2][order[j]]];

  const project = (i, ax) => {
    pos.getElement(i, p);
    return (p[0] - mean[0]) * ax[0] + (p[1] - mean[1]) * ax[1] + (p[2] - mean[2]) * ax[2];
  };

  // PC1 is unambiguously A-P: a brain is ~188mm front-to-back against ~140 and ~133 the other ways.
  const axZ = evec(0);

  // ⚠️ PC2 vs PC3 CANNOT be told apart by variance. L-R (140mm) and S-I (133mm) are nearly equal, so
  // the ordering is essentially a coin flip — and the bounding box does NOT catch the mistake, because
  // a swapped pair produces an equally plausible bbox. (It shipped: the render came back showing the
  // TOP of the brain from what the code called a lateral camera.)
  //
  // The discriminator is MIRROR SYMMETRY, measured — not skewness. (Skew was tried first and is
  // useless here: it came back −0.047 vs 0.018, both indistinguishable from zero, because the
  // brainstem is far too small a fraction of the surface to lopside the distribution.)
  //
  // What IS unmistakable: reflecting a brain across its SAGITTAL plane maps it almost exactly onto
  // itself — that is what bilateral symmetry means. Reflecting it top-to-bottom does not. So voxelise
  // the surface and measure, for each candidate axis, what fraction of occupied cells survive being
  // mirrored across the plane normal to it. The winner is left-right; the loser is superior-inferior.
  const symmetryOf = (ax, other) => {
    const G = 28; // a coarse grid — we are measuring gross shape, not detail
    const key = (a, b, c) => `${a},${b},${c}`;
    const cells = new Set();
    const coords = [];
    let max = 0;
    for (let i = 0; i < n; i++) {
      const u = project(i, ax), v = project(i, other), w = project(i, axZ);
      coords.push([u, v, w]);
      max = Math.max(max, Math.abs(u), Math.abs(v), Math.abs(w));
    }
    const q = (x) => Math.round(((x / max) * 0.5 + 0.5) * (G - 1));
    for (const [u, v, w] of coords) cells.add(key(q(u), q(v), q(w)));
    let hit = 0;
    for (const [u, v, w] of coords) if (cells.has(key(q(-u), q(v), q(w)))) hit++;
    return hit / coords.length;
  };
  const symA = symmetryOf(evec(1), evec(2));
  const symB = symmetryOf(evec(2), evec(1));
  // High symmetry under reflection ⇒ that axis is the sagittal normal ⇒ LEFT-RIGHT.
  let axX = symA >= symB ? evec(1) : evec(2);
  const axY = symA >= symB ? evec(2) : evec(1);
  console.log(
    `levelled      : mirror symmetry PC2=${(symA * 100).toFixed(1)}% PC3=${(symB * 100).toFixed(1)}% → ` +
    `the SYMMETRIC axis is LEFT-RIGHT (a brain mirrors across the sagittal plane; it does not mirror top-to-bottom)`,
  );

  // UP: the CENTROID sits above the bounding box's centre.
  //
  // The cerebrum is a bulky dome; the brainstem is a thin stalk. Mass therefore piles up superiorly
  // while the surface still REACHES further inferiorly, down the stem. So measured from the centroid
  // (which is where `project` is zero), the extent to the inferior side is larger than to the
  // superior side. Whichever way the long thin tail points is DOWN.
  //
  // (The obvious test — compare the cross-sectional spread of the extreme vertices at each end,
  // stalk vs dome — was tried and is far too weak on this mesh: 14.9 vs 15.4, a coin flip. And a coin
  // flip here ships the brain upside down.)
  let reachUp = -Infinity, reachDown = Infinity;
  for (let i = 0; i < n; i++) {
    const y = project(i, axY);
    reachUp = Math.max(reachUp, y);
    reachDown = Math.min(reachDown, y);
  }
  if (Math.abs(reachDown) < reachUp) axY.forEach((_, k) => (axY[k] = -axY[k])); // tail was at +Y → flip
  console.log(
    `levelled      : from the centroid, the surface reaches ${Math.max(Math.abs(reachDown), reachUp).toFixed(1)}mm one way and ` +
    `${Math.min(Math.abs(reachDown), reachUp).toFixed(1)}mm the other → the long thin tail is the BRAINSTEM, and it points DOWN`,
  );

  // NOTE: the A-P sign is NOT guessed here. An earlier version predicted it from the centroid-relative
  // point cloud, and the prediction disagreed with the result measured on the rotated mesh (the two
  // used different origins). Both flips are now applied AFTER the rotation, on the data we actually
  // ship — measured, not modelled. See "correct the result" below.

  // Recompute X so the frame stays right-handed after any sign flips.
  axX = [
    axY[1] * axZ[2] - axY[2] * axZ[1],
    axY[2] * axZ[0] - axY[0] * axZ[2],
    axY[0] * axZ[1] - axY[1] * axZ[0],
  ];

  const rot = (v) => [
    v[0] * axX[0] + v[1] * axX[1] + v[2] * axX[2],
    v[0] * axY[0] + v[1] * axY[1] + v[2] * axY[2],
    v[0] * axZ[0] + v[1] * axZ[1] + v[2] * axZ[2],
  ];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, p);
    pos.setElement(i, rot([p[0] - mean[0], p[1] - mean[1], p[2] - mean[2]]));
    nrm.getElement(i, p);
    const r = rot(p);
    const len = Math.hypot(...r) || 1;
    nrm.setElement(i, [r[0] / len, r[1] / len, r[2] / len]);
  }

  // ── CORRECT THE RESULT, then verify it. ────────────────────────────────────────────────────
  //
  // Every sign above is an if-statement, and an if-statement that fires the wrong way mirrors the
  // brain with nothing on screen to say so. So rather than predict the signs from the unrotated
  // cloud (which was tried, and which disagreed with the rotated result), measure the ROTATED mesh
  // and flip it into place.
  //
  //   UP        the brainstem is a narrow stalk: the end with far less cross-section is DOWN.
  //   POSTERIOR the cerebellar VERMIS is a big midline mass under the occipital lobe, and nothing
  //             like it sits under the frontal pole. The heavy midline end is the BACK.
  //
  // A single-axis flip would mirror the brain (a left hemisphere would become a right one), so each
  // flip negates TWO axes — a 180° rotation, which preserves handedness.
  const measure = () => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) {
      pos.getElement(i, p);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
    }
    const xc = (x0 + x1) / 2, yc = (y0 + y1) / 2, zc = (z0 + z1) / 2;
    const xh = (x1 - x0) / 2, yh = (y1 - y0) / 2, zh = (z1 - z0) / 2;
    let vermisPos = 0, vermisNeg = 0, capUp = 0, capDown = 0;
    for (let i = 0; i < n; i++) {
      pos.getElement(i, p);
      if (Math.abs(p[0] - xc) < xh * 0.10) {
        if (p[2] - zc >  zh * 0.55) vermisPos++;
        if (p[2] - zc < -zh * 0.55) vermisNeg++;
      }
      if (p[1] - yc >  yh * 0.80) capUp++;
      if (p[1] - yc < -yh * 0.80) capDown++;
    }
    return { vermisPos, vermisNeg, capUp, capDown };
  };
  /** Negate two axes = a 180° rotation. Never one — that would mirror the brain into someone else's. */
  const spin = (a, b) => {
    for (let i = 0; i < n; i++) {
      pos.getElement(i, p); p[a] = -p[a]; p[b] = -p[b]; pos.setElement(i, [p[0], p[1], p[2]]);
      nrm.getElement(i, p); p[a] = -p[a]; p[b] = -p[b]; nrm.setElement(i, [p[0], p[1], p[2]]);
    }
  };

  let m = measure();
  // The brainstem end has a far smaller cross-section than the dome. If the SMALL cap is up, we are
  // upside down — spin about Z (negating X and Y).
  if (m.capUp < m.capDown) {
    spin(0, 1);
    m = measure();
    console.log('levelled      : the narrow brainstem cap was UP → spun 180° about Z');
  }
  if (m.vermisNeg > m.vermisPos) {
    spin(0, 2);
    m = measure();
    console.log('levelled      : the cerebellar vermis was at −Z → spun 180° about Y');
  }

  if (m.vermisNeg > m.vermisPos) {
    throw new Error(`vermis still at −Z (${m.vermisNeg} vs ${m.vermisPos}) — the A-P axis is mirrored`);
  }
  if (m.capUp < m.capDown) {
    throw new Error(`the narrow brainstem cap is still UP — the brain is upside down`);
  }
  console.log(`verified      : vermis at +Z (${m.vermisPos} vs ${m.vermisNeg}) → POSTERIOR = +Z, so ANTERIOR = −Z ✓`);
  console.log(`verified      : the broad dome is UP, the narrow brainstem is DOWN (cap ${m.capUp} vs ${m.capDown}) ✓`);
}

// Drop the source's COLOR_0. It is ALL ZEROS (verified) — dead weight, and a live trap: any future
// `vertexColors: true` on this geometry would render the cortex pure black.
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    if (prim.getAttribute('COLOR_0')) { prim.setAttribute('COLOR_0', null); console.log('stripped      : COLOR_0 (all zeros — dead weight and a black-render trap)'); }
  }
}

// Centre on the bbox so the canvas never needs to know about FreeSurfer's RAS frame.
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], p = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
    }
    const c = min.map((v, k) => (v + max[k]) / 2);
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p);
      pos.setElement(i, [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    }
    console.log(`centred       : bbox ${max.map((v, k) => (v - min[k]).toFixed(1)).join(' × ')} mm — orientation is VERIFIED BY RENDER, not assumed`);
  }
}

// Quantize: positions → int16, normals → int8. Halves the file; three's GLTFLoader reads
// KHR_mesh_quantization natively, so this costs no decoder and no runtime work.
doc.createExtension(KHRMeshQuantization).setRequired(true);
await doc.transform(quantize({ quantizePosition: 12, quantizeNormal: 10, quantizeGeneric: 8 }));

mkdirSync(dirname(OUT), { recursive: true });
const glb = await io.writeBinary(doc);
writeFileSync(OUT, glb);

writeFileSync(
  resolve('public/brain/LICENSE.txt'),
  `This work is based on "Brain" (https://sketchfab.com/3d-models/brain-cadd2bde67404c43b2359a6a3281d84a)
by dgallichan (https://sketchfab.com/dgallichan) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/).

Generated with FreeSurfer from a T1-weighted MRI scan.
Modified for Maven: welded, simplified, mean curvature baked into _CURV, recentred, quantized.
See scripts/build-cortex-mesh.mjs.
`,
);

// Prove the file means what it says: no residual rotation on the node, so the axes the app reads
// are the axes we just levelled. (quantize() adds its own scale/translate — that is expected, and
// three applies it correctly; a ROTATION is what would betray us.)
for (const node of doc.getRoot().listNodes()) {
  const r = node.getRotation();
  const spun = Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) > 1e-6;
  if (spun) throw new Error(`node "${node.getName()}" still carries a rotation ${JSON.stringify(r)} — three would re-apply it and the levelled axes would be wrong`);
}
console.log(`axes          : node rotations clear — the file's axes ARE the app's axes`);

console.log(`\nwrote         : ${OUT}`);
console.log(`size          : ${(glb.byteLength / 1e6).toFixed(2)} MB  ${glb.byteLength <= 3e6 ? '✓ under the 3MB budget' : '✗ OVER BUDGET'}`);
console.log(`final         : ${countVerts().toLocaleString()} verts / ${countTris().toLocaleString()} tris` +
  `  ${countVerts() <= MAX_VERTS ? '✓ 16-bit indices' : '✗ still needs 32-bit indices'}`);
