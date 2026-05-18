/**
 * Phase 5 Plan 01 Task 2 — type widening + cost shim + stripFences export.
 *
 * Verifies:
 *   • GeminiVideoResponseSchema widens with hook_decomposition + cta_segment (optional + nullable)
 *   • makeGeminiAnalysis() factory continues to typecheck unmodified (Pitfall #10)
 *   • SignalAvailability gains 3 new REQUIRED keys: gemini_hook / gemini_body / gemini_cta
 *   • calculateCost("gemini-3.1-pro-preview", ...) routes through per-model helper
 *   • stripFences + CalibrationData are exported from gemini.ts
 *
 * No live Gemini calls.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// =====================================================
// Imports — SUT
// =====================================================

import {
  GeminiVideoResponseSchema,
  type GeminiVideoAnalysis,
  type SignalAvailability,
  type HookDecomposition,
  type CtaSegmentResult,
  type BodySegmentResult,
} from "../types";
import { stripFences, type CalibrationData } from "../gemini";
import { calculateCost } from "../gemini/cost";
import { makeGeminiAnalysis } from "./factories";

// =====================================================
// Tests
// =====================================================

describe("Phase 5 Task 2 — type widening", () => {
  it("Test 1: makeGeminiAnalysis() still typechecks and returns a value satisfying GeminiAnalysis", () => {
    const value = makeGeminiAnalysis();
    expect(value.factors.length).toBe(5);
    expect(value.overall_impression).toBeDefined();
    expect(value.content_summary).toBeDefined();
    // hook_decomposition / cta_segment are optional+nullable — absent from factory output
    expect((value as Partial<GeminiVideoAnalysis>).hook_decomposition).toBeUndefined();
    expect((value as Partial<GeminiVideoAnalysis>).cta_segment).toBeUndefined();
  });

  it("Test 2: GeminiVideoResponseSchema parses a value WITHOUT hook_decomposition / cta_segment (optional + nullable)", () => {
    const legacy = {
      factors: makeGeminiAnalysis().factors,
      overall_impression: "ok",
      content_summary: "ok",
      video_signals: {
        visual_production_quality: 7,
        hook_visual_impact: 8,
        pacing_score: 6,
        transition_quality: 7,
      },
    };
    const result = GeminiVideoResponseSchema.safeParse(legacy);
    expect(result.success).toBe(true);
  });

  it("Test 3: GeminiVideoResponseSchema parses a value WITH full hook_decomposition + presence-aware cta_segment", () => {
    const widened = {
      factors: makeGeminiAnalysis().factors,
      overall_impression: "ok",
      content_summary: "ok",
      video_signals: {
        visual_production_quality: 7,
        hook_visual_impact: 8,
        pacing_score: 6,
        transition_quality: 7,
      },
      hook_decomposition: {
        visual_stop_power: 8.0,
        audio_hook_quality: 6.5,
        text_overlay_score: 7.0,
        first_words_speech_score: 7.5,
        weakest_modality: "audio_hook_quality" as const,
        visual_audio_coherence: 7.0,
        cognitive_load: 4.5,
      },
      cta_segment: {
        cta_present: true,
        strength: 7,
        type: "follow" as const,
        rationale: "Creator clearly says follow.",
      },
    };
    const result = GeminiVideoResponseSchema.safeParse(widened);
    expect(result.success).toBe(true);
    if (result.success) {
      // Use type narrowing — these fields are now optional+nullable on the inferred type.
      expect(result.data.hook_decomposition?.weakest_modality).toBe("audio_hook_quality");
      expect(result.data.cta_segment?.cta_present).toBe(true);
    }
  });
});

describe("Phase 5 Task 2 — SignalAvailability widening", () => {
  it("Test 4: SignalAvailability literal with 10 keys typechecks", () => {
    const availability: SignalAvailability = {
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: true,
      gemini_body: false,
      gemini_cta: true,
    };
    // All 10 keys present at runtime (TS would have errored if a required key were missing).
    expect(Object.keys(availability).sort()).toEqual([
      "behavioral",
      "content_type",
      "gemini",
      "gemini_body",
      "gemini_cta",
      "gemini_hook",
      "ml",
      "niche",
      "rules",
      "trends",
    ]);
  });
});

describe("Phase 5 Task 2 — per-model cost", () => {
  it("Test 5: calculateCost('gemini-3.1-pro-preview', 1290/800) ~= 1.218¢", () => {
    const cost = calculateCost("gemini-3.1-pro-preview", {
      promptTokenCount: 1290,
      candidatesTokenCount: 800,
    });
    expect(cost).toBeCloseTo(1.218, 2);
  });

  // Test 6 — existing cost-calculation.test.ts must still pass (verified separately by running it).
});

describe("Phase 5 Task 2 — exports", () => {
  it("Test 7: stripFences('```json\\n{\"x\":1}\\n```') returns '{\"x\":1}' AND is exported", () => {
    const out = stripFences("```json\n{\"x\":1}\n```");
    expect(out).toBe('{"x":1}');
  });

  it("Test 8: CalibrationData type import is reachable", () => {
    // Type-only smoke — the import at the top of this file is the assertion.
    const stub: CalibrationData = {
      primary_kpis: {
        share_rate: { viral_threshold: 0.1 },
        weighted_engagement_score: { percentiles: { p90: 85 } },
      },
      duration_analysis: {
        sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 45] },
      },
      viral_vs_average: { differentiators: [] },
    };
    expect(stub).toBeDefined();
  });
});

// =====================================================
// Type-only smoke — segment types re-exported from types.ts
// =====================================================

describe("Phase 5 Task 2 — type re-exports from types.ts", () => {
  it("HookDecomposition / CtaSegmentResult / BodySegmentResult are reachable via types.ts", () => {
    const _hd: HookDecomposition = {
      visual_stop_power: 1,
      audio_hook_quality: 1,
      text_overlay_score: 1,
      first_words_speech_score: 1,
      weakest_modality: "visual_stop_power",
      visual_audio_coherence: 1,
      cognitive_load: 1,
    };
    const _cta: CtaSegmentResult = {
      cta_present: false,
      strength: null,
      type: null,
      rationale: "none",
    };
    const _body: BodySegmentResult = {
      video_signals: { visual_production_quality: 1, pacing_score: 1, transition_quality: 1 },
      body_summary: "summary",
    };
    expect(_hd).toBeDefined();
    expect(_cta).toBeDefined();
    expect(_body).toBeDefined();
  });
});
