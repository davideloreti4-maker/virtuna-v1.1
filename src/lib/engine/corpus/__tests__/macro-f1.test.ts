import { describe, it, expect } from "vitest";
import { computeMacroF1 } from "../metrics/macro-f1";
import type { Bucket } from "../eval-config";

const VIRAL: Bucket = "viral";
const AVG: Bucket = "average";
const UNDER: Bucket = "under";

describe("computeMacroF1 / sklearn fixture (D-14)", () => {
  // Confusion matrix [actual][predicted]:
  //   viral row: [2, 0, 0] — 2 true positives, perfect
  //   avg row:   [1, 2, 0] — 1 false positive against viral, 2 TP
  //   under row: [0, 1, 2] — 1 false positive against avg, 2 TP
  // Total: 8 samples.
  //
  // Per-class F1 (computed by hand, matches sklearn f1_score(y, p, average='macro')):
  //   viral:    precision=2/3=0.6667, recall=2/2=1.0,    f1=0.8
  //   average:  precision=2/3=0.6667, recall=2/3=0.6667, f1=0.6667
  //   under:    precision=2/2=1.0,    recall=2/3=0.6667, f1=0.8
  // macroF1 = (0.8 + 0.6667 + 0.8) / 3 = 0.7556 (round to 4 decimals)
  it("matches the hand-computed (sklearn-equivalent) macro-F1 to 4 decimals", () => {
    const actual: Bucket[] = [
      VIRAL,
      VIRAL,
      AVG,
      AVG,
      AVG,
      UNDER,
      UNDER,
      UNDER,
    ];
    const predicted: Bucket[] = [
      VIRAL, // actual viral, predicted viral
      VIRAL, // actual viral, predicted viral
      VIRAL, // actual avg,   predicted viral (FP against viral)
      AVG, // actual avg,   predicted avg
      AVG, // actual avg,   predicted avg
      AVG, // actual under, predicted avg   (FP against avg)
      UNDER, // actual under, predicted under
      UNDER, // actual under, predicted under
    ];

    const result = computeMacroF1(predicted, actual);

    expect(result.macroF1).toBe(0.7556);
    expect(result.perClass.viral.f1).toBe(0.8);
    expect(result.perClass.viral.support).toBe(2);
    expect(result.perClass.average.f1).toBe(0.6667);
    expect(result.perClass.average.support).toBe(3);
    expect(result.perClass.under.f1).toBe(0.8);
    expect(result.perClass.under.support).toBe(3);

    // Confusion matrix shape [actual][predicted] with CLASSES order viral/avg/under
    expect(result.confusionMatrix).toEqual([
      [2, 0, 0],
      [1, 2, 0],
      [0, 1, 2],
    ]);
  });
});

describe("computeMacroF1 / edge cases", () => {
  it("perfect predictor → macroF1 === 1.0", () => {
    const a: Bucket[] = [VIRAL, AVG, UNDER, VIRAL, AVG, UNDER];
    const result = computeMacroF1(a, a);
    expect(result.macroF1).toBe(1);
    expect(result.perClass.viral.precision).toBe(1);
    expect(result.perClass.viral.recall).toBe(1);
    expect(result.perClass.average.f1).toBe(1);
    expect(result.perClass.under.f1).toBe(1);
  });

  it("all-wrong predictor → macroF1 < 0.5", () => {
    // Every "viral" predicted as "under" and vice versa, "average" → "viral"
    const actual: Bucket[] = [VIRAL, VIRAL, AVG, AVG, UNDER, UNDER];
    const predicted: Bucket[] = [
      UNDER,
      UNDER,
      VIRAL,
      VIRAL,
      VIRAL,
      VIRAL,
    ];
    const result = computeMacroF1(predicted, actual);
    expect(result.macroF1).toBeLessThan(0.5);
  });

  it("empty arrays throw", () => {
    expect(() => computeMacroF1([], [])).toThrow(/empty/i);
  });

  it("mismatched array lengths throw", () => {
    expect(() => computeMacroF1([VIRAL], [VIRAL, AVG])).toThrow(/same length/i);
  });

  it("single-class predictions (degenerate but defined)", () => {
    // All actual viral; predict all viral → perfect on viral, precision=recall=1
    // Other classes have support=0 → precision=recall=f1=0 by definition
    const a: Bucket[] = [VIRAL, VIRAL, VIRAL];
    const p: Bucket[] = [VIRAL, VIRAL, VIRAL];
    const result = computeMacroF1(p, a);
    expect(result.perClass.viral.f1).toBe(1);
    expect(result.perClass.average.f1).toBe(0);
    expect(result.perClass.under.f1).toBe(0);
    // macroF1 = (1 + 0 + 0) / 3 = 0.3333
    expect(result.macroF1).toBe(0.3333);
  });
});
