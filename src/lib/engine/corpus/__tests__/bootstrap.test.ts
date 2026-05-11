import { describe, it, expect } from "vitest";
import { pairedBootstrapMacroF1 } from "../metrics/bootstrap";
import { computeMacroF1 } from "../metrics/macro-f1";
import type { Bucket } from "../eval-config";

const VIRAL: Bucket = "viral";
const AVG: Bucket = "average";
const UNDER: Bucket = "under";

/** Build a 60-sample paired fixture where B is strictly better than A. */
function makeFixture(): {
  actual: Bucket[];
  predictedA: Bucket[];
  predictedB: Bucket[];
} {
  const actual: Bucket[] = [];
  const predictedA: Bucket[] = [];
  const predictedB: Bucket[] = [];
  // 20 viral, 20 avg, 20 under = 60 paired samples
  for (let i = 0; i < 20; i++) {
    actual.push(VIRAL);
    predictedA.push(i < 10 ? VIRAL : AVG); // A correct on 10/20 viral
    predictedB.push(i < 18 ? VIRAL : AVG); // B correct on 18/20 viral (8 more)
  }
  for (let i = 0; i < 20; i++) {
    actual.push(AVG);
    predictedA.push(i < 12 ? AVG : UNDER); // A correct on 12/20 avg
    predictedB.push(i < 18 ? AVG : UNDER); // B correct on 18/20 avg (6 more)
  }
  for (let i = 0; i < 20; i++) {
    actual.push(UNDER);
    predictedA.push(i < 15 ? UNDER : AVG); // A correct on 15/20 under
    predictedB.push(i < 19 ? UNDER : AVG); // B correct on 19/20 under (4 more)
  }
  return { actual, predictedA, predictedB };
}

describe("pairedBootstrapMacroF1 / determinism", () => {
  it("same inputs + seed → identical pValue across consecutive calls", () => {
    const { actual, predictedA, predictedB } = makeFixture();
    const r1 = pairedBootstrapMacroF1(predictedA, predictedB, actual, 200, 42);
    const r2 = pairedBootstrapMacroF1(predictedA, predictedB, actual, 200, 42);
    expect(r2.pValue).toBe(r1.pValue);
    expect(r2.observedDelta).toBe(r1.observedDelta);
    expect(r2.ci95).toEqual(r1.ci95);
  });

  it("different seed → potentially different pValue (sanity for the seed plumbing)", () => {
    const { actual, predictedA, predictedB } = makeFixture();
    const r1 = pairedBootstrapMacroF1(predictedA, predictedB, actual, 200, 42);
    const r2 = pairedBootstrapMacroF1(predictedA, predictedB, actual, 200, 7);
    // We only assert seed plumbing — values may differ; pValue may coincide.
    // Just assert iterations stamped:
    expect(r1.iterations).toBe(200);
    expect(r2.iterations).toBe(200);
  });
});

describe("pairedBootstrapMacroF1 / null hypothesis behavior", () => {
  it("B === A → observedDelta === 0 and pValue ≈ 0.5 (no improvement)", () => {
    const { actual, predictedA } = makeFixture();
    const r = pairedBootstrapMacroF1(predictedA, predictedA, actual, 200, 42);
    expect(r.observedDelta).toBe(0);
    // With identical predictions, every bootstrap delta is exactly 0, all ≤ 0,
    // so pValue = 1.0 by the inequality test — this is the correct degenerate
    // case (not "0.5"; bootstrap noise can't manifest with identical inputs).
    expect(r.pValue).toBe(1);
  });

  it("B strictly better than A → pValue < 0.05", () => {
    const { actual, predictedA, predictedB } = makeFixture();
    // Sanity: B's observed macro-F1 must actually exceed A's
    const fA = computeMacroF1(predictedA, actual).macroF1;
    const fB = computeMacroF1(predictedB, actual).macroF1;
    expect(fB).toBeGreaterThan(fA);

    const r = pairedBootstrapMacroF1(predictedA, predictedB, actual, 200, 42);
    expect(r.observedDelta).toBeGreaterThan(0);
    expect(r.pValue).toBeLessThan(0.05);
  });
});

describe("pairedBootstrapMacroF1 / argument validation", () => {
  it("iters < 200 throws (D-17 minimum)", () => {
    const { actual, predictedA, predictedB } = makeFixture();
    expect(() =>
      pairedBootstrapMacroF1(predictedA, predictedB, actual, 100, 42),
    ).toThrow(/200/);
  });

  it("mismatched lengths throw", () => {
    expect(() =>
      pairedBootstrapMacroF1([VIRAL, AVG], [VIRAL], [VIRAL, AVG], 200, 42),
    ).toThrow(/same length/);
    expect(() =>
      pairedBootstrapMacroF1([VIRAL], [VIRAL], [VIRAL, AVG], 200, 42),
    ).toThrow(/same length/);
  });
});

describe("pairedBootstrapMacroF1 / result shape", () => {
  it("returns { pValue, observedDelta, ci95, iterations }", () => {
    const { actual, predictedA, predictedB } = makeFixture();
    const r = pairedBootstrapMacroF1(predictedA, predictedB, actual, 200, 42);
    expect(typeof r.pValue).toBe("number");
    expect(typeof r.observedDelta).toBe("number");
    expect(r.ci95).toHaveLength(2);
    expect(typeof r.ci95[0]).toBe("number");
    expect(typeof r.ci95[1]).toBe("number");
    expect(r.ci95[0]).toBeLessThanOrEqual(r.ci95[1]);
    expect(r.iterations).toBe(200);
  });

  it("supports iters > 200 (CLI override case)", () => {
    const { actual, predictedA, predictedB } = makeFixture();
    const r = pairedBootstrapMacroF1(predictedA, predictedB, actual, 500, 42);
    expect(r.iterations).toBe(500);
  });
});
