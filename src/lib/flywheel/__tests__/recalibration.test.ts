/**
 * recalibration.test.ts — TDD RED/GREEN for buildOverride (10-01 Task 3, FLYWHEEL-04).
 *
 * Pure, deterministic. Translates ONE confirmed calibration proposal into a bounded,
 * re-normalized PersonaWeights override. The only weights touched are the passed-in
 * current audience weights — NEVER DEFAULT_PERSONA_WEIGHT_CONFIG / ARCHETYPE_DEFINITIONS.
 *
 * Covers:
 *  - RECALIBRATION_STEP defaults to the conservative 0.05 (A5; env-overridable)
 *  - output always sums to 1.0 (±0.01) and every weight in [0,1]
 *  - positive mean nudges the disposition's slot UP; negative nudges DOWN
 *  - collector → fyp slot; converter → niche slot; connector → fyp+loyalist
 *  - clamping holds the bound when a slot is already near 1 or near 0
 *  - determinism
 */

import { describe, it, expect } from "vitest";
import { buildOverride, RECALIBRATION_STEP } from "../recalibration";
import type { Proposal } from "../confidence-gate";
import type { PersonaWeights } from "@/lib/engine/persona-weights";

const proposal = (
  disposition: Proposal["disposition"],
  mean: number,
): Proposal => ({ disposition, mean, n: 5, agree: 1 });

const EVEN: PersonaWeights = { fyp: 0.25, niche: 0.25, loyalist: 0.25, cross_niche: 0.25 };

const sum = (w: PersonaWeights) => w.fyp + w.niche + w.loyalist + w.cross_niche;
const inRange = (w: PersonaWeights) =>
  [w.fyp, w.niche, w.loyalist, w.cross_niche].every((v) => v >= 0 && v <= 1);

describe("RECALIBRATION_STEP (A5 — conservative default, env-overridable)", () => {
  it("defaults to the conservative 0.05 bounded-nudge size", () => {
    expect(RECALIBRATION_STEP).toBeCloseTo(0.05, 10);
  });
});

describe("buildOverride", () => {
  it("always returns a vector summing to 1.0 (±0.01) with all weights in [0,1]", () => {
    const out = buildOverride(proposal("collector", 0.2), EVEN);
    expect(sum(out)).toBeCloseTo(1.0, 2);
    expect(inRange(out)).toBe(true);
  });

  it("nudges the collector's fyp slot UP on a positive mean", () => {
    const out = buildOverride(proposal("collector", 0.2), EVEN);
    // pre-normalization fyp = 0.25 + 0.05 = 0.30 (highest); after normalize still the max
    const max = Math.max(out.fyp, out.niche, out.loyalist, out.cross_niche);
    expect(out.fyp).toBe(max);
  });

  it("nudges the converter's niche slot UP on a positive mean", () => {
    const out = buildOverride(proposal("converter", 0.3), EVEN);
    const max = Math.max(out.fyp, out.niche, out.loyalist, out.cross_niche);
    expect(out.niche).toBe(max);
  });

  it("nudges DOWN on a negative mean", () => {
    const out = buildOverride(proposal("collector", -0.2), EVEN);
    // fyp pre-norm = 0.25 - 0.05 = 0.20 (lowest)
    const min = Math.min(out.fyp, out.niche, out.loyalist, out.cross_niche);
    expect(out.fyp).toBe(min);
  });

  it("spreads a connector nudge across fyp + loyalist slots", () => {
    const out = buildOverride(proposal("connector", 0.2), EVEN);
    // both fyp and loyalist nudged up equally → both exceed the untouched niche/cross
    expect(out.fyp).toBeGreaterThan(out.niche);
    expect(out.loyalist).toBeGreaterThan(out.niche);
    expect(out.fyp).toBeCloseTo(out.loyalist, 10);
  });

  it("clamps so a slot already at 1.0 cannot exceed it (stays normalized, in range)", () => {
    const heavy: PersonaWeights = { fyp: 1, niche: 0, loyalist: 0, cross_niche: 0 };
    const out = buildOverride(proposal("collector", 0.5), heavy);
    expect(inRange(out)).toBe(true);
    expect(sum(out)).toBeCloseTo(1.0, 2);
  });

  it("clamps so a slot at 0 cannot go negative on a downward nudge", () => {
    const out = buildOverride(proposal("converter", -0.5), {
      fyp: 0.5,
      niche: 0,
      loyalist: 0.25,
      cross_niche: 0.25,
    });
    expect(inRange(out)).toBe(true);
    expect(out.niche).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic", () => {
    const p = proposal("collector", 0.2);
    expect(buildOverride(p, EVEN)).toEqual(buildOverride(p, EVEN));
  });
});
