import { describe, expect, it } from "vitest";
import { buildOutcomeReadout } from "../outcome-readout";
import type { Disposition } from "@/lib/audience/audience-types";

// A full 6-dim predicted vector (predictedSignature output — sums to ~1 across all dispositions).
function predicted(over: Partial<Record<Disposition, number>> = {}): Record<Disposition, number> {
  return {
    scanner: 0.2,
    skeptic: 0.1,
    collector: 0.2,
    connector: 0.2,
    converter: 0.1,
    lurker: 0.2,
    ...over,
  };
}

describe("buildOutcomeReadout", () => {
  it("renormalizes predicted over the MEASURED support (public-only capture) for like-for-like", () => {
    // realizedSignature normalizes across present channels → collector+connector sum to 1.0.
    const r = buildOutcomeReadout(predicted(), { collector: 0.6, connector: 0.4 });
    expect(r.measured).toEqual(["collector", "connector"]);
    // predicted restricted+renormalized = {0.5, 0.5}; realized = {0.6, 0.4} → TVD 0.1 → 90% match.
    expect(r.matchPct).toBe(90);
    expect(r.headline).toBe("Your savers showed up stronger than the room predicted.");
  });

  it("reports 100% match when the renormalized distributions coincide (no false standout)", () => {
    const r = buildOutcomeReadout(predicted(), { collector: 0.5, connector: 0.5 });
    expect(r.matchPct).toBe(100);
    expect(r.headline).toBeNull(); // zero shift < STANDOUT_MIN
  });

  it("names an UNDER-performing standout with the right direction", () => {
    const r = buildOutcomeReadout(predicted(), { collector: 0.3, connector: 0.7 });
    // predicted renorm {0.5,0.5}; collector 0.3 < 0.5 → fewer savers.
    expect(r.headline).toBe("Fewer savers than the room predicted.");
  });

  it("returns no match % when fewer than two dispositions were measured", () => {
    const r = buildOutcomeReadout(predicted(), { collector: 1.0 });
    expect(r.measured).toEqual(["collector"]);
    expect(r.matchPct).toBeNull();
    expect(r.headline).toBeNull();
  });

  it("returns no match % when a disposition is absent from the prediction", () => {
    // realized has a disposition the predicted vector never scored → not in the intersection.
    const r = buildOutcomeReadout({ collector: 0.5 }, { collector: 0.5, connector: 0.5 });
    expect(r.measured).toEqual(["collector"]);
    expect(r.matchPct).toBeNull();
  });

  it("guards a zero-sum measured support (no division, no misleading number)", () => {
    const r = buildOutcomeReadout(predicted({ collector: 0, connector: 0 }), {
      collector: 0.6,
      connector: 0.4,
    });
    expect(r.matchPct).toBeNull();
  });
});
