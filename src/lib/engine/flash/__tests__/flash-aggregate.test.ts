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
import { aggregateFlash } from "../flash-aggregate";
import type { FlashPersona } from "../flash-schema";

// Helper: build a persona with a given verdict
function p(archetype: string, verdict: "stop" | "scroll"): FlashPersona {
  return { archetype, verdict, quote: "Some quote about the content." };
}

// 10 personas where N say stop
function personas(stopCount: number): FlashPersona[] {
  return Array.from({ length: 10 }, (_, i) => p(`archetype_${i}`, i < stopCount ? "stop" : "scroll"));
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
    const result = aggregateFlash(personas(5)) as Record<string, unknown>;
    expect(result).not.toHaveProperty("score");
  });

  it("result has NO percentile field", () => {
    const result = aggregateFlash(personas(5)) as Record<string, unknown>;
    expect(result).not.toHaveProperty("percentile");
  });

  it("result has NO views field", () => {
    const result = aggregateFlash(personas(5)) as Record<string, unknown>;
    expect(result).not.toHaveProperty("views");
  });

  it("result has NO engagement field", () => {
    const result = aggregateFlash(personas(5)) as Record<string, unknown>;
    expect(result).not.toHaveProperty("engagement");
  });

  it("result has NO reach field", () => {
    const result = aggregateFlash(personas(5)) as Record<string, unknown>;
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
