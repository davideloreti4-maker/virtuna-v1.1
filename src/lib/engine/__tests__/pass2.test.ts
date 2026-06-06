/**
 * Phase 4 Plan 05 — Pass 2 pure-helpers test (LLM orchestration deleted).
 *
 * The runWave3Pass2 orchestrator and its 15 tests have been removed.
 * Only the pure helper applyPass1DropFallback is retained in pass2.ts and tested here.
 *
 * 3 tests:
 *   1 — all-false swipe_predicted → inserts drop from Pass 1 scroll_past_second
 *   2 — any swipe_predicted=true → returns reactions unchanged
 *   3 — no usable Pass 1 drop signal (scroll_past_second=0, watch_through=100%) → unchanged
 */
import { describe, it, expect } from "vitest";
import { applyPass1DropFallback } from "../wave3/pass2";
import type { PersonaSimulationResult } from "../types";

function makeSegments(count = 5) {
  return Array.from({ length: count }, (_, i) => ({
    idx: i,
    t_start: i * 2,
    t_end: (i + 1) * 2,
    visual_event: `event_${i}`,
    audio_event: `audio_${i}`,
    is_hook_zone: i === 0,
  }));
}

function makeReactions(count = 5, swipeFn?: (i: number) => boolean) {
  return Array.from({ length: count }, (_, i) => ({
    t_start: i * 2,
    t_end: (i + 1) * 2,
    attention: 0.75,
    reason: undefined,
    swipe_predicted: swipeFn ? swipeFn(i) : false,
  }));
}

function makePass1(overrides?: Partial<PersonaSimulationResult>): PersonaSimulationResult {
  return {
    persona_id: "fyp-0-high_engager-beauty",
    archetype: "high_engager",
    slot_type: "fyp",
    niche: "beauty",
    scroll_past_second: 4,
    watch_through_pct: 50,
    comment_intent: 20,
    share_intent: 30,
    save_intent: 40,
    rewatch_intent: 25,
    reasoning: "test",
    ...overrides,
  };
}

describe("applyPass1DropFallback — pure helper", () => {
  it("all-false swipe_predicted → inserts drop at Pass 1 scroll_past_second", () => {
    const reactions = makeReactions(5, () => false);
    const pass1 = makePass1({ scroll_past_second: 4 });
    const segments = makeSegments(5); // t=[0-2,2-4,4-6,6-8,8-10]
    const result = applyPass1DropFallback(reactions, pass1, segments);
    // scroll_past_second=4 falls in segment index 2 (t_start=4, t_end=6)
    expect(result[2]!.swipe_predicted).toBe(true);
    expect(result[3]!.swipe_predicted).toBe(true);
    expect(result[4]!.swipe_predicted).toBe(true);
    // segments before drop unchanged
    expect(result[0]!.swipe_predicted).toBe(false);
    expect(result[1]!.swipe_predicted).toBe(false);
  });

  it("any swipe_predicted=true → returns reactions unchanged", () => {
    const reactions = makeReactions(5, (i) => i === 3);
    const pass1 = makePass1({ scroll_past_second: 2 });
    const segments = makeSegments(5);
    const result = applyPass1DropFallback(reactions, pass1, segments);
    // already has a drop — must be returned as-is
    expect(result).toStrictEqual(reactions);
  });

  it("no usable drop signal (scroll_past_second=0, watch_through_pct=100) → unchanged", () => {
    const reactions = makeReactions(5, () => false);
    const pass1 = makePass1({ scroll_past_second: 0, watch_through_pct: 100 });
    const segments = makeSegments(5);
    const result = applyPass1DropFallback(reactions, pass1, segments);
    // totalDuration=10, dropT=10*1.0=10 ≥ totalDuration*0.98=9.8 → genuine full-watch
    expect(result.every((r) => !r.swipe_predicted)).toBe(true);
  });
});
