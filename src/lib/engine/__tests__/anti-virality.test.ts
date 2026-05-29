/**
 * Phase 1 (R1.9) — Anti-virality confidence threshold tests.
 *
 * Plan 01-01 shipped placeholders; Plan 01-06 T2 fills assertions with the
 * locked ANTI_VIRALITY_THRESHOLD constant + isAntiViralityGated helper.
 *
 * Plan 03-05 (Phase 3) — adds dual-trigger tests for isTimelinePatternTriggered
 * and isAntiViralityGatedFull (D-17).
 */
import { describe, it, expect } from "vitest";
import {
  ANTI_VIRALITY_THRESHOLD,
  isAntiViralityGated,
  isTimelinePatternTriggered,
  isAntiViralityGatedFull,
} from "@/lib/engine/anti-virality";
import type { HeatmapPayload } from "@/lib/engine/types";

describe("anti-virality threshold", () => {
  it("ANTI_VIRALITY_THRESHOLD is a number in (0, 1)", () => {
    expect(typeof ANTI_VIRALITY_THRESHOLD).toBe("number");
    expect(ANTI_VIRALITY_THRESHOLD).toBeGreaterThan(0);
    expect(ANTI_VIRALITY_THRESHOLD).toBeLessThan(1);
  });

  it("isAntiViralityGated returns true when confidence < threshold", () => {
    expect(isAntiViralityGated(ANTI_VIRALITY_THRESHOLD - 0.01)).toBe(true);
    expect(isAntiViralityGated(0)).toBe(true);
  });

  it("isAntiViralityGated returns false when confidence >= threshold", () => {
    // Equal-to-threshold is NOT gated (strictly less-than gating per contract).
    expect(isAntiViralityGated(ANTI_VIRALITY_THRESHOLD)).toBe(false);
    expect(isAntiViralityGated(ANTI_VIRALITY_THRESHOLD + 0.01)).toBe(false);
    expect(isAntiViralityGated(1)).toBe(false);
  });

  it("isAntiViralityGated handles edge cases (NaN, negative, >1)", () => {
    expect(isAntiViralityGated(NaN)).toBe(false); // NaN comparisons always false
    expect(isAntiViralityGated(-0.5)).toBe(true);
    expect(isAntiViralityGated(2)).toBe(false);
  });

  it("anti-virality.ts source contains provenance JSDoc with PROVENANCE marker", async () => {
    // Verify the rationale block is preserved — humans must be able to find why this number exists.
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/engine/anti-virality.ts", "utf-8");
    expect(src).toMatch(/PROVENANCE/);
    expect(src).toMatch(/calibrate-anti-virality\.ts/);
    expect(src).toMatch(/Last calibrated/);
  });
});

// =====================================================
// Fixture factory for heatmap payloads
// =====================================================

function makeHeatmap(opts: {
  curve: number[];
  personaAttentions: number[][];
  hookCount?: number;
  segmentDuration?: number; // seconds per segment (default: 1s)
}): HeatmapPayload {
  const segDur = opts.segmentDuration ?? 1;
  const segments = opts.curve.map((_, i) => ({
    idx: i,
    t_start: i * segDur,
    t_end: (i + 1) * segDur,
    is_hook_zone: i < (opts.hookCount ?? 3),
    keyframe_uri: null,
  }));
  return {
    segments,
    personas: opts.personaAttentions.map((atts, i) => ({
      id: `p${i}`,
      slot_type: (['fyp', 'fyp', 'fyp', 'fyp', 'fyp', 'fyp', 'niche', 'niche', 'loyalist', 'cross_niche'] as const)[i % 10] as 'fyp' | 'niche' | 'loyalist' | 'cross_niche',
      archetype: 'high_engager',
      attentions: atts,
      swipe_predicted_at: null,
      segment_reasons: {},
    })),
    weighted_curve: opts.curve,
    weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
    weights_source: "default",
  };
}

// 10 personas, 8 of 10 drop >=40% in first 5s segments
// weighted_curve also drops >=40%: 1.0 -> 0.55 (loss=0.45)
const DROP_10 = Array.from({ length: 10 }, (_, i) =>
  i < 8
    ? [1.0, 0.9, 0.7, 0.5, 0.3] // drops 0.7 — well above 40%
    : [1.0, 0.95, 0.9, 0.85, 0.8], // barely drops (only 20%) — below 40%
);
const heatmapWithTimelinePattern = makeHeatmap({
  curve: [1.0, 0.9, 0.7, 0.55, 0.3], // 0.70 loss in first 5 segs
  personaAttentions: DROP_10,
});

// Healthy heatmap — flat curve, no real drop
const heatmapHealthy = makeHeatmap({
  curve: [0.9, 0.88, 0.86, 0.85, 0.84],
  personaAttentions: Array.from({ length: 10 }, () => [0.9, 0.88, 0.86, 0.85, 0.84]),
});

// =====================================================
// isTimelinePatternTriggered (D-17 dual-trigger)
// =====================================================

describe("isTimelinePatternTriggered (D-17 dual-trigger, Phase 3)", () => {
  it("Test 1: returns false for null heatmap (graceful degradation — Pitfall 3)", () => {
    expect(isTimelinePatternTriggered(null)).toBe(false);
  });

  it("Test 2: returns true when attention loss >= 40% in first 5s AND >= 70% persona consensus", () => {
    expect(isTimelinePatternTriggered(heatmapWithTimelinePattern)).toBe(true);
  });

  it("Test 3: returns false when attention loss >= 40% but persona consensus < 70% (only 4/10 drop)", () => {
    // 4/10 personas drop >= 40% — below 70% consensus threshold
    const personaAttentions = Array.from({ length: 10 }, (_, i) =>
      i < 4
        ? [1.0, 0.8, 0.6, 0.4, 0.3] // drops 0.7 — above 40%
        : [1.0, 0.98, 0.96, 0.94, 0.92], // barely drops — below 40%
    );
    const heatmap = makeHeatmap({
      curve: [1.0, 0.8, 0.6, 0.4, 0.3], // aggregate loss = 0.70 >= 40%
      personaAttentions,
    });
    expect(isTimelinePatternTriggered(heatmap)).toBe(false);
  });

  it("Test 4: returns false when persona consensus >= 70% but aggregate loss < 40% (e.g., 30%)", () => {
    // 8/10 personas each drop 30% — consensus >= 70% but aggregate loss < 40%
    const personaAttentions = Array.from({ length: 10 }, (_, i) =>
      i < 8
        ? [1.0, 0.85, 0.75, 0.72, 0.70] // drops 0.30 — below 40%
        : [1.0, 0.98, 0.96, 0.94, 0.92],
    );
    const heatmap = makeHeatmap({
      curve: [1.0, 0.85, 0.75, 0.72, 0.70], // aggregate loss = 0.30 < 40%
      personaAttentions,
    });
    expect(isTimelinePatternTriggered(heatmap)).toBe(false);
  });

  it("Test 5: returns false when first-5s window has <2 segments (insufficient data)", () => {
    // One giant 10s segment — only 1 segment in [0, 5] window
    const heatmap = makeHeatmap({
      curve: [1.0, 0.3], // only 2 segments but each is 10s
      personaAttentions: Array.from({ length: 10 }, () => [1.0, 0.3]),
      segmentDuration: 10,
    });
    // t_end of first segment is 10, t_end of second is 20
    // filter: t_end <= 5 → NO segments qualify → firstFiveSecondIndices.length < 2 → false
    expect(isTimelinePatternTriggered(heatmap)).toBe(false);
  });
});

// =====================================================
// isAntiViralityGatedFull — dual-trigger OR logic
// =====================================================

describe("isAntiViralityGatedFull — dual-trigger OR logic (D-17)", () => {
  it("Test 6: confidence < 0.4 and heatmap null → gated=true, reason='confidence'", () => {
    const result = isAntiViralityGatedFull(0.3, null);
    expect(result.gated).toBe(true);
    expect(result.reason).toBe("confidence");
    expect(result.dropoff_segment_indices).toEqual([]);
  });

  it("Test 7: confidence >= 0.4 and timeline pattern fires → gated=true, reason='timeline_pattern'", () => {
    const result = isAntiViralityGatedFull(0.8, heatmapWithTimelinePattern);
    expect(result.gated).toBe(true);
    expect(result.reason).toBe("timeline_pattern");
    // Should return top-3 worst segment indices
    expect(result.dropoff_segment_indices).toHaveLength(3);
    result.dropoff_segment_indices.forEach(idx => {
      expect(typeof idx).toBe("number");
      expect(idx).toBeGreaterThanOrEqual(0);
    });
  });

  it("Test 8: confidence < 0.4 AND timeline pattern fires → gated=true, reason='both'", () => {
    const result = isAntiViralityGatedFull(0.3, heatmapWithTimelinePattern);
    expect(result.gated).toBe(true);
    expect(result.reason).toBe("both");
    expect(result.dropoff_segment_indices).toHaveLength(3);
  });

  it("Test 9: confidence >= 0.4 and healthy heatmap → gated=false, reason=null", () => {
    const result = isAntiViralityGatedFull(0.8, heatmapHealthy);
    expect(result.gated).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.dropoff_segment_indices).toEqual([]);
  });

  it("Test 10: backward compat — isAntiViralityGated(0.3) still returns true (D-16)", () => {
    expect(isAntiViralityGated(0.3)).toBe(true);
  });

  it("Test 11: backward compat — isAntiViralityGated(0.5) returns false (above threshold)", () => {
    expect(isAntiViralityGated(0.5)).toBe(false);
  });
});
