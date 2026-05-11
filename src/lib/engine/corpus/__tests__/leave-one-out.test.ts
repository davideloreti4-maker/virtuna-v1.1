import { describe, it, expect } from "vitest";
import {
  scoreWithoutSignal,
  scoreBaseline,
  SCORE_WEIGHTS_BASE,
  SIGNALS,
  type SignalScores,
} from "../metrics/leave-one-out";

const UNIFORM_50: SignalScores = {
  behavioral: 50,
  gemini: 50,
  ml: 50,
  rules: 50,
  trends: 50,
};

const NON_UNIFORM: SignalScores = {
  behavioral: 80,
  gemini: 20,
  ml: 50,
  rules: 50,
  trends: 50,
};

describe("leave-one-out / scoreBaseline (canonical weights)", () => {
  it("all-50 uniform → baseline === 50 (weights sum to 1.0)", () => {
    expect(scoreBaseline(UNIFORM_50)).toBe(50);
  });

  it("weights match aggregator.ts:23-29 — non-uniform input produces predictable aggregate", () => {
    // 80*0.35 + 20*0.25 + 50*0.15 + 50*0.15 + 50*0.10
    // = 28 + 5 + 7.5 + 7.5 + 5 = 53
    expect(scoreBaseline(NON_UNIFORM)).toBe(53);
  });
});

describe("leave-one-out / scoreWithoutSignal", () => {
  it("all-50 uniform input → ablation === 50 for every signal (uniform stays uniform)", () => {
    for (const sig of SIGNALS) {
      expect(scoreWithoutSignal(UNIFORM_50, sig)).toBe(50);
    }
  });

  it("non-uniform input → removing behavioral (the dominant 80) lowers the aggregate", () => {
    const baseline = scoreBaseline(NON_UNIFORM); // 53
    const withoutBehavioral = scoreWithoutSignal(NON_UNIFORM, "behavioral");
    // baseSum without behavioral = 0.25 + 0.15 + 0.15 + 0.10 = 0.65
    // weighted = (20*0.25 + 50*0.15 + 50*0.15 + 50*0.10) / 0.65
    //         = (5 + 7.5 + 7.5 + 5) / 0.65 = 25/0.65 ≈ 38.46
    expect(withoutBehavioral).toBeLessThan(baseline);
    expect(withoutBehavioral).toBeCloseTo(38.46, 1);
  });

  it("ablating each signal in sequence yields 5 distinct values for non-uniform input", () => {
    const ablations = new Set<number>();
    for (const sig of SIGNALS) {
      ablations.add(scoreWithoutSignal(NON_UNIFORM, sig));
    }
    expect(ablations.size).toBe(SIGNALS.length);
  });

  it("normalized weights (with one signal removed) sum to exactly 1.0", () => {
    // Critical contract: proportional redistribution preserves a sum-to-1 weight set.
    for (const removed of SIGNALS) {
      const remaining = SIGNALS.filter((s) => s !== removed);
      const baseSum = remaining.reduce(
        (s, k) => s + SCORE_WEIGHTS_BASE[k],
        0,
      );
      const normalizedSum = remaining
        .map((s) => SCORE_WEIGHTS_BASE[s] / baseSum)
        .reduce((a, b) => a + b, 0);
      expect(normalizedSum).toBeCloseTo(1, 10);
    }
  });
});

describe("leave-one-out / SCORE_WEIGHTS_BASE matches aggregator.ts", () => {
  it("base weights are the canonical aggregator values", () => {
    expect(SCORE_WEIGHTS_BASE.behavioral).toBe(0.35);
    expect(SCORE_WEIGHTS_BASE.gemini).toBe(0.25);
    expect(SCORE_WEIGHTS_BASE.ml).toBe(0.15);
    expect(SCORE_WEIGHTS_BASE.rules).toBe(0.15);
    expect(SCORE_WEIGHTS_BASE.trends).toBe(0.1);
  });

  it("base weights sum to 1.0", () => {
    const sum = SIGNALS.reduce((s, k) => s + SCORE_WEIGHTS_BASE[k], 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("SIGNALS lists the 5 signal keys", () => {
    expect(SIGNALS).toEqual([
      "behavioral",
      "gemini",
      "ml",
      "rules",
      "trends",
    ]);
  });
});
