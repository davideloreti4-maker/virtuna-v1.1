/**
 * Unit tests for the locked Phase 4 content-type weight matrix (D-12) and
 * applyContentTypeWeights pure function.
 *
 * Matrix is LOAD-BEARING — Phase 10 may revise based on Phase 1 corpus evidence,
 * but the values asserted here MUST stay in lock-step with D-12.
 */
import { describe, it, expect } from "vitest";
import {
  CONTENT_TYPE_WEIGHT_MATRIX,
  MULTIPLIER_FLOOR,
  MULTIPLIER_CEILING,
  applyContentTypeWeights,
} from "../wave0/content-type-weights";
import type { GeminiVideoSignals } from "../types";

const baselineSignals: GeminiVideoSignals = {
  visual_production_quality: 5,
  hook_visual_impact: 5,
  pacing_score: 5,
  transition_quality: 5,
};

describe("CONTENT_TYPE_WEIGHT_MATRIX (D-12 locked)", () => {
  it("has exactly 8 rows (talking_head, b_roll, slideshow, action, tutorial, vlog, comedy, other)", () => {
    expect(Object.keys(CONTENT_TYPE_WEIGHT_MATRIX).sort()).toEqual(
      ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "comedy", "other"].sort()
    );
  });

  it("other is passthrough (all four multipliers = 1.0)", () => {
    expect(CONTENT_TYPE_WEIGHT_MATRIX.other).toEqual({
      visual_production_quality: 1.0,
      hook_visual_impact: 1.0,
      pacing_score: 1.0,
      transition_quality: 1.0,
    });
  });

  it("slideshow halves pacing (D-12 rationale: static)", () => {
    expect(CONTENT_TYPE_WEIGHT_MATRIX.slideshow.pacing_score).toBe(0.5);
  });

  it("action up-weights all four signals (D-12 rationale: motion-heavy)", () => {
    const action = CONTENT_TYPE_WEIGHT_MATRIX.action;
    expect(action.visual_production_quality).toBeGreaterThanOrEqual(1.0);
    expect(action.hook_visual_impact).toBeGreaterThanOrEqual(1.0);
    expect(action.pacing_score).toBeGreaterThanOrEqual(1.0);
    expect(action.transition_quality).toBeGreaterThanOrEqual(1.0);
  });
});

describe("applyContentTypeWeights", () => {
  it("applies talking_head multipliers correctly", () => {
    const result = applyContentTypeWeights(baselineSignals, "talking_head");
    expect(result.visual_production_quality).toBeCloseTo(5 * 1.0, 5);
    expect(result.hook_visual_impact).toBeCloseTo(5 * 1.1, 5);
    expect(result.pacing_score).toBeCloseTo(5 * 1.0, 5);
    expect(result.transition_quality).toBeCloseTo(5 * 0.8, 5);
  });

  it("null contentType uses other (passthrough — values unchanged within tolerance)", () => {
    const result = applyContentTypeWeights(baselineSignals, null);
    expect(result).toEqual(baselineSignals);
  });

  it("cap enforcement — signal of 10 × action multiplier 1.3 clamps to 10", () => {
    const result = applyContentTypeWeights(
      { visual_production_quality: 10, hook_visual_impact: 10, pacing_score: 10, transition_quality: 10 },
      "action",
    );
    expect(result.visual_production_quality).toBeLessThanOrEqual(10);
    expect(result.hook_visual_impact).toBeLessThanOrEqual(10);
    expect(result.pacing_score).toBeLessThanOrEqual(10);
    expect(result.transition_quality).toBeLessThanOrEqual(10);
  });

  it("floor enforcement — signal of 0 stays 0 regardless of multiplier", () => {
    const result = applyContentTypeWeights(
      { visual_production_quality: 0, hook_visual_impact: 0, pacing_score: 0, transition_quality: 0 },
      "slideshow",
    );
    expect(result).toEqual({
      visual_production_quality: 0,
      hook_visual_impact: 0,
      pacing_score: 0,
      transition_quality: 0,
    });
  });

  it("does not mutate input object (returns new reference)", () => {
    const input = { ...baselineSignals };
    const originalSnapshot = { ...input };
    const result = applyContentTypeWeights(input, "action");
    expect(input).toEqual(originalSnapshot);
    expect(result).not.toBe(input);
  });

  it("slideshow halves pacing — signal 8 → 4", () => {
    const result = applyContentTypeWeights({ ...baselineSignals, pacing_score: 8 }, "slideshow");
    expect(result.pacing_score).toBe(4);
  });

  it("all 8 enum values have valid multiplier rows", () => {
    const types: Array<keyof typeof CONTENT_TYPE_WEIGHT_MATRIX> =
      ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "comedy", "other"];
    for (const t of types) {
      const result = applyContentTypeWeights(baselineSignals, t);
      expect(result.visual_production_quality).toBeGreaterThanOrEqual(0);
      expect(result.hook_visual_impact).toBeGreaterThanOrEqual(0);
      expect(result.pacing_score).toBeGreaterThanOrEqual(0);
      expect(result.transition_quality).toBeGreaterThanOrEqual(0);
    }
  });

  it("clamp constants — MULTIPLIER_FLOOR=0.5, MULTIPLIER_CEILING=1.5", () => {
    expect(MULTIPLIER_FLOOR).toBe(0.5);
    expect(MULTIPLIER_CEILING).toBe(1.5);
  });
});
