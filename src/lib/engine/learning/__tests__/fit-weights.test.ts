import { describe, it, expect } from "vitest";
import {
  fitWeightsForNiche,
  fitNicheWeights,
  blendScore,
  evaluateWeights,
  DEFAULT_WEIGHTS,
  type LabeledSignalRow,
} from "../fit-weights";

// Build a niche where `gemini` cleanly separates viral (high) from under (low),
// while `behavioral` is ANTI-correlated (high for losers, low for winners). The
// hand-set DEFAULT_WEIGHTS trust behavioral MORE than gemini (0.40 vs 0.35), so
// they get actively misled; fitted weights zero behavioral out and win.
function makeNiche(niche: string): LabeledSignalRow[] {
  const rows: LabeledSignalRow[] = [];
  const viralGemini = [92, 88, 85, 90, 87];
  const viralBehavioral = [12, 18, 15, 10, 20]; // winners have LOW behavioral (misleading)
  const underGemini = [12, 18, 15, 10, 20];
  const underBehavioral = [88, 82, 85, 90, 80]; // losers have HIGH behavioral (misleading)
  viralGemini.forEach((g, i) =>
    rows.push({ id: `${niche}-v${i}`, niche, real_bucket: "viral", signals: { gemini: g, behavioral: viralBehavioral[i] } }),
  );
  underGemini.forEach((g, i) =>
    rows.push({ id: `${niche}-u${i}`, niche, real_bucket: "under", signals: { gemini: g, behavioral: underBehavioral[i] } }),
  );
  // a couple of average rows so 3-class eval has all classes
  rows.push({ id: `${niche}-a0`, niche, real_bucket: "average", signals: { gemini: 50, behavioral: 50 } });
  rows.push({ id: `${niche}-a1`, niche, real_bucket: "average", signals: { gemini: 55, behavioral: 50 } });
  return rows;
}

describe("fitWeightsForNiche", () => {
  it("gives the separating signal dominant weight, noise ~0", () => {
    const w = fitWeightsForNiche(makeNiche("beauty"))!;
    expect(w).not.toBeNull();
    expect(w.gemini).toBeGreaterThan(0.9); // gemini separates → almost all weight
    expect(w.behavioral).toBeLessThan(0.1); // noise → near zero
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("returns null when a class is too small", () => {
    const rows: LabeledSignalRow[] = [
      { id: "1", niche: "x", real_bucket: "viral", signals: { gemini: 90 } },
      { id: "2", niche: "x", real_bucket: "under", signals: { gemini: 10 } },
    ];
    expect(fitWeightsForNiche(rows)).toBeNull();
  });
});

describe("fitNicheWeights", () => {
  it("fits niches with data, defaults the rest", () => {
    const rows = [...makeNiche("beauty"), { id: "f1", niche: "fitness", real_bucket: "viral" as const, signals: { gemini: 80 } }];
    const { weightsByNiche, fittedNiches, defaultedNiches } = fitNicheWeights(rows);
    expect(fittedNiches).toContain("beauty");
    expect(defaultedNiches).toContain("fitness");
    expect(weightsByNiche.fitness).toEqual(DEFAULT_WEIGHTS);
  });
});

describe("blendScore", () => {
  it("renormalizes weights over present signals only", () => {
    // gemini present (w .35), behavioral absent. Blend = gemini alone.
    expect(blendScore({ gemini: 80 }, DEFAULT_WEIGHTS)).toBeCloseTo(80, 5);
    // both present: weighted avg renormalized over .40 + .35
    const v = blendScore({ behavioral: 100, gemini: 0 }, DEFAULT_WEIGHTS);
    expect(v).toBeCloseTo((0.4 * 100) / (0.4 + 0.35), 5);
  });
});

describe("evaluateWeights — fitted beats hand-set when defaults trust a noisy signal", () => {
  it("fitted weights raise macro-F1 vs DEFAULT_WEIGHTS", () => {
    const rows = makeNiche("beauty");
    const { weightsByNiche } = fitNicheWeights(rows);
    const fitted = evaluateWeights(rows, weightsByNiche);
    const baseline = evaluateWeights(rows, { beauty: DEFAULT_WEIGHTS });
    expect(fitted.macroF1).toBeGreaterThan(baseline.macroF1);
    expect(fitted.matchRate).toBeGreaterThanOrEqual(baseline.matchRate);
  });
});
