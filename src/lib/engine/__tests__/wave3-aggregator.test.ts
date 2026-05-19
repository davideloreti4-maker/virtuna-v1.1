import { describe, it, expect } from "vitest";
import {
  aggregatePersonaResults,
  TOP_WEIGHT_TOTAL,
  REMAINING_WEIGHT_TOTAL,
} from "../wave3/aggregator";
import type { PersonaSimulationResult } from "../types";
import type { Archetype } from "../wave3/persona-registry";

function makePersona(
  overrides: Partial<PersonaSimulationResult> = {},
): PersonaSimulationResult {
  return {
    persona_id: "fyp-saver-beauty",
    archetype: "saver",
    slot_type: "fyp",
    niche: "beauty",
    scroll_past_second: 5,
    watch_through_pct: 50,
    comment_intent: 50,
    share_intent: 50,
    save_intent: 50,
    reasoning: "default test reasoning",
    ...overrides,
  };
}

function makeSurvivors(
  count: number,
  override: (i: number) => Partial<PersonaSimulationResult> = () => ({}),
): PersonaSimulationResult[] {
  const archetypes: Archetype[] = [
    "high_engager",
    "saver",
    "lurker",
    "sharer",
    "tough_crowd",
    "purposeful_viewer",
    "niche_deep_buyer",
    "niche_deep_scout",
    "loyalist",
    "cross_niche_curiosity",
  ];
  return Array.from({ length: count }, (_, i) =>
    makePersona({
      persona_id: `p${i}`,
      archetype: archetypes[i % archetypes.length]!,
      ...override(i),
    }),
  );
}

describe("aggregatePersonaResults (Phase 7 D-06 + D-13)", () => {
  it("Test 1: 10 survivors all watch_through_pct=50 → completion_pct=50, no warnings", () => {
    const result = aggregatePersonaResults(makeSurvivors(10));
    expect(result.aggregate).not.toBeNull();
    expect(result.aggregate!.completion_pct).toBe(50);
    expect(result.warnings).toEqual([]);
  });

  it("Test 2: D-13 threshold met at n=7 → aggregate non-null", () => {
    const result = aggregatePersonaResults(makeSurvivors(7));
    expect(result.aggregate).not.toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("Test 3: D-13 threshold NOT met at n=6 → aggregate null + warning", () => {
    const result = aggregatePersonaResults(makeSurvivors(6));
    expect(result.aggregate).toBeNull();
    expect(result.warnings[0]).toMatch(/^wave_3_below_threshold \(6\/7\)/);
  });

  it("Test 4: D-13 zero survivors → aggregate null + warning", () => {
    const result = aggregatePersonaResults([]);
    expect(result.aggregate).toBeNull();
    expect(result.warnings[0]).toMatch(/^wave_3_below_threshold \(0\/7\)/);
  });

  it("Test 5: D-06 completion_pct = flat mean of watch_through_pct", () => {
    const watches = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    const survivors = makeSurvivors(10, (i) => ({
      watch_through_pct: watches[i]!,
    }));
    const result = aggregatePersonaResults(survivors);
    expect(result.aggregate!.completion_pct).toBe(55);
  });

  it("Test 6: D-06 share_pct top-3-weighted (3 enthusiasts at 90, 7 lukewarm at 10) → 58", () => {
    const survivors = makeSurvivors(10, (i) => ({
      share_intent: i < 3 ? 90 : 10,
    }));
    const result = aggregatePersonaResults(survivors);
    expect(result.aggregate!.share_pct).toBeCloseTo(58, 1);
  });

  it("Test 7: D-06 contrast — top-3 weighting is NOT flat mean", () => {
    const survivors = makeSurvivors(10, (i) => ({
      share_intent: i < 3 ? 90 : 10,
    }));
    const result = aggregatePersonaResults(survivors);
    // flat mean would be (90*3 + 10*7)/10 = 34. Top-3-weighted is 58.
    expect(result.aggregate!.share_pct).not.toBeCloseTo(34, 1);
  });

  it("Test 8: D-06 tie-break — all 10 personas share_intent=50 → deterministic across runs", () => {
    const survivors = makeSurvivors(10, () => ({ share_intent: 50 }));
    const a = aggregatePersonaResults(survivors);
    const b = aggregatePersonaResults(survivors);
    expect(a.aggregate!.share_pct).toBe(b.aggregate!.share_pct);
  });

  it("Test 9: Pitfall 4 — n=3 with threshold=3 → topMean returned directly (no 60% shrinkage)", () => {
    const survivors = makeSurvivors(3, () => ({ share_intent: 80 }));
    const result = aggregatePersonaResults(survivors, 3);
    // remaining.length === 0 path → topMean (80) NOT 0.60 * 80 = 48
    expect(result.aggregate!.share_pct).toBe(80);
  });

  it("Test 10: D-06 comment_pct + save_pct apply same top-3-weighted rule", () => {
    const survivors = makeSurvivors(10, (i) => ({
      comment_intent: i < 3 ? 90 : 10,
      save_intent: i < 3 ? 90 : 10,
    }));
    const result = aggregatePersonaResults(survivors);
    expect(result.aggregate!.comment_pct).toBeCloseTo(58, 1);
    expect(result.aggregate!.save_pct).toBeCloseTo(58, 1);
  });

  it("Test 11: constants — TOP_WEIGHT_TOTAL + REMAINING_WEIGHT_TOTAL sum to 1.0", () => {
    expect(TOP_WEIGHT_TOTAL + REMAINING_WEIGHT_TOTAL).toBeCloseTo(1.0, 6);
  });
});
