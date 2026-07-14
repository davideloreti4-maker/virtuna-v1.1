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
import { weld, join, simplify, prune, dedup, quantize } from '@gltf-transform/functions';
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
  weld({ tolerance: 0.0001 }),
  join(),
);
console.log(`welded+joined : ${countVerts().toLocaleString()} verts / ${countTris().toLocaleString()} tris`);

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

console.log(`\nwrote         : ${OUT}`);
console.log(`size          : ${(glb.byteLength / 1e6).toFixed(2)} MB  ${glb.byteLength <= 3e6 ? '✓ under the 3MB budget' : '✗ OVER BUDGET'}`);
console.log(`final         : ${countVerts().toLocaleString()} verts / ${countTris().toLocaleString()} tris` +
  `  ${countVerts() <= MAX_VERTS ? '✓ 16-bit indices' : '✗ still needs 32-bit indices'}`);
