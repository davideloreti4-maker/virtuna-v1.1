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
import { valueToRamp } from '@/lib/brain/cortex-colormap';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resolve } from 'node:path';
import {
  AXES,
  BLEND_K_MAX,
  buildField,
  fieldDiagnostics,
  parcelTextures,
  surfaceValues,
} from '../cortex-field';
import {
  contrastBold,
  NETWORK_IDS,
  predictedBold,
  RESTING_BOLD,
  type DriveInput,
  type NetworkId,
} from '../cortex-sim';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(resolve(process.cwd(), 'public/brain/cortex.glb'));
const prim = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;

const positions = Float32Array.from(prim.getAttribute('POSITION')!.getArray()!);
const indices = Array.from(prim.getIndices()!.getArray()!);
const curv = prim.getAttribute('_CURV')!;

const field = buildField(positions);

/**
 * ⚠️ THE FIXTURES COME FROM THE MODEL. THEY USED TO BE MADE UP, AND THAT IS HOW THE MAP BROKE.
 *
 * These were hand-written vectors — `default: 0.83` for a drifting room, `dorsal_attention: 0.79` for
 * an engaged one — and they were HOTTER THAN ANYTHING `predictedBold` ACTUALLY PRODUCES. So when the
 * map was re-based onto a contrast against rest, every test here stayed green while the real card went
 * dark: measured on a genuine encounter where the audience walks out, the surface painted 0.0% coral.
 * The one thing the card exists to say — "you are losing them" — had been silently deleted, and the
 * suite was asserting against a brain that does not exist.
 *
 * A fixture that cannot occur is not a test. These are now sampled from the real drive model, at the
 * moments that matter: the peak of a strong hook, and the point in a collapsing video where the room
 * has gone.
 */
const boldAt = (drive: DriveInput, t: number) => predictedBold(drive, t);

/** A strong concept, at the peak of its response. */
const ENGAGED: Record<NetworkId, number> = boldAt(
  { mode: 'simulated', stopRatio: 0.9, durationS: 15, seedKey: 'h1' },
  1.5,
);
/** A real video whose retention collapses — five seconds later, the room is somewhere else. */
const DRIFTING: Record<NetworkId, number> = boldAt(
  {
    mode: 'grounded',
    stopRatio: 0.35,
    durationS: 20,
    seedKey: 'h1',
    retentionAt: (u: number) => Math.max(0.08, 1 - u * 0.9),
  },
  20,
);

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

    // ⚠️ RELATIVE TO THE FIELD'S OWN RANGE, not an absolute step. `meanStep` is in VALUE units, so it
    // scales with the amplitude of the map — and when the contrast became signed (2026-07-14) the
    // range roughly doubled (it gained its entire negative half), which pushed the mean step from
    // 0.019 to 0.023 and failed this line. Nothing had become less smooth: `maxSlopePerSpacing`, the
    // assertion that actually catches a mosaic, never moved. A smoothness test that trips on
    // amplitude is measuring the wrong quantity, and would have to be re-tuned by hand every time the
    // model's scale changed — which is how a guard rots into a nuisance and gets deleted.
    const range = Math.max(...values(ENGAGED)) - Math.min(...values(ENGAGED));
    expect(d.meanStep / range).toBeLessThan(0.03);
  });

  it('still has RANGE — smoothness must not be bought by averaging the brain flat', () => {
    const d = fieldDiagnostics(field, positions, indices, values(ENGAGED));
    // The failure mode on the other side: a radius so wide every vertex averages everything, the
    // map goes uniform, and it is still perfectly "smooth". Range is what tells them apart.
    expect(d.range).toBeGreaterThan(0.3);
  });
});

/**
 * THE MAP IS A CONTINUOUS DIVERGING SURFACE (rebuilt 2026-07-14) — pinned.
 *
 * It used to be THRESHOLDED: a cream anatomical base, with colour composited in only where |value|
 * cleared ACTIVATION_THRESHOLD. The theory was that painting every vertex "makes a generated map look
 * like stained glass instead of an fMRI", and the test here asserted the lit fraction stayed under
 * 30%.
 *
 * ⚠️ THAT TEST PASSED FOR SEVEN ROUNDS WHILE THE OWNER REJECTED THE CARD ON LOOK FOUR TIMES. It could
 * not fail: it constrained how much cortex was painted, and never once asked WHAT COLOUR THE SURFACE
 * ACTUALLY CAME OUT. Measured on the shipped render, the answer was a cream-white brain with a single
 * orange smudge — "color mesh doesnt look good at all and is only one color?" — and the suite was
 * green the whole time. The reference (thesapientcompany.com/intelligence) paints its entire cortex,
 * continuously, and reads as a scan.
 *
 * So these tests pin the DISTRIBUTION OF COLOUR, which is the thing a human is actually looking at.
 */
describe('the map is a continuous diverging surface — pinned', () => {
  it('USES THE RAMP — the map must never come back one colour', () => {
    const s = values(ENGAGED)
      .map((v) => valueToRamp(v))
      .sort((a, b) => a - b);
    const at = (p: number) => s[Math.floor((s.length - 1) * p)]!;

    // The middle 90% of the surface must cover a real span of the ramp. This is the assertion whose
    // absence let a one-colour specimen ship four times. Measured after the rebuild: ~0.70.
    expect(at(0.95) - at(0.05)).toBeGreaterThan(0.35);

    // ...and no single tenth of the ramp may swallow the specimen. The other way to be "one colour"
    // is to span the ramp on paper while 80% of the vertices sit in one bucket, which is exactly what
    // a too-wide span did: 61% of the render's pixels landed in a single hue.
    const deciles = new Array(10).fill(0);
    for (const x of s) deciles[Math.min(9, Math.floor(x * 10))]! += 1;
    expect(Math.max(...deciles) / s.length).toBeLessThan(0.55);
  });

  it('is DIVERGING — an ENGAGED brain must paint real cortex COLD', () => {
    const v = values(ENGAGED);
    let neg = 0;
    for (let i = 0; i < v.length; i++) if (v[i]! < -0.05) neg++;

    // A diverging colormap with only one sign is a sequential colormap wearing a costume, and that is
    // what we shipped: `contrastBold` clamped below-rest values to ZERO, so the cold half of the ramp
    // was mathematically unreachable and the render came back 100% warm (the reference: 74/26).
    //
    // The cold cortex on an engaged brain is DEFAULT-MODE SUPPRESSION — the most reliable effect in
    // the task-vs-rest literature, and the single thing that makes a brain map look like a brain map.
    // If this drops to zero, the clamp is back.
    expect(neg / v.length).toBeGreaterThan(0.08);
  });

  it('paints NOTHING at rest — a contrast of a state against itself is zero', () => {
    const v = values(RESTING_BOLD);
    let peak = 0;
    for (let i = 0; i < v.length; i++) peak = Math.max(peak, Math.abs(v[i]!));
    // Feed the map its own baseline and the surface must sit at the ramp's midpoint everywhere. (Not
    // exactly zero: parcelValue carries a ±0.05 slow wobble so a resting cortex breathes rather than
    // freezing solid.)
    expect(peak).toBeLessThan(0.12);
  });
});

/**
 * THE MAP IS A CONTRAST — the change the owner signed off on (handoff §14.5), pinned.
 *
 * An fMRI figure does not show activity, it shows a DIFFERENCE: this condition minus that one. That
 * is why a real statistical map is mostly grey — most of the cortex is doing what it always does. We
 * were painting raw predicted BOLD against nothing, and with six of seven networks task-positive that
 * meant "engaged" lit the whole brain.
 *
 * Sparsity had to come from the MODEL (a resting baseline + parcels that are selectively tuned), never
 * from quietly raising ACTIVATION_THRESHOLD to hide the response. These tests are what stop the next
 * session doing the cheap thing.
 */
describe('the map is a contrast against rest', () => {
  it('is SIGNED — a network below its own rest must come back NEGATIVE', () => {
    // The default-mode system rests at 0.42 while attention rests at 0.08. A raw subtraction would
    // make the DMN look permanently suppressed and attention permanently dramatic, for reasons that
    // have nothing to do with the stimulus. So each network is scaled by its OWN headroom — and, since
    // 2026-07-14, by its own headroom ON THE SIDE IT IS MOVING (SUPPRESSION_P95 for the way down).
    const c = contrastBold(RESTING_BOLD);
    for (const id of NETWORK_IDS) expect(c[id]).toBeCloseTo(0, 5);

    const engaged = contrastBold(ENGAGED);
    expect(engaged.dorsal_attention).toBeGreaterThan(0.5);

    // ⚠️ THIS LINE USED TO READ `expect(engaged.default).toBe(0)`, and it was the bug, pinned as a
    // contract. `contrastBold` clamped everything below rest to zero — deliberately, to protect the
    // accent-dosage rule ("coral means you are losing them, full stop") — which threw away DEFAULT-MODE
    // SUPPRESSION, the one effect that can paint an engaged cortex blue. The map could not diverge, the
    // render came back 100% warm, and this test called that correct.
    expect(engaged.default).toBeLessThan(-0.1);

    // And it must still not saturate: pegged at −1 on every frame, the DMN has no dynamic range left
    // and reports nothing. (It did peg, at exactly −1.000, until the negative tail got its own scale.)
    expect(engaged.default).toBeGreaterThan(-0.99);
  });

  it('keeps the finding: when the room drifts, the DMN is the loudest thing on the map', () => {
    // The card exists to say "you are losing them", and that claim lives in the MODEL, not the palette.
    // It survived the map being rebuilt underneath it, and this is the assertion that proves it — the
    // one the old hand-written fixtures (default: 0.83, hotter than the model can actually go) could
    // never make honestly.
    const drifting = contrastBold(DRIFTING);
    expect(drifting.default).toBeGreaterThan(0);
    expect(drifting.default).toBeGreaterThan(drifting.dorsal_attention);

    // ⚠️ AND IT IS NOW WARM, NOT CORAL — the semantics of the COLOUR changed even though the finding
    // did not. The surface paints the signed contrast directly (no polarity flip), so "above this
    // system's own resting level" is warm wherever it happens, and a drifting room's default-mode
    // cortex runs hot. The colorbar says `below rest / above rest` for exactly this reason, and the
    // verdict line — not the colour — is what tells the creator the room walked out.
    const v = values(DRIFTING);
    let warmDefault = 0;
    for (let i = 0; i < v.length; i++) if (v[i]! > 0.15) warmDefault++;
    expect(warmDefault / v.length).toBeGreaterThan(0.015);
  });
});
