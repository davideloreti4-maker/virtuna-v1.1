import { describe, it, expect } from "vitest";
import { computeAvgCurveRange, checkDiversityGuard, DIVERSITY_FLOOR } from "../fold";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const ARCHETYPES = [
  "high_engager",
  "saver",
  "skeptic",
  "loyalist",
  "casual_scroller",
  "niche_expert",
  "tough_crowd",
  "trend_chaser",
  "educator_seeker",
  "cross_niche_curious",
] as const;

type FoldPersonaStub = {
  archetype: (typeof ARCHETYPES)[number];
  persona_id: string;
  watch_through_pct: number;
  share_intent: number;
  comment_intent: number;
  save_intent: number;
  rewatch_intent: number;
  scroll_past_second: number;
  segment_reactions: { t_start: number; t_end: number; attention: number; swipe_predicted: boolean }[];
};

function makePersona(archetype: (typeof ARCHETYPES)[number], attentions: number[]): FoldPersonaStub {
  return {
    archetype,
    persona_id: `${archetype}_01`,
    watch_through_pct: 80,
    share_intent: 60,
    comment_intent: 40,
    save_intent: 30,
    rewatch_intent: 20,
    scroll_past_second: 0,
    segment_reactions: attentions.map((attention, i) => ({
      t_start: i * 5,
      t_end: (i + 1) * 5,
      attention,
      swipe_predicted: false,
    })),
  };
}

function make10Personas(attentionFn: (archetypeIndex: number, segmentIndex: number) => number, segCount = 5): FoldPersonaStub[] {
  return ARCHETYPES.map((a, i) =>
    makePersona(a, Array.from({ length: segCount }, (_, s) => attentionFn(i, s))),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fold diversity guard (D-07)", () => {
  it("returns positive avgRange for varied curves (expected pass)", () => {
    // Each persona has a different high/low pattern → non-zero range per persona
    const personas = make10Personas((i, s) => (s % 2 === 0 ? 0.9 - i * 0.05 : 0.3 + i * 0.02));
    const avgRange = computeAvgCurveRange(personas);
    expect(avgRange).toBeGreaterThan(0);
    expect(avgRange).toBeGreaterThanOrEqual(DIVERSITY_FLOOR);
  });

  it("warns but does NOT throw when curves are flat (avgRange < FLOOR)", () => {
    // All personas have constant attention → range = 0 → below any positive FLOOR
    const personas = make10Personas(() => 0.5);
    const avgRange = computeAvgCurveRange(personas);
    expect(avgRange).toBe(0);
    expect(avgRange).toBeLessThan(DIVERSITY_FLOOR);

    // checkDiversityGuard must warn, never throw
    let result: { warn: boolean } | undefined;
    expect(() => {
      result = checkDiversityGuard(avgRange);
    }).not.toThrow();
    expect(result!.warn).toBe(true);
  });

  it("avgRange computation matches measure-pipeline.ts:146-160 formula (per-persona max−min, mean over all 10)", () => {
    // Hand-computed fixture:
    // 5 personas with known ranges, padded to 10 by repeating the last.
    // Attentions (per persona):
    //   p0: [0.9, 0.4]  → range = 0.50
    //   p1: [0.8, 0.6]  → range = 0.20
    //   p2: [1.0, 0.7]  → range = 0.30
    //   p3: [0.5, 0.5]  → range = 0.00
    //   p4: [0.6, 0.2]  → range = 0.40
    //   p5–p9: [0.5, 0.5] → range = 0.00 each
    // sum = 0.50 + 0.20 + 0.30 + 0.00 + 0.40 + 0*5 = 1.40
    // avgRange = 1.40 / 10 = 0.14
    const attentionSets = [
      [0.9, 0.4],
      [0.8, 0.6],
      [1.0, 0.7],
      [0.5, 0.5],
      [0.6, 0.2],
      [0.5, 0.5],
      [0.5, 0.5],
      [0.5, 0.5],
      [0.5, 0.5],
      [0.5, 0.5],
    ];
    const personas = ARCHETYPES.map((a, i) => makePersona(a, attentionSets[i]!));

    // Mirror the measure-pipeline.ts formula:
    const ranges: number[] = [];
    for (const p of personas) {
      const att = p.segment_reactions.map((r) => r.attention);
      if (!att.length) continue;
      const range = +(Math.max(...att) - Math.min(...att)).toFixed(2);
      ranges.push(range);
    }
    const expectedAvgRange = ranges.length
      ? +(ranges.reduce((a, b) => a + b, 0) / ranges.length).toFixed(2)
      : 0;

    const actualAvgRange = computeAvgCurveRange(personas);

    // The function's output must match the hand-computed formula exactly
    expect(actualAvgRange).toBeCloseTo(expectedAvgRange, 5);
    expect(actualAvgRange).toBeCloseTo(0.14, 2);
  });
});
