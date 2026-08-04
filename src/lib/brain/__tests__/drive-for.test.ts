/**
 * driveFor — the grounded-vs-simulated decision.
 *
 * Why this file exists: `cortex-sim` had good coverage of grounded mode and the suite was green for
 * months, while EVERY video drill actually rendered `mode: 'simulated'` — the choice was inlined in
 * `BrainTab` and nothing asserted it. Testing the model without testing the wiring is how a figure
 * ends up looking alive and saying nothing. These tests assert the wiring: given a real retention
 * curve the drive must be grounded, and the resulting response must MOVE WITH that curve — so a
 * regression back to a seeded envelope fails here rather than shipping.
 */

import { describe, expect, it } from "vitest";
import { driveFor, neuralDrive, predictedBold, NETWORK_IDS, type DriveInput } from "../cortex-sim";

/** Largest per-network gap between two predicted-BOLD maps. */
const maxGap = (a: DriveInput, b: DriveInput, t: number) => {
  const x = predictedBold(a, t);
  const y = predictedBold(b, t);
  return Math.max(...NETWORK_IDS.map((id) => Math.abs(x[id] - y[id])));
};

const CURVE = [1, 0.84, 0.58, 0.38, 0.35, 0.33, 0.3, 0.27, 0.22];
const BASE = { seedKey: "hook-2", stopRatio: 0.38, durationS: 28 };

describe("driveFor — mode selection", () => {
  it("a real retention curve ⇒ grounded", () => {
    const d = driveFor({ ...BASE, retentionCurve: CURVE });
    expect(d.mode).toBe("grounded");
    expect(typeof d.retentionAt).toBe("function");
  });

  it("no curve ⇒ simulated (a text concept has no timeline — never a faked one)", () => {
    expect(driveFor({ ...BASE }).mode).toBe("simulated");
    expect(driveFor({ ...BASE, retentionCurve: null }).mode).toBe("simulated");
    expect(driveFor({ ...BASE, retentionCurve: [] }).mode).toBe("simulated");
    // a single sample is not a curve — there is nothing to interpolate across
    expect(driveFor({ ...BASE, retentionCurve: [0.4] }).mode).toBe("simulated");
  });
});

describe("driveFor — the sampler reads the real curve", () => {
  const at = driveFor({ ...BASE, retentionCurve: CURVE }).retentionAt!;

  it("hits every sample exactly at its own position", () => {
    CURVE.forEach((v, i) => expect(at(i / (CURVE.length - 1))).toBeCloseTo(v, 10));
  });

  it("interpolates linearly between samples", () => {
    const mid = 0.5 / (CURVE.length - 1); // halfway between sample 0 and 1
    expect(at(mid)).toBeCloseTo((CURVE[0]! + CURVE[1]!) / 2, 10);
  });

  it("clamps outside [0,1] rather than reading off the end", () => {
    expect(at(-3)).toBeCloseTo(CURVE[0]!, 10);
    expect(at(9)).toBeCloseTo(CURVE[CURVE.length - 1]!, 10);
  });
});

describe("grounded actually tracks the audience — the property the bug destroyed", () => {
  const grounded = driveFor({ ...BASE, retentionCurve: CURVE });

  it("attention follows retention, and drift is its mirror", () => {
    const early = neuralDrive(grounded, 1); // ~84% still watching
    const late = neuralDrive(grounded, 27); // ~22% still watching
    expect(early.dorsal_attention).toBeGreaterThan(late.dorsal_attention);
    expect(late.default).toBeGreaterThan(early.default);
  });

  it("salience spikes where the curve breaks, not where the clock says so", () => {
    // the steepest fall in CURVE is between samples 1→3 (0.84 → 0.38): t ≈ 7–10s of 28
    const atBreak = neuralDrive(grounded, 9).salience;
    const afterBreak = neuralDrive(grounded, 24).salience; // the curve is nearly flat here
    expect(atBreak).toBeGreaterThan(afterBreak);
  });

  it("two videos with DIFFERENT curves produce different cortices", () => {
    const held = driveFor({ ...BASE, retentionCurve: [1, 0.97, 0.94, 0.9, 0.88, 0.85, 0.83, 0.8, 0.78] });
    expect(maxGap(grounded, held, 14)).toBeGreaterThan(0.05);
  });

  it("the same room produces the SAME cortex — the response is a function of the signal, not the id", () => {
    const other = driveFor({ ...BASE, seedKey: "a-completely-different-card", retentionCurve: CURVE });
    expect(predictedBold(other, 14)).toEqual(predictedBold(grounded, 14));
  });

  it("grounded and simulated are materially different responses", () => {
    expect(maxGap(grounded, driveFor({ ...BASE }), 14)).toBeGreaterThan(0.05);
  });
});
