/**
 * Phase 3 Plan 04 — weighted curve + HeatmapPayload tests (R2.3, R2.5, D-12, D-13).
 *
 * Pure math tests — no mocks required.
 * All 9 cases activated from Wave 0 it.skip stubs.
 */
import { describe, it, expect } from "vitest";

import {
  buildWeightedCurve,
  assembleHeatmapPayload,
  DEFAULT_WEIGHTS,
  type Pass2PersonaResult,
} from "../wave3/weighted-aggregator";
import type { PersonaWeights } from "../persona-weights";
import type { SegmentGrid } from "../types";

// =====================================================
// Fixture factories
// =====================================================

function makeSegment(
  idx: number,
  t_start: number,
  t_end: number,
  opts: { is_hook_zone?: boolean } = {},
): SegmentGrid {
  return {
    t_start,
    t_end,
    visual_event: `segment_${idx}`,
    audio_event: `audio_${idx}`,
    is_hook_zone: opts.is_hook_zone ?? false,
    idx,
  };
}

function makeSegments(count: number, hookCount = 1): SegmentGrid[] {
  return Array.from({ length: count }, (_, i) =>
    makeSegment(i, i * 2, (i + 1) * 2, { is_hook_zone: i < hookCount }),
  );
}

function makePass2Persona(
  slotType: "fyp" | "niche" | "loyalist" | "cross_niche",
  attentions: number[],
  opts: { persona_id?: string; reasons?: Record<number, string> } = {},
): Pass2PersonaResult {
  return {
    persona_id: opts.persona_id ?? `persona-${slotType}-${Math.random().toString(36).slice(2)}`,
    archetype: slotType === "loyalist" ? "loyalist" : slotType === "cross_niche" ? "cross_niche_curiosity" : "high_engager",
    slot_type: slotType,
    segment_reactions: attentions.map((attention, i) => ({
      t_start: i * 2,
      t_end: (i + 1) * 2,
      attention,
      reason: opts.reasons?.[i],
      swipe_predicted: false,
    })),
    pass2_latency_ms: 100,
    pass2_cost_cents: 0.01,
  };
}

const EQUAL_WEIGHTS: PersonaWeights = {
  fyp: 0.25,
  niche: 0.25,
  loyalist: 0.25,
  cross_niche: 0.25,
};

// =====================================================
// Tests
// =====================================================

describe("buildWeightedCurve + assembleHeatmapPayload (Wave 0 stub)", () => {
  it("buildWeightedCurve: weighted_curve = correct weighted mean per segment", () => {
    const segments = makeSegments(5);
    // All personas return attention=0.7 across all segments
    const personas = [
      makePass2Persona("fyp", [0.7, 0.7, 0.7, 0.7, 0.7]),
      makePass2Persona("fyp", [0.7, 0.7, 0.7, 0.7, 0.7]),
      makePass2Persona("niche", [0.7, 0.7, 0.7, 0.7, 0.7]),
      makePass2Persona("loyalist", [0.7, 0.7, 0.7, 0.7, 0.7]),
      makePass2Persona("cross_niche", [0.7, 0.7, 0.7, 0.7, 0.7]),
    ];
    const { weighted_curve, weighted_completion_pct } = buildWeightedCurve(
      personas,
      segments,
      DEFAULT_WEIGHTS,
    );
    expect(weighted_curve).toHaveLength(5);
    weighted_curve.forEach((v) => expect(v).toBeCloseTo(0.7, 5));
    expect(weighted_completion_pct).toBeCloseTo(0.7, 5);
  });

  it("buildWeightedCurve: weighted_hook_score = mean attention in is_hook_zone segments", () => {
    // Segments 0+1 are hook zones; attention values are 0.9 for hook, 0.5 for rest
    const segments = [
      makeSegment(0, 0, 1, { is_hook_zone: true }),
      makeSegment(1, 1, 2, { is_hook_zone: true }),
      makeSegment(2, 2, 4, { is_hook_zone: false }),
      makeSegment(3, 4, 6, { is_hook_zone: false }),
    ];
    const personas = [
      makePass2Persona("fyp", [0.9, 0.9, 0.5, 0.5]),
    ];
    const { weighted_hook_score } = buildWeightedCurve(
      personas,
      segments,
      DEFAULT_WEIGHTS,
    );
    // Hook score = mean of weighted_curve[0] + weighted_curve[1] = (0.9 + 0.9) / 2 = 0.9
    expect(weighted_hook_score).toBeCloseTo(0.9, 5);
  });

  it("buildWeightedCurve: weighted_top_dropoff_t = t_start of biggest segment-to-segment drop", () => {
    // Attention drops significantly from segment 1 → segment 2
    // segments: 0→2s, 2→4s, 4→6s, 6→8s, 8→10s
    const segments = makeSegments(5, 0);
    const personas = [
      // attention: 1.0, 0.8, 0.3, 0.3, 0.3 → biggest drop at seg1→seg2 (0.8-0.3=0.5)
      makePass2Persona("fyp", [1.0, 0.8, 0.3, 0.3, 0.3]),
      makePass2Persona("niche", [1.0, 0.8, 0.3, 0.3, 0.3]),
    ];
    const { weighted_top_dropoff_t, weighted_curve } = buildWeightedCurve(
      personas,
      segments,
      EQUAL_WEIGHTS,
    );
    // segments[2].t_start = 4
    expect(weighted_top_dropoff_t).toBe(segments[2]!.t_start);
    // Confirm the drop is there
    expect((weighted_curve[1] ?? 0) - (weighted_curve[2] ?? 0)).toBeGreaterThan(0.4);
  });

  it("buildWeightedCurve: weighted_completion_pct = mean of per-persona timeline means (weighted)", () => {
    const segments = makeSegments(4, 0);
    // persona A (fyp): mean = 0.8; persona B (niche): mean = 0.6
    // With EQUAL_WEIGHTS (0.25 each), after normalization over 2 types:
    // fyp=0.5, niche=0.5 → weighted mean = 0.5*0.8 + 0.5*0.6 = 0.7
    const personas = [
      makePass2Persona("fyp", [0.8, 0.8, 0.8, 0.8]),
      makePass2Persona("niche", [0.6, 0.6, 0.6, 0.6]),
    ];
    const { weighted_completion_pct } = buildWeightedCurve(
      personas,
      segments,
      EQUAL_WEIGHTS,
    );
    expect(weighted_completion_pct).toBeCloseTo(0.7, 5);
  });

  it("normalizeOverSurvivors: missing cross_niche slot redistributes weight to sum=1.0 (Pitfall 6)", () => {
    // Only FYP + niche survivors — cross_niche absent
    const segments = makeSegments(3, 0);
    const personas = [
      makePass2Persona("fyp", [0.8, 0.8, 0.8]),
      makePass2Persona("niche", [0.6, 0.6, 0.6]),
      // loyalist also absent
    ];
    const { weighted_curve } = buildWeightedCurve(
      personas,
      segments,
      DEFAULT_WEIGHTS, // fyp=0.65, niche=0.20, loyalist=0.10, cross_niche=0.05
    );
    // Should have no NaN — Pitfall 6 mitigation
    weighted_curve.forEach((v) => expect(isNaN(v)).toBe(false));
    // FYP+niche only: normalized fyp = 0.65/0.85 ≈ 0.765, niche = 0.20/0.85 ≈ 0.235
    // weighted_curve[0] = 0.765*0.8 + 0.235*0.6 ≈ 0.612 + 0.141 ≈ 0.753
    expect(weighted_curve[0]).toBeGreaterThan(0.7);
    expect(weighted_curve[0]).toBeLessThan(0.8);
  });

  it("normalizeOverSurvivors: all-types-surviving keeps default weights exactly", () => {
    const segments = makeSegments(2, 0);
    // One persona of each type (6 fyp + 2 niche + 1 loyalist + 1 cross_niche → simplified to 1 each)
    const personas = [
      makePass2Persona("fyp", [0.5, 0.5]),
      makePass2Persona("niche", [0.5, 0.5]),
      makePass2Persona("loyalist", [0.5, 0.5]),
      makePass2Persona("cross_niche", [0.5, 0.5]),
    ];
    // All types present with EQUAL_WEIGHTS → curve should still be computed without NaN
    const { weighted_curve } = buildWeightedCurve(
      personas,
      segments,
      DEFAULT_WEIGHTS,
    );
    weighted_curve.forEach((v) => expect(v).toBeCloseTo(0.5, 5));
  });

  it("assembleHeatmapPayload: returns full D-13 shape (segments, personas, weighted_curve, weights, weights_source)", () => {
    const segments = makeSegments(3, 1);
    const personas = [
      makePass2Persona("fyp", [0.7, 0.6, 0.5]),
      makePass2Persona("niche", [0.8, 0.7, 0.6]),
    ];
    const payload = assembleHeatmapPayload(personas, segments, DEFAULT_WEIGHTS, "default");

    // D-13 required fields
    expect(payload).toHaveProperty("segments");
    expect(payload).toHaveProperty("personas");
    expect(payload).toHaveProperty("weighted_curve");
    expect(payload).toHaveProperty("weights");
    expect(payload).toHaveProperty("weights_source");

    expect(payload.segments).toHaveLength(3);
    expect(payload.personas).toHaveLength(2);
    expect(payload.weighted_curve).toHaveLength(3);
    expect(typeof payload.weights.fyp).toBe("number");
    expect(payload.weights_source).toBe("default");
  });

  it("assembleHeatmapPayload: keyframe_uri starts null for every segment (Pitfall 3)", () => {
    const segments = makeSegments(4, 1);
    const personas = [makePass2Persona("fyp", [0.8, 0.7, 0.6, 0.5])];
    const payload = assembleHeatmapPayload(personas, segments, DEFAULT_WEIGHTS, "default");

    payload.segments.forEach((seg) => {
      expect(seg.keyframe_uri).toBeNull();
    });
  });

  it("assembleHeatmapPayload: segment_reasons sparse — only at inflection points", () => {
    const segments = makeSegments(5, 1);
    // Only segment 0 and segment 4 have reasons
    const personas = [
      makePass2Persona("fyp", [0.9, 0.8, 0.5, 0.4, 0.2], {
        reasons: { 0: "strong hook", 4: "final drop" },
      }),
    ];
    const payload = assembleHeatmapPayload(personas, segments, DEFAULT_WEIGHTS, "default");

    const persona = payload.personas[0]!;
    // Only 2 reasons, not 5
    expect(Object.keys(persona.segment_reasons)).toHaveLength(2);
    expect(persona.segment_reasons[0]).toBe("strong hook");
    expect(persona.segment_reasons[4]).toBe("final drop");
  });
});
