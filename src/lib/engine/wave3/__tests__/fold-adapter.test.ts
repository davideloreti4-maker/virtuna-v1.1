import { describe, it, expect } from "vitest";
import { adaptFoldToPersonaSimResults, adaptFoldToPass2Results } from "../fold";
import { aggregatePersonaResults } from "../aggregator";
import { buildWeightedCurve } from "../weighted-aggregator";
import type { FoldResponse } from "../fold-prompts";

// ---------------------------------------------------------------------------
// Shared fixture
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

const SLOT_TYPES = ["fyp", "niche", "loyalist", "cross_niche"] as const;

// t_start/t_end dropped from the fold output (2026-06-05) — adapter re-attaches them
// from the segment grid by index. Args kept for call-site readability (which segment).
function makeSegmentReaction(_t_start: number, _t_end: number, attention = 0.8) {
  return { attention, swipe_predicted: false };
}

/** Segment grid matching the 3 reactions in makeFoldResponse (timing source for the adapter). */
function makeSegments() {
  return [
    { t_start: 0, t_end: 5, is_hook_zone: true, visual_event: "" },
    { t_start: 5, t_end: 10, is_hook_zone: false, visual_event: "" },
    { t_start: 10, t_end: 15, is_hook_zone: false, visual_event: "" },
  ];
}

function makeFoldResponse(): FoldResponse {
  return {
    personas: ARCHETYPES.map((archetype, i) => ({
      archetype,
      persona_id: `${archetype}_01`,
      watch_through_pct: 80 - i * 2,
      share_intent: 60,
      comment_intent: 40,
      save_intent: 30,
      rewatch_intent: 20,
      scroll_past_second: 0,
      segment_reactions: [
        makeSegmentReaction(0, 5, 0.9 - i * 0.05),
        makeSegmentReaction(5, 10, 0.7 - i * 0.04),
        makeSegmentReaction(10, 15, 0.5 - i * 0.03),
      ],
    })),
  };
}

/** Minimal PersonaSlot array for the 10 archetypes — slot_type cycles through valid values */
function makeSlots() {
  return ARCHETYPES.map((archetype, i) => ({
    archetype,
    persona_id: `${archetype}_01`,
    slot_type: SLOT_TYPES[i % SLOT_TYPES.length],
    weight: 1 / ARCHETYPES.length,
  }));
}

// ---------------------------------------------------------------------------
// Tests — D-11/D-12 lossless mapping proof
// ---------------------------------------------------------------------------

describe("fold output adapter", () => {
  it("adaptFoldToPersonaSimResults produces PersonaSimulationResult[] aggregatePersonaResults accepts", () => {
    const fold = makeFoldResponse();
    const slots = makeSlots();
    const personaSimResults = adaptFoldToPersonaSimResults(fold, slots);
    // aggregatePersonaResults should not throw
    expect(() => aggregatePersonaResults(personaSimResults)).not.toThrow();
  });

  it("adaptFoldToPass2Results produces Pass2PersonaResult[] buildWeightedCurve accepts", () => {
    const fold = makeFoldResponse();
    const slots = makeSlots();
    const segments = makeSegments();
    const pass2Results = adaptFoldToPass2Results(fold, slots, segments);
    // adapter re-attaches timing from the grid → reactions carry segment t_start/t_end
    expect(pass2Results[0]!.segment_reactions[0]!.t_start).toBe(0);
    expect(pass2Results[0]!.segment_reactions[1]!.t_end).toBe(10);
    const weights = { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 };
    // buildWeightedCurve should not throw
    expect(() => buildWeightedCurve(pass2Results, segments, weights)).not.toThrow();
  });

  it("slot_type niche_deep→niche map applied correctly (Pitfall 5)", () => {
    // Inject a persona with slot_type niche_deep — the adapter must normalise it to "niche"
    const fold = makeFoldResponse();
    const slots = makeSlots();
    // Override one slot to niche_deep (invalid in the 4-value union)
    const slotsWithNicheDeep = slots.map((s, i) =>
      i === 0 ? { ...s, slot_type: "niche_deep" as never } : s,
    );
    const pass2Results = adaptFoldToPass2Results(fold, slotsWithNicheDeep, makeSegments());
    const validSlotTypes = ["fyp", "niche", "loyalist", "cross_niche"];
    // Every adapted result must have a valid slot_type — niche_deep must have become "niche"
    for (const r of pass2Results) {
      expect(validSlotTypes).toContain(r.slot_type);
    }
    // The specifically overridden persona must map to "niche", never "niche_deep"
    expect(pass2Results[0].slot_type).toBe("niche");
  });
});
