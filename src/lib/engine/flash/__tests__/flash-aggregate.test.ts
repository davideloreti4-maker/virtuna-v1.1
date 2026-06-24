/**
 * Tests for flash-aggregate.ts — aggregateFlash pure deterministic function.
 *
 * TDD RED phase: written against the spec (01-03-PLAN.md Task 1 <behavior>)
 * before flash-aggregate.ts exists.
 *
 * D-11 honesty spine: aggregate output must NEVER contain a numeric score,
 * percentile, view count, or engagement field.
 */
import { describe, it, expect } from "vitest";
import { aggregateFlash, type FlashWeighting } from "../flash-aggregate";
import type { FlashPersona } from "../flash-schema";

// Helper: build a persona with a given verdict
function p(archetype: string, verdict: "stop" | "scroll"): FlashPersona {
  return { archetype, verdict, quote: "Some quote about the content." };
}

// 10 personas where N say stop
function personas(stopCount: number): FlashPersona[] {
  return Array.from({ length: 10 }, (_, i) => p(`archetype_${i}`, i < stopCount ? "stop" : "scroll"));
}

// A1 weighting whose slotOf maps each persona's archetype directly to its bucket key.
// The runner builds the real one from the registry (persona-weighting.ts); these unit
// tests inject slotOf directly to exercise aggregateFlash's weighted-mass math in isolation.
function weighting(
  weights: Record<string, number>,
  slotOf: (a: string) => string | null,
): FlashWeighting {
  return { weights, slotOf };
}

describe("aggregateFlash — band thresholds (ENGINE-01 calibration)", () => {
  it("6 stops → band: Strong", () => {
    const result = aggregateFlash(personas(6));
    expect(result.band).toBe("Strong");
  });

  it("7 stops → band: Strong", () => {
    const result = aggregateFlash(personas(7));
    expect(result.band).toBe("Strong");
  });

  it("10 stops → band: Strong", () => {
    const result = aggregateFlash(personas(10));
    expect(result.band).toBe("Strong");
  });

  it("3 stops → band: Mixed", () => {
    const result = aggregateFlash(personas(3));
    expect(result.band).toBe("Mixed");
  });

  it("4 stops → band: Mixed", () => {
    const result = aggregateFlash(personas(4));
    expect(result.band).toBe("Mixed");
  });

  it("5 stops → band: Mixed", () => {
    const result = aggregateFlash(personas(5));
    expect(result.band).toBe("Mixed");
  });

  it("1 stop → band: Weak", () => {
    const result = aggregateFlash(personas(1));
    expect(result.band).toBe("Weak");
  });

  it("0 stops → band: Weak", () => {
    const result = aggregateFlash(personas(0));
    expect(result.band).toBe("Weak");
  });

  it("2 stops → band: Weak", () => {
    const result = aggregateFlash(personas(2));
    expect(result.band).toBe("Weak");
  });
});

describe("aggregateFlash — fraction string format", () => {
  it("6 stops → fraction: '6/10 stop'", () => {
    const result = aggregateFlash(personas(6));
    expect(result.fraction).toBe("6/10 stop");
  });

  it("3 stops → fraction: '3/10 stop'", () => {
    const result = aggregateFlash(personas(3));
    expect(result.fraction).toBe("3/10 stop");
  });

  it("1 stop → fraction: '1/10 stop'", () => {
    const result = aggregateFlash(personas(1));
    expect(result.fraction).toBe("1/10 stop");
  });

  it("0 stops → fraction: '0/10 stop'", () => {
    const result = aggregateFlash(personas(0));
    expect(result.fraction).toBe("0/10 stop");
  });

  it("10 stops → fraction: '10/10 stop'", () => {
    const result = aggregateFlash(personas(10));
    expect(result.fraction).toBe("10/10 stop");
  });
});

describe("aggregateFlash — D-11 honesty spine (NO fabricated numeric forecast)", () => {
  it("result has NO score field", () => {
    const result = aggregateFlash(personas(5)) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty("score");
  });

  it("result has NO percentile field", () => {
    const result = aggregateFlash(personas(5)) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty("percentile");
  });

  it("result has NO views field", () => {
    const result = aggregateFlash(personas(5)) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty("views");
  });

  it("result has NO engagement field", () => {
    const result = aggregateFlash(personas(5)) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty("engagement");
  });

  it("result has NO reach field", () => {
    const result = aggregateFlash(personas(5)) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty("reach");
  });

  it("result has exactly two fields: band and fraction", () => {
    const result = aggregateFlash(personas(5));
    const keys = Object.keys(result);
    expect(keys.sort()).toEqual(["band", "fraction"].sort());
  });
});

describe("aggregateFlash — determinism", () => {
  it("same input → same output (pure function, no randomness)", () => {
    const input = personas(5);
    const r1 = aggregateFlash(input);
    const r2 = aggregateFlash(input);
    expect(r1).toEqual(r2);
  });
});

// ─── A1: weighted SIM aggregation (calibrated-audience band) ────────────────────

describe("aggregateFlash — A1 weighted band", () => {
  // slotOf that maps the real 4 buckets; everything else → null (unknown).
  const fourBucket = (a: string): string | null =>
    ["fyp", "niche", "loyalist", "cross_niche"].includes(a) ? a : null;

  // A balanced 1-per-bucket panel where every persona is its own equal-weight bucket.
  // With equal weights the weighted stop-MASS fraction == stop-count / total → SAME
  // bands as the flat path. This is the regression-safety proof for the weighting math.
  function equalBuckets(stops: boolean[]): FlashPersona[] {
    return stops.map((stop, i) => p(`b_${i}`, stop ? "stop" : "scroll"));
  }
  const equalSlotOf = (a: string): string | null => a; // each archetype its own bucket
  const equalWeights = (n: number): Record<string, number> =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`b_${i}`, 1])) as Record<string, number>;

  it("equal weights reproduce the flat band exactly (6/10 → Strong)", () => {
    const panel = equalBuckets(Array.from({ length: 10 }, (_, i) => i < 6));
    const w = weighting(equalWeights(10), equalSlotOf);
    expect(aggregateFlash(panel, w).band).toBe("Strong");
    expect(aggregateFlash(panel, w).band).toBe(aggregateFlash(panel).band);
  });

  it("equal weights reproduce the flat band exactly (3/10 → Mixed, 2/10 → Weak)", () => {
    const mixed = equalBuckets(Array.from({ length: 10 }, (_, i) => i < 3));
    const weak = equalBuckets(Array.from({ length: 10 }, (_, i) => i < 2));
    expect(aggregateFlash(mixed, weighting(equalWeights(10), equalSlotOf)).band).toBe("Mixed");
    expect(aggregateFlash(weak, weighting(equalWeights(10), equalSlotOf)).band).toBe("Weak");
  });

  it("niche-heavy audience flips a flat-Weak panel to Strong (the moat)", () => {
    // 6 fyp scroll + 2 niche stop + loyalist scroll + cross scroll → flat stops = 2 → Weak.
    const panel: FlashPersona[] = [
      ...Array.from({ length: 6 }, () => p("fyp", "scroll")),
      p("niche", "stop"),
      p("niche", "stop"),
      p("loyalist", "scroll"),
      p("cross_niche", "scroll"),
    ];
    expect(aggregateFlash(panel).band).toBe("Weak"); // flat
    // Audience that is 70% niche-buyers: the 2 niche stops carry 0.7 of the mass → Strong.
    const w = weighting({ fyp: 0.1, niche: 0.7, loyalist: 0.1, cross_niche: 0.1 }, fourBucket);
    const r = aggregateFlash(panel, w);
    expect(r.band).toBe("Strong");
    // fraction stays the honest raw count regardless of weighting.
    expect(r.fraction).toBe("2/10 stop");
  });

  it("fyp-heavy audience can suppress a flat-Mixed panel toward Weak", () => {
    // 6 fyp scroll + niche stop + niche stop + loyalist stop + cross stop → flat stops = 4 → Mixed.
    const panel: FlashPersona[] = [
      ...Array.from({ length: 6 }, () => p("fyp", "scroll")),
      p("niche", "stop"),
      p("niche", "stop"),
      p("loyalist", "stop"),
      p("cross_niche", "stop"),
    ];
    expect(aggregateFlash(panel).band).toBe("Mixed"); // flat (4 stops)
    // 85% fyp audience, all fyp scrolled → weighted stop-mass = 0.15 < 0.3 → Weak.
    const w = weighting({ fyp: 0.85, niche: 0.05, loyalist: 0.05, cross_niche: 0.05 }, fourBucket);
    expect(aggregateFlash(panel, w).band).toBe("Weak");
  });

  it("per-slot population normalizes: 6 fyp personas share the fyp weight (not 6×)", () => {
    // If fyp weight were NOT divided by population, 6 fyp stops would dominate. With division,
    // each fyp persona = 0.65/6 ≈ 0.108; all 6 fyp stop → stopMass = 0.65 of totalMass 1.0 → Strong.
    const panel: FlashPersona[] = [
      ...Array.from({ length: 6 }, () => p("fyp", "stop")),
      p("niche", "scroll"),
      p("niche", "scroll"),
      p("loyalist", "scroll"),
      p("cross_niche", "scroll"),
    ];
    const w = weighting({ fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 }, fourBucket);
    const r = aggregateFlash(panel, w);
    // stopMass = 0.65 (all fyp) / totalMass 1.0 = 0.65 ≥ 0.6 → Strong.
    expect(r.band).toBe("Strong");
  });

  it("unknown archetypes (no bucket) → totalMass 0 → falls back to the flat band", () => {
    // Mirrors the steer-closure synthetic `arch_N` panel: slotOf returns null for all.
    const panel = personas(8); // archetype_0..9, 8 stops
    const w = weighting({ fyp: 0.99, niche: 0.01, loyalist: 0, cross_niche: 0 }, fourBucket);
    const r = aggregateFlash(panel, w);
    expect(r.band).toBe("Strong"); // flat 8 stops, weighting ignored (no division by zero)
    expect(r).toEqual(aggregateFlash(panel)); // byte-identical to the flat path
  });

  it("normalizes over PRESENT slots when a bucket is absent from the panel", () => {
    // Only fyp + niche present. weights sum < 1 across present slots; band uses the
    // normalized fraction stopMass/totalMass, not stopMass/1.0.
    const panel: FlashPersona[] = [
      ...Array.from({ length: 4 }, () => p("fyp", "scroll")),
      p("niche", "stop"),
      p("niche", "stop"),
    ];
    // fyp weight 0.65 over 4 personas, niche 0.2 over 2. totalMass = 0.65 + 0.2 = 0.85.
    // stopMass = 0.2 (both niche). frac = 0.2/0.85 ≈ 0.235 < 0.3 → Weak.
    const w = weighting({ fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 }, fourBucket);
    expect(aggregateFlash(panel, w).band).toBe("Weak");
  });
});
