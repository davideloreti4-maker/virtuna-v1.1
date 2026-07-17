/**
 * build-inflated-mesh — adds the INFLATED surface to the shipped cortex as a morph target.
 *
 * ⛔ NOT WIRED UP. THIS DOES NOT RUN, AND THE APP DOES NOT READ ITS OUTPUT. KEEP IT ANYWAY.
 *
 * It works, in the sense that it produces the asset it says it produces — and the asset is no good,
 * for a reason that is a property of OUR MESH and not of this script:
 *
 *   `public/brain/cortex.glb` is a DECIMATED WHOLE BRAIN. Decimation leaves long slivers along the
 *   sulci, and smoothing drags a sliver's vertices past one another until the triangle turns INSIDE
 *   OUT. A back-facing triangle is culled, so the inflated brain renders as a rotted, perforated
 *   shell. Measured: 2.3% of triangles inverted after 20 Taubin steps, 5.2% by 220. The inversion
 *   guard below (revert any vertex whose triangle flipped) does not save it — the flips just move.
 *
 * AND NOTE HOW IT FAILED: every gate this script had PASSED. Roughness fell 80%, the bounding shape
 * held to 1.00 on every axis, the file was valid glTF, the morph target loaded, three rendered it. The
 * statistics of a shredded brain look exactly like the statistics of a good one. It took putting it on
 * screen, at real scale, to see that it was garbage — which is the same lesson this whole card has
 * taught five times now, in five different costumes.
 *
 * ── THE REAL FIX, for whoever picks this up:
 * DO NOT try to derive an inflated surface from the shipped mesh. FreeSurfer ALREADY EMITS ONE. The
 * surface this asset was reconstructed from ships with `lh.inflated` / `rh.inflated` next to
 * `lh.white` / `lh.pial` — a genuine metric-preserving inflation, per hemisphere, with the vertex
 * correspondence already exact. Source the subject's surfaces (not a Sketchfab export of one), run
 * both through `build-cortex-mesh.mjs` with a SHARED decimation so the vertex order matches, and the
 * `Normal | Inflated` toggle becomes trivial, correct, and free. That is a procurement problem, and on
 * this card procurement has beaten engineering every single time.
 *
 * TRIBE's viewer has a `Normal | Inflated` toggle and it is the best idea in their UI: the folded
 * surface hides two thirds of the cortex inside the sulci, and the inflated one shows all of it while
 * STILL reading as a brain — because the silhouette and the curvature are real. Ours could not have it
 * without a SECOND GEOMETRY, and the handoff is explicit that it must not be faked in a shader
 * (pushing vertices along their normals gives a bloated brain, not an inflated one).
 *
 * ── WHAT INFLATION ACTUALLY IS ───────────────────────────────────────────────────────────────────
 * FreeSurfer's `mris_inflate` smooths the surface until the folds come out, while holding the overall
 * form. That is a LOW-PASS FILTER on the geometry: kill the high spatial frequencies (gyri and sulci),
 * keep the low ones (the lobes, the poles, the silhouette). So that is what this does.
 *
 * It runs TAUBIN λ|μ smoothing, not plain Laplacian. Plain Laplacian smoothing shrinks — run it long
 * enough to open the sulci and the brain has collapsed toward its own centroid, and "rescale it back
 * up" is a lie that distorts the lobes unevenly. Taubin alternates a smoothing pass (λ > 0) with a
 * mild un-smoothing pass (μ < −λ), which passes the low frequencies through at ~unit gain. The result
 * keeps its size and its lobar shape without any rescaling fudge.
 *
 * The vertex ORDER and the index buffer are untouched — that is the whole point. A morph target is a
 * per-vertex delta, so vertex i of the inflated surface must be vertex i of the folded one, and the
 * baked `_CURV` attribute keeps describing the folds that USED to be there. That is exactly what makes
 * the inflated view still read as a brain rather than as an egg: you are looking at a smooth surface
 * painted with the real sulcal pattern.
 *
 * Run:  node scripts/build-inflated-mesh.mjs
 * In:   public/brain/cortex.glb   (the asset built by build-cortex-mesh.mjs)
 * Out:  public/brain/cortex.glb   (same file, now carrying morph target 0 = "inflated")
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dequantize, quantize } from '@gltf-transform/functions';
import { resolve } from 'node:path';

const PATH = resolve('public/brain/cortex.glb');

/**
 * Taubin's two constants. λ smooths; μ un-smooths slightly harder. The pass band is set by
 * kPB = 1/λ + 1/μ, which must be small and positive — these are the textbook values (λ=0.53,
 * μ=−0.55) and they hold the low frequencies at ~unit gain, which is why the brain does not shrink.
 */
const LAMBDA = 0.53;
const MU = -0.55;
/**
 * How far to inflate. Each Taubin step is one λ pass + one μ pass. This is the one number that is a
 * JUDGEMENT, so it is measured rather than guessed: the script prints the roughness that remains and
 * the shape it kept, and the assertions at the bottom fail the build if inflation either did not
 * happen (folds still there) or went too far (the brain became an egg).
 */
const STEPS = 220;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(PATH);

// Work in real (dequantized) space. The shipped asset is quantized ints with the dequantizer folded
// into the node's scale — smoothing those ints directly would work only if the scale were uniform on
// every axis, and betting on that is exactly the class of silent, plausible-looking bug that §13.2 is
// a list of. Dequantize, do the geometry in millimetres, re-quantize at the end.
await doc.transform(dequantize());

const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const posAcc = prim.getAttribute('POSITION');
const idx = prim.getIndices();
if (!posAcc || !idx) throw new Error('cortex.glb: expected an indexed primitive with POSITION');
if (prim.listTargets().length) throw new Error('cortex.glb already has morph targets — rebuild it from build-cortex-mesh.mjs first');

const n = posAcc.getCount();
const base = Float32Array.from(posAcc.getArray());
const indices = idx.getArray();

// ── Adjacency (CSR). Every edge of every triangle, deduplicated by construction of the two passes.
const degree = new Uint32Array(n);
for (let t = 0; t < indices.length; t += 3) {
  const a = indices[t], b = indices[t + 1], c = indices[t + 2];
  degree[a] += 2; degree[b] += 2; degree[c] += 2;
}
const start = new Uint32Array(n + 1);
for (let i = 0; i < n; i++) start[i + 1] = start[i] + degree[i];
const adj = new Uint32Array(start[n]);
const cursor = Uint32Array.from(start);
const link = (a, b) => { adj[cursor[a]++] = b; };
for (let t = 0; t < indices.length; t += 3) {
  const a = indices[t], b = indices[t + 1], c = indices[t + 2];
  link(a, b); link(a, c);
  link(b, a); link(b, c);
  link(c, a); link(c, b);
}
// Duplicates are fine and are in fact CORRECT: a neighbour shared by two triangles is counted twice,
// which weights the umbrella by the number of incident faces. What is NOT fine is a vertex with no
// neighbours — a weld failure — because it would then sit still while the surface moved around it.
for (let i = 0; i < n; i++) {
  if (start[i + 1] === start[i]) throw new Error(`vertex ${i} has no neighbours — the mesh is not welded`);
}

/** The roughness that inflation exists to remove: RMS distance from each vertex to its neighbours' mean. */
function roughness(p) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, sz = 0;
    const s = start[i], e = start[i + 1];
    for (let k = s; k < e; k++) {
      const j = adj[k] * 3;
      sx += p[j]; sy += p[j + 1]; sz += p[j + 2];
    }
    const d = e - s;
    const dx = sx / d - p[i * 3], dy = sy / d - p[i * 3 + 1], dz = sz / d - p[i * 3 + 2];
    sum += dx * dx + dy * dy + dz * dz;
  }
  return Math.sqrt(sum / n);
}

const bbox = (p) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[i * 3 + a]);
      hi[a] = Math.max(hi[a], p[i * 3 + a]);
    }
  }
  return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
};

// ── THE INFLATION. One Taubin step = a λ pass (smooth) then a μ pass (un-smooth).
let cur = Float32Array.from(base);
let next = new Float32Array(n * 3);

function pass(p, out, factor) {
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, sz = 0;
    const s = start[i], e = start[i + 1];
    for (let k = s; k < e; k++) {
      const j = adj[k] * 3;
      sx += p[j]; sy += p[j + 1]; sz += p[j + 2];
    }
    const d = e - s;
    const i3 = i * 3;
    out[i3] = p[i3] + factor * (sx / d - p[i3]);
    out[i3 + 1] = p[i3 + 1] + factor * (sy / d - p[i3 + 1]);
    out[i3 + 2] = p[i3 + 2] + factor * (sz / d - p[i3 + 2]);
  }
}

/** The (unnormalised, area-weighted) normal of triangle `t` in positions `p`. */
function faceNormal(p, t) {
  const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
  const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
  const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/**
 * ⚠️ THE INVERSION GUARD — without this, inflation SHREDS THE BRAIN.
 *
 * This mesh is decimated, so the sulci are full of long, thin triangles. Smoothing pulls a sliver's
 * vertices past one another, the triangle turns INSIDE OUT, and a back-facing triangle is culled —
 * so the inflated surface came out perforated with black holes, like a rotted shell. Measured: 2.3%
 * of triangles inverted after only 20 Taubin steps, 5.2% by 220.
 *
 * And note how it failed: not with an error, but with a picture. The asset built, the gates on
 * roughness and shape both PASSED (the shape statistics of a shredded brain are fine), and it took
 * looking at the render to catch it. So the guard below is now backed by an assertion, because the
 * next person will not be looking.
 *
 * The guard: after each pass, any triangle that flipped relative to the step before has its three
 * vertices RESTORED to where they were. Those vertices simply stop inflating; everything around them
 * carries on. Repeat a few times, since restoring one vertex can flip a neighbour.
 */
function guardedPass(p, out, factor) {
  pass(p, out, factor);
  for (let sweep = 0; sweep < 4; sweep++) {
    let reverted = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const a = faceNormal(out, t);
      const b = faceNormal(p, t);
      if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] >= 0) continue;
      for (let k = 0; k < 3; k++) {
        const v = indices[t + k] * 3;
        out[v] = p[v]; out[v + 1] = p[v + 1]; out[v + 2] = p[v + 2];
      }
      reverted++;
    }
    if (!reverted) break;
  }
}

const r0 = roughness(cur);
const b0 = bbox(cur);

for (let step = 0; step < STEPS; step++) {
  guardedPass(cur, next, LAMBDA);
  [cur, next] = [next, cur];
  guardedPass(cur, next, MU);
  [cur, next] = [next, cur];
}

// Did any triangle end up inside out relative to the ORIGINAL surface? If so the mesh will render
// with holes in it, and nothing else in this script would notice.
const basePositions = base;
let flipped = 0;
for (let t = 0; t < indices.length; t += 3) {
  const a = faceNormal(cur, t);
  const b = faceNormal(basePositions, t);
  if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0) flipped++;
}

const r1 = roughness(cur);
const b1 = bbox(cur);
const inflated = cur;

// ── Normals for the inflated surface. The folded normals cannot be reused: they point down into
//    creases that no longer exist, so the lit balloon would come out shaded like crumpled foil.
const normals = new Float32Array(n * 3);
for (let t = 0; t < indices.length; t += 3) {
  const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
  const ux = inflated[b] - inflated[a], uy = inflated[b + 1] - inflated[a + 1], uz = inflated[b + 2] - inflated[a + 2];
  const vx = inflated[c] - inflated[a], vy = inflated[c + 1] - inflated[a + 1], vz = inflated[c + 2] - inflated[a + 2];
  // Cross product, unnormalised — so a big triangle contributes more than a sliver, which is the
  // area weighting you want.
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const v of [a, b, c]) {
    normals[v] += nx; normals[v + 1] += ny; normals[v + 2] += nz;
  }
}
for (let i = 0; i < n; i++) {
  const i3 = i * 3;
  const len = Math.hypot(normals[i3], normals[i3 + 1], normals[i3 + 2]) || 1;
  normals[i3] /= len; normals[i3 + 1] /= len; normals[i3 + 2] /= len;
}

// ── The morph target: DELTAS, not positions. (glTF morph targets are displacements added to the base
//    attribute before the node transform.)
const baseNrm = Float32Array.from(prim.getAttribute('NORMAL').getArray());
const dPos = new Float32Array(n * 3);
const dNrm = new Float32Array(n * 3);
for (let i = 0; i < n * 3; i++) {
  dPos[i] = inflated[i] - base[i];
  dNrm[i] = normals[i] - baseNrm[i];
}

const buffer = doc.getRoot().listBuffers()[0];
const target = doc.createPrimitiveTarget('inflated')
  .setAttribute('POSITION', doc.createAccessor('inflatedPos').setType('VEC3').setArray(dPos).setBuffer(buffer))
  .setAttribute('NORMAL', doc.createAccessor('inflatedNrm').setType('VEC3').setArray(dNrm).setBuffer(buffer));
prim.addTarget(target);
// The mesh's default weight: 0 = the folded surface. The app drives this itself.
prim.getMesh?.();
doc.getRoot().listMeshes()[0].setWeights([0]);

const shape = b1.map((v, i) => v / b0[i]);
console.log(`vertices      : ${n.toLocaleString()} (order unchanged — a morph target requires it)`);
console.log(`roughness     : ${r0.toFixed(4)} → ${r1.toFixed(4)}  (${((1 - r1 / r0) * 100).toFixed(1)}% of the folding removed)`);
console.log(`shape kept    : ${shape.map((v) => v.toFixed(2)).join(' / ')}  (1.00 = unchanged; Taubin does not shrink)`);
console.log(`inside-out    : ${flipped} triangles  (unguarded, this was 4,758 — and they render as HOLES)`);

// ── THE GATES, BEFORE THE WRITE. Every one of these failure modes ships a believable-looking asset.
//    (And assert BEFORE writing: the first cut of this script wrote the file and THEN threw, which is
//     the worst of both worlds.)
if (flipped > 0) {
  throw new Error(`${flipped} triangles are inside out — the inflated brain will render full of holes. The guard failed.`);
}
if (r1 / r0 > 0.55) throw new Error(`inflation did nothing: ${((1 - r1 / r0) * 100).toFixed(0)}% of folding removed. Raise STEPS.`);
for (const s of shape) {
  if (s < 0.85 || s > 1.15) throw new Error(`the brain lost its shape (axis scaled ${s.toFixed(2)}) — Taubin should hold it near 1.00`);
}

// Put the quantization back — this is what keeps the asset small, and the app already knows how to
// read a quantized, interleaved buffer (it is the ONLY thing it knows how to read: see §13.2).
doc.createExtension(KHRMeshQuantization).setRequired(true);
await doc.transform(quantize());

await io.write(PATH, doc);

const { statSync } = await import('node:fs');
console.log(`out           : ${PATH}  (${(statSync(PATH).size / 1e6).toFixed(2)}MB)`);
