/**
 * The cortical surface. These tests exist because the brain was rejected TWICE for looking fake,
 * and each assertion below pins one of the properties that separates a real-looking cortex from a
 * shaded potato. They are all headless — the WebGL view is a thin shell over this file.
 *
 * Binding (do not relax without the owner):
 *  - the surface is FOLDED (gyri and sulci), and the normals actually see the folds — this is the
 *    single reason it reads as an organ rather than a leaf;
 *  - the activation field is SPATIALLY SMOOTH across the surface: no speckle, and no visible parcel
 *    edges (the mosaic is what made the first two cuts look generated);
 *  - the map is DIVERGING on the task-positive / default-mode axis, so the locked accent-dosage rule
 *    holds and coral keeps meaning "you are losing them";
 *  - it is DETERMINISTIC, so SSR and hydration agree and a focus always looks like itself.
 */
import { describe, it, expect } from 'vitest';
import {
  cortexMesh,
  parcelTextures,
  surfaceValues,
  NETWORK_POLARITY,
  NETWORK_META,
  BLEND_K,
} from '../cortex-mesh';
import { NETWORK_IDS, ACTIVATION_THRESHOLD, type NetworkId } from '../cortex-sim';

const SEED = 20260713;
const mesh = cortexMesh(SEED);

/** A flat "everything engaged" response — enough to paint the surface. */
const boldAt = (v: number): Record<NetworkId, number> =>
  Object.fromEntries(NETWORK_IDS.map((id) => [id, v])) as Record<NetworkId, number>;

describe('cortex-mesh — the surface', () => {
  it('is a dense closed surface: every triangle indexes real vertices', () => {
    expect(mesh.vertexCount).toBeGreaterThan(30_000);
    expect(mesh.indices.length % 3).toBe(0);
    for (const i of mesh.indices) expect(i).toBeLessThan(mesh.vertexCount);
  });

  it('is FOLDED — it has both gyral crowns and sulcal depths, not one smooth shell', () => {
    let crowns = 0;
    let sulci = 0;
    for (const c of mesh.curv) {
      if (c > 0.7) crowns++;
      if (c < 0.25) sulci++;
    }
    // A smooth ellipsoid would put every vertex at one curvature. A real cortex carries a broad
    // population of BOTH crowns and creases. Measured: ~39% crown, ~32% sulcus.
    expect(crowns / mesh.vertexCount).toBeGreaterThan(0.25);
    expect(sulci / mesh.vertexCount).toBeGreaterThan(0.15);

    // And the crowns must not be a PLATEAU. Saturating the curvature (clamping every point clear of
    // a sulcus to exactly 1.0) produces conspicuous flat panels across the surface — an artifact
    // that gives the whole thing away as generated. The spread here is what keeps gyri rounded.
    const sorted = Array.from(mesh.curv).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)]!;
    const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
    expect(p90 - p50).toBeGreaterThan(0.1);
  });

  it('has normals that SEE the folds — the light is what makes it read as a solid', () => {
    // On a smooth ellipsoid every normal is ≈ the radial direction. On a folded cortex the folds
    // tilt the normals away from radial. If this collapses, the brain goes flat again — which is
    // exactly the defect that got the last two cuts rejected.
    let tilted = 0;
    let n = 0;
    for (let i = 0; i < mesh.vertexCount; i += 7) {
      const px = mesh.positions[i * 3]!;
      const py = mesh.positions[i * 3 + 1]!;
      const pz = mesh.positions[i * 3 + 2]!;
      const pl = Math.hypot(px, py, pz) || 1;
      const dot =
        (px / pl) * mesh.normals[i * 3]! +
        (py / pl) * mesh.normals[i * 3 + 1]! +
        (pz / pl) * mesh.normals[i * 3 + 2]!;
      // >25° away from radial counts as a genuine fold face.
      if (dot < Math.cos((25 * Math.PI) / 180)) tilted++;
      n++;
    }
    expect(tilted / n).toBeGreaterThan(0.25);
  });

  it('carries unit normals', () => {
    for (let i = 0; i < mesh.vertexCount; i += 101) {
      const l = Math.hypot(mesh.normals[i * 3]!, mesh.normals[i * 3 + 1]!, mesh.normals[i * 3 + 2]!);
      expect(l).toBeCloseTo(1, 3);
    }
  });

  it('is deterministic — the same seed rebuilds the identical surface', () => {
    const again = cortexMesh(SEED);
    expect(again.positions).toBe(mesh.positions); // memoized
    expect(Array.from(cortexMesh(99).positions.slice(0, 30))).not.toEqual(
      Array.from(mesh.positions.slice(0, 30)),
    );
  });
});

describe('cortex-mesh — the parcellation', () => {
  it('covers every network, and names them all', () => {
    const seen = new Set(mesh.parcelNet);
    for (const id of NETWORK_IDS) {
      expect(seen.has(id)).toBe(true);
      expect(NETWORK_META[id].label.length).toBeGreaterThan(0);
    }
  });

  it('blends each vertex across its nearest parcels, weights summing to 1', () => {
    for (let i = 0; i < mesh.vertexCount; i += 331) {
      let sum = 0;
      let top = 0;
      for (let q = 0; q < BLEND_K; q++) {
        const b = i * BLEND_K + q;
        expect(mesh.blendIdx[b]!).toBeLessThan(mesh.parcelCount);
        sum += mesh.blendW[b]!;
        top = Math.max(top, mesh.blendW[b]!);
      }
      expect(sum).toBeCloseTo(1, 4);
      // No vertex may be OWNED by one parcel: a peaked kernel collapses to nearest-parcel and
      // silently rebuilds the hard-edged mosaic. This is the assertion that pins the fix.
      expect(top).toBeLessThan(0.9);
    }
  });
});

describe('cortex-mesh — the activation field', () => {
  const textures = parcelTextures(mesh, SEED);

  it('is SPATIALLY SMOOTH — no speckle, and no visible parcel edges', () => {
    const v = surfaceValues(mesh, textures, boldAt(0.7), 4);

    // The right measure is the surface GRADIENT — the value change per unit DISTANCE — not the raw
    // delta across an edge. The map is legitimately allowed to swing hard from sage to coral at a
    // network border; what it may never do is STEP. A hard parcel edge is a step change over ~zero
    // distance, i.e. an unbounded gradient, so this is what actually discriminates a smooth field
    // from the mosaic. (A raw-delta bound conflates the two and fails an honest map.)
    const dist = (a: number, b: number) =>
      Math.hypot(
        mesh.positions[a * 3]! - mesh.positions[b * 3]!,
        mesh.positions[a * 3 + 1]! - mesh.positions[b * 3 + 1]!,
        mesh.positions[a * 3 + 2]! - mesh.positions[b * 3 + 2]!,
      );

    let worst = 0;
    let total = 0;
    let edges = 0;
    for (let f = 0; f < mesh.indices.length; f += 3) {
      const pairs: [number, number][] = [
        [mesh.indices[f]!, mesh.indices[f + 1]!],
        [mesh.indices[f + 1]!, mesh.indices[f + 2]!],
      ];
      for (const [a, b] of pairs) {
        const g = Math.abs(v[a]! - v[b]!) / Math.max(dist(a, b), 1e-6);
        worst = Math.max(worst, g);
        total += g;
        edges++;
      }
    }
    // Measured: mean ≈ 1.0, max ≈ 9. The peaked kernels that rebuilt the mosaic ran well past 50.
    expect(total / edges).toBeLessThan(2);
    expect(worst).toBeLessThan(20);
  });

  it('is DIVERGING: the default-mode system is the negative pole, everything else positive', () => {
    expect(NETWORK_POLARITY.default).toBe(-1);
    for (const id of NETWORK_IDS) if (id !== 'default') expect(NETWORK_POLARITY[id]).toBe(1);

    // Drive ONLY the default network. The surface must go coral, and nothing may light up sage —
    // this is what keeps the locked accent-dosage rule legal.
    const dmn = { ...boldAt(0), default: 0.95 } as Record<NetworkId, number>;
    const v = surfaceValues(mesh, textures, dmn, 3);
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of v) {
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    expect(lo).toBeLessThan(-ACTIVATION_THRESHOLD);
    expect(hi).toBeLessThan(ACTIVATION_THRESHOLD);
  });

  it('stays THRESHOLDED — a resting cortex paints almost nothing', () => {
    const rest = surfaceValues(mesh, textures, boldAt(0.12), 2);
    const lit = Array.from(rest).filter((x) => Math.abs(x) > ACTIVATION_THRESHOLD).length;
    // At rest the map is bare anatomy. Colouring the whole cortex is what reads as stained glass.
    expect(lit).toBe(0);

    // ...and a room that is fully engaged does light up, or the view says nothing at all.
    const hot = surfaceValues(mesh, textures, boldAt(0.95), 6);
    const litHot = Array.from(hot).filter((x) => Math.abs(x) > ACTIVATION_THRESHOLD).length;
    expect(litHot / mesh.vertexCount).toBeGreaterThan(0.25);
  });
});
