import { describe, it, expect } from "vitest";
import { applyPass1DropFallback } from "../pass2";
import type { PersonaSimulationResult, SegmentGrid } from "../../types";

// 5 segments × 6s = 30s timeline.
const segments = [
  { t_start: 0, t_end: 6 },
  { t_start: 6, t_end: 12 },
  { t_start: 12, t_end: 18 },
  { t_start: 18, t_end: 24 },
  { t_start: 24, t_end: 30 },
] as unknown as SegmentGrid[];

function reactions(swipes: boolean[] = [false, false, false, false, false]) {
  return swipes.map((swipe, i) => ({
    t_start: i * 6,
    t_end: (i + 1) * 6,
    attention: 0.8,
    swipe_predicted: swipe,
  }));
}

function pass1(over: Partial<PersonaSimulationResult>): PersonaSimulationResult {
  return { scroll_past_second: 0, watch_through_pct: 100, ...over } as PersonaSimulationResult;
}

describe("applyPass1DropFallback", () => {
  it("leaves a model-emitted swipe timeline untouched", () => {
    const r = reactions([false, false, true, true, true]);
    const out = applyPass1DropFallback(r, pass1({ scroll_past_second: 4 }), segments);
    expect(out).toBe(r); // same reference — no fallback applied
  });

  it("derives the drop from scroll_past_second when no swipe was emitted", () => {
    // 13s → segment index 2 (12–18s)
    const out = applyPass1DropFallback(
      reactions(),
      pass1({ scroll_past_second: 13, watch_through_pct: 43 }),
      segments,
    );
    expect(out.map((r) => r.swipe_predicted)).toEqual([false, false, true, true, true]);
  });

  it("falls back to watch_through_pct when scroll_past_second is 0", () => {
    // 40% of 30s = 12s → segment index 2 (12–18s, inclusive start)
    const out = applyPass1DropFallback(
      reactions(),
      pass1({ scroll_past_second: 0, watch_through_pct: 40 }),
      segments,
    );
    expect(out.map((r) => r.swipe_predicted)).toEqual([false, false, true, true, true]);
  });

  it("leaves genuine full-watch personas with no drop", () => {
    const out = applyPass1DropFallback(
      reactions(),
      pass1({ scroll_past_second: 0, watch_through_pct: 99 }),
      segments,
    );
    expect(out.every((r) => !r.swipe_predicted)).toBe(true);
  });

  it("marks an early drop when the persona bails in the hook", () => {
    // 3s → segment index 0 (0–6s)
    const out = applyPass1DropFallback(
      reactions(),
      pass1({ scroll_past_second: 3, watch_through_pct: 10 }),
      segments,
    );
    expect(out.map((r) => r.swipe_predicted)).toEqual([true, true, true, true, true]);
  });
});
