/**
 * cortex-field — THE GRADIENT PROBE, run against the real shipped mesh.
 *
 * Handoff §5 is explicit: parcel spacing changes with geometry, a wrong blend bandwidth does NOT
 * throw, and that is what silently broke the map last time. It fails as a hard-edged mosaic (radius
 * too small) or as a uniform smear (radius too large) — and both look plausible in a thumbnail. So
 * the bandwidth is derived from measured spacing, and these tests assert the numbers rather than
 * anyone eyeballing a render.
 *
 * They load the ACTUAL asset the app ships (public/brain/cortex.glb). If the mesh is ever re-exported
 * with different geometry, these are the tests that catch it.
 */

import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resolve } from 'node:path';
import {
  AXES,
  BLEND_K_MAX,
  buildField,
  fieldDiagnostics,
  NETWORK_POLARITY,
  parcelTextures,
  surfaceValues,
} from '../cortex-field';
import { ACTIVATION_THRESHOLD, NETWORK_IDS, type NetworkId } from '../cortex-sim';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(resolve(process.cwd(), 'public/brain/cortex.glb'));
const prim = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;

const positions = Float32Array.from(prim.getAttribute('POSITION')!.getArray()!);
const indices = Array.from(prim.getIndices()!.getArray()!);
const curv = prim.getAttribute('_CURV')!;

const field = buildField(positions);

const ENGAGED: Record<NetworkId, number> = {
  visual: 0.86, somatomotor: 0.42, dorsal_attention: 0.79, salience: 0.74,
  limbic: 0.33, control: 0.58, default: 0.21,
};
const DRIFTING: Record<NetworkId, number> = {
  visual: 0.38, somatomotor: 0.22, dorsal_attention: 0.24, salience: 0.31,
  limbic: 0.47, control: 0.29, default: 0.83,
};

const values = (bold: Record<NetworkId, number>) =>
  surfaceValues(field, parcelTextures(field, 1234), bold, 6.4);

describe('the shipped mesh', () => {
  it('is a real cortical surface, under the 16-bit index ceiling', () => {
    expect(field.vertexCount).toBeGreaterThan(50_000);
    expect(field.vertexCount).toBeLessThanOrEqual(65_535); // else indices double in size
    expect(indices.length / 3).toBeGreaterThan(80_000);
  });

  it('carries BAKED curvature — the shader has no sulcal signal without it', () => {
    const a = curv.getArray()!;
    const div = a instanceof Int8Array ? 127 : 1;
    let sulcal = 0;
    let gyral = 0;
    for (let i = 0; i < a.length; i++) {
      const v = a[i]! / div;
      if (v < -0.15) sulcal++;
      if (v > 0.15) gyral++;
    }
    // A folded cortex is roughly half crown, half crease. A smooth blob would read 0/0 — which is
    // precisely how we would discover someone had swapped in a lower-quality mesh.
    expect(sulcal / a.length).toBeGreaterThan(0.1);
    expect(gyral / a.length).toBeGreaterThan(0.1);
  });

  it('has the axes the field assumes — ANTERIOR = −Z (the vermis test)', () => {
    // If Z is mirrored the whole map lights the wrong lobes — visual cortex on the forehead — and
    // NOTHING on screen looks like an error. Only an assertion catches that.
    //
    // ⚠️ Two obvious discriminators were tried and are WRONG, so do not "simplify" this back to them:
    //   • "the inferior mass leans posterior" — it does not. The bottom of a brain is dominated by
    //     the TEMPORAL LOBES and brainstem, which lean ANTERIOR. This test asserted the opposite and
    //     confidently failed a correctly-built mesh.
    //   • "the posterior end hangs lower" — a tie (−48.6 vs −48.5). A coin flip.
    //
    // What actually separates the ends 2:1 is the CEREBELLAR VERMIS: a big midline structure sitting
    // under the occipital lobe, with nothing remotely like it under the frontal pole. So weigh a thin
    // sagittal slab at each end — the heavy end is the back of the head.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      x0 = Math.min(x0, positions[i]!); x1 = Math.max(x1, positions[i]!);
      z0 = Math.min(z0, positions[i + 2]!); z1 = Math.max(z1, positions[i + 2]!);
    }
    const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
    const xh = (x1 - x0) / 2, zh = (z1 - z0) / 2;

    let vermisPos = 0, vermisNeg = 0;
    for (let i = 0; i < positions.length; i += 3) {
      if (Math.abs(positions[i]! - xc) >= xh * 0.1) continue;   // sagittal slab only
      if (positions[i + 2]! - zc > zh * 0.55) vermisPos++;
      if (positions[i + 2]! - zc < -zh * 0.55) vermisNeg++;
    }
    // The vermis end is POSTERIOR, and posterior is the opposite of anterior.
    expect(vermisPos).toBeGreaterThan(vermisNeg * 1.3);
    expect(AXES.anterior).toBe(-1);
  });

  it('is LEVELLED — the source MRI was in native scanner space, tilted', () => {
    // The raw download is nose-down in the scanner. That is not just a camera nuisance: the network
    // anchors are placed in normalised anatomical coordinates, so a tilt SHEARS the frame and every
    // parcel lands somewhere slightly wrong. build-cortex-mesh.mjs levels it with PCA.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      x0 = Math.min(x0, positions[i]!); x1 = Math.max(x1, positions[i]!);
      y0 = Math.min(y0, positions[i + 1]!); y1 = Math.max(y1, positions[i + 1]!);
      z0 = Math.min(z0, positions[i + 2]!); z1 = Math.max(z1, positions[i + 2]!);
    }
    // A brain is longest front-to-back. If Z is not the long axis, the levelling picked wrong axes.
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    expect(d).toBeGreaterThan(w);
    expect(d).toBeGreaterThan(h);
  });
});

describe('the parcellation', () => {
  it('derives its bandwidth from MEASURED spacing, not a constant (the §5 landmine)', () => {
    // Spacing is in mm on this mesh (bbox ≈ 134 × 142 × 182mm). The old mesh's unit-scale constant
    // of 0.26 would be ~2 orders of magnitude too small here and would rebuild the mosaic instantly.
    expect(field.spacing).toBeGreaterThan(1);
    expect(field.blendR).toBeGreaterThan(field.spacing);   // must span more than the nearest parcel
    expect(field.blendR).toBeLessThan(field.spacing * 3);  // and must not average the brain flat
  });

  it('SIZES THE STRIDE to the kernel — the truncation that made the mosaic', () => {
    // The old stride was a hardcoded 24. On this surface a wide (smooth) bandwidth puts more parcels
    // than that inside the ball, so the K-nearest cut dropped contributors and the field jumped at
    // the seam (measured maxStep 0.279). Narrowing the radius to fit 24 was worse (0.555 — the
    // nearest parcel then dominates). So the stride is sized to the measured crowding, with headroom.
    expect(field.parcelsInKernel).toBeGreaterThan(3);        // fewer → nearest-parcel wins → mosaic
    expect(field.blendK).toBeGreaterThan(field.parcelsInKernel); // MUST exceed it, or it truncates
    expect(field.blendK).toBeLessThanOrEqual(BLEND_K_MAX);

    const d = fieldDiagnostics(field, positions, indices, values(ENGAGED));
    expect(d.parcelsInRadius).toBeGreaterThan(3);
    expect(d.parcelsInRadius).toBeLessThan(field.blendK);    // strictly under → nothing is cut
  });

  it('covers every network — an unassigned network is a dead region of cortex', () => {
    const seen = new Set(field.parcelNet);
    for (const id of NETWORK_IDS) expect(seen.has(id)).toBe(true);
  });

  it('anchors BILATERALLY — this mesh has two hemispheres and both must light', () => {
    const left = new Set<NetworkId>();
    const right = new Set<NetworkId>();
    for (let k = 0; k < field.parcelCount; k++) {
      (field.parcelCx[k]! < 0 ? left : right).add(field.parcelNet[k]!);
    }
    // The old mesh showed one hemisphere, so one-sided anchors went unnoticed. Here they would
    // leave half the specimen dead the moment it turns.
    expect(left.size).toBeGreaterThanOrEqual(6);
    expect(right.size).toBeGreaterThanOrEqual(6);
  });
});

describe('THE GRADIENT PROBE — the field is smooth, and not a smear', () => {
  it('crosses parcel borders as a gradient (no mosaic)', () => {
    const d = fieldDiagnostics(field, positions, indices, values(ENGAGED));
    // ⚠️ Assert the SLOPE, not the step. Decimation leaves long triangles, so a raw per-edge |Δv|
    // conflates "the field jumped" with "that edge was long" — the first cut of this test failed a
    // perfectly smooth field for exactly that reason. What a mosaic actually does is change a lot
    // across almost no distance.
    //
    // The field is allowed to swing its whole range over a parcel spacing (that IS the signal); it
    // must not swing more, and a hard border would blow far past this.
    expect(d.maxSlopePerSpacing).toBeLessThan(1.0);
    expect(d.meanStep).toBeLessThan(0.02);
  });

  it('still has RANGE — smoothness must not be bought by averaging the brain flat', () => {
    const d = fieldDiagnostics(field, positions, indices, values(ENGAGED));
    // The failure mode on the other side: a radius so wide every vertex averages everything, the
    // map goes uniform, and it is still perfectly "smooth". Range is what tells them apart.
    expect(d.range).toBeGreaterThan(0.3);
  });
});

describe('the four invariants (§8.5) — pinned', () => {
  it('is DIVERGING: task-positive goes sage (+), the default-mode system goes coral (−)', () => {
    const v = values(DRIFTING);
    let neg = 0;
    for (let i = 0; i < v.length; i++) if (v[i]! < -ACTIVATION_THRESHOLD) neg++;
    // When the room drifts, the default network must drive real cortex NEGATIVE — that is the only
    // thing that keeps the LOCKED accent-dosage rule legal (coral = "you are losing them").
    expect(neg).toBeGreaterThan(100);
    expect(NETWORK_POLARITY.default).toBe(-1);
    for (const id of NETWORK_IDS) if (id !== 'default') expect(NETWORK_POLARITY[id]).toBe(1);
  });

  it('is THRESHOLDED: most of the cortex stays at rest', () => {
    const v = values(ENGAGED);
    let lit = 0;
    for (let i = 0; i < v.length; i++) if (Math.abs(v[i]!) > ACTIVATION_THRESHOLD) lit++;
    const frac = lit / v.length;
    // Painting every vertex is what makes a generated map look like stained glass. A real
    // thresholded map lights a minority of the surface.
    expect(frac).toBeGreaterThan(0.02);
    expect(frac).toBeLessThan(0.6);
  });
});
