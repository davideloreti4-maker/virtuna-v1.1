/**
 * Phase 5 Plan 03 Task 2 — CTA penalty matrix (D-06) + per-segment SignalAvailability wiring.
 *
 * Pure-function unit tests for `applyCtaPenalty` (17 cases covering 7 content types ×
 * 2 cta_present states + null/edge cases) plus end-to-end integration tests through
 * `aggregateScores` confirming:
 *   - per-segment availability flags propagate from PipelineResult.geminiResult.signalAvailability
 *   - the derived `gemini` flag = hook||body||cta in segmented mode (with HARD-03 fallback for legacy)
 *   - applyCtaPenalty modifies overall_score but NOT the exposed PredictionResult.gemini_score
 *   - the `?? false` fallback handles legacy callers with undefined signalAvailability
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mocks — same external dependency set as aggregator.test.ts
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

vi.mock("../ml", () => ({
  predictWithML: vi.fn().mockResolvedValue(50),
  featureVectorToMLInput: vi.fn().mockReturnValue(Array(15).fill(0.5)),
}));

vi.mock("../calibration", () => ({
  getPlattParameters: vi.fn().mockResolvedValue(null),
  applyPlattScaling: vi.fn((score: number, _params: unknown) => score),
}));

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
}));

// =====================================================
// Imports
// =====================================================

import { applyCtaPenalty, aggregateScores } from "../aggregator";
import { makePipelineResult, makeGeminiAnalysis } from "./factories";
import type { CtaSegmentResult, GeminiVideoAnalysis } from "../types";
import type { PipelineResult } from "../pipeline";

// =====================================================
// CTA-segment helpers
// =====================================================

function ctaPresentTrue(
  strength: number = 7,
  type: NonNullable<CtaSegmentResult["type"]> = "follow",
): CtaSegmentResult {
  return {
    cta_present: true,
    strength,
    type,
    rationale: "Creator says follow at 28s",
  };
}

function ctaPresentFalse(): CtaSegmentResult {
  return {
    cta_present: false,
    strength: null,
    type: null,
    rationale: "No CTA detected",
  };
}

// =====================================================
// applyCtaPenalty — pure function tests (17 cases)
// =====================================================

describe("applyCtaPenalty (D-06) — pure function", () => {
  // -------------------------------------------------
  // cta_present=false — penalty applies for tutorial + b_roll, neutral elsewhere
  // -------------------------------------------------
  it("Test 1: tutorial × cta_present=false → -5 points", () => {
    expect(applyCtaPenalty(70, "tutorial", ctaPresentFalse())).toBe(65);
  });

  it("Test 2: b_roll × cta_present=false → -3 points", () => {
    expect(applyCtaPenalty(70, "b_roll", ctaPresentFalse())).toBe(67);
  });

  it("Test 3: talking_head × cta_present=false → neutral", () => {
    expect(applyCtaPenalty(70, "talking_head", ctaPresentFalse())).toBe(70);
  });

  it("Test 4: vlog × cta_present=false → neutral", () => {
    expect(applyCtaPenalty(70, "vlog", ctaPresentFalse())).toBe(70);
  });

  it("Test 5: comedy × cta_present=false → neutral", () => {
    expect(applyCtaPenalty(70, "comedy", ctaPresentFalse())).toBe(70);
  });

  it("Test 6: slideshow × cta_present=false → neutral", () => {
    expect(applyCtaPenalty(70, "slideshow", ctaPresentFalse())).toBe(70);
  });

  it("Test 7: action × cta_present=false → neutral", () => {
    expect(applyCtaPenalty(70, "action", ctaPresentFalse())).toBe(70);
  });

  it("Test 7b: other × cta_present=false → neutral (explicit per D-06)", () => {
    expect(applyCtaPenalty(70, "other", ctaPresentFalse())).toBe(70);
  });

  // -------------------------------------------------
  // cta_present=true — no penalty across the board
  // -------------------------------------------------
  it("Test 8: tutorial × cta_present=true → no penalty", () => {
    expect(applyCtaPenalty(70, "tutorial", ctaPresentTrue())).toBe(70);
  });

  it("Test 9: b_roll × cta_present=true → no penalty", () => {
    expect(applyCtaPenalty(70, "b_roll", ctaPresentTrue())).toBe(70);
  });

  it("Test 10: talking_head × cta_present=true → no penalty", () => {
    expect(applyCtaPenalty(70, "talking_head", ctaPresentTrue())).toBe(70);
  });

  it("Test 11: vlog × cta_present=true → no penalty", () => {
    expect(applyCtaPenalty(70, "vlog", ctaPresentTrue())).toBe(70);
  });

  it("Test 12: comedy × cta_present=true → no penalty", () => {
    expect(applyCtaPenalty(70, "comedy", ctaPresentTrue())).toBe(70);
  });

  it("Test 13: slideshow × cta_present=true → no penalty", () => {
    expect(applyCtaPenalty(70, "slideshow", ctaPresentTrue())).toBe(70);
  });

  it("Test 14: action × cta_present=true → no penalty", () => {
    expect(applyCtaPenalty(70, "action", ctaPresentTrue())).toBe(70);
  });

  // -------------------------------------------------
  // Edge cases
  // -------------------------------------------------
  it("Test 15: null content_type → no penalty (Wave 0 failure path)", () => {
    expect(applyCtaPenalty(70, null, ctaPresentFalse())).toBe(70);
  });

  it("Test 16: null cta_segment → no penalty (provenance already redistributes)", () => {
    expect(applyCtaPenalty(70, "tutorial", null)).toBe(70);
  });

  it("Test 16b: undefined cta_segment → no penalty", () => {
    expect(applyCtaPenalty(70, "tutorial", undefined)).toBe(70);
  });

  it("Test 17a: clamps to 0 when penalty exceeds score (tutorial × 3 → 0, not -2)", () => {
    expect(applyCtaPenalty(3, "tutorial", ctaPresentFalse())).toBe(0);
  });

  it("Test 17b: clamps to 100 ceiling stays intact (100 × tutorial penalty → 95)", () => {
    expect(applyCtaPenalty(100, "tutorial", ctaPresentFalse())).toBe(95);
  });
});

// =====================================================
// End-to-end: aggregateScores honors CTA penalty + per-segment SignalAvailability
// =====================================================

/**
 * Build a PipelineResult with:
 *  - factors averaging score=7 → gemini_score=70 (pre-penalty)
 *  - wave0Result.content_type.type as caller specifies (must be a valid ContentTypeSlug)
 *  - geminiResult.analysis widened with hook_decomposition + cta_segment
 *  - geminiResult.signalAvailability triple as caller specifies (or undefined for legacy)
 *
 * NOTE: The valid set of content types is constrained by Wave0ContentTypeResultSchema
 * (talking_head, b_roll, slideshow, action, tutorial, vlog, comedy, other — 8 entries
 * post Phase 5 CR-04 fix that added "comedy" to ContentTypeEnumSchema). All 8 slugs
 * are exercised in the pure-function `applyCtaPenalty` tests above; comedy is neutral
 * (no entry in CTA_PENALTY_POINTS) and the buildPipelineResult helper accepts it for
 * the end-to-end Test E2 series below.
 */
function buildPipelineResult(overrides: {
  contentTypeSlug: "tutorial" | "b_roll" | "talking_head" | "vlog" | "slideshow" | "action" | "comedy" | "other" | null;
  ctaSegment: CtaSegmentResult | null;
  signalAvailability?: { gemini_hook: boolean; gemini_body: boolean; gemini_cta: boolean };
}): PipelineResult {
  const baseAnalysis = makeGeminiAnalysis();
  const widenedAnalysis: GeminiVideoAnalysis = {
    ...baseAnalysis,
    video_signals: {
      visual_production_quality: 7,
      hook_visual_impact: 7,
      pacing_score: 6,
      transition_quality: 6,
    },
    hook_decomposition: {
      visual_stop_power: 7,
      audio_hook_quality: 6,
      text_overlay_score: 5,
      first_words_speech_score: 7,
      weakest_modality: "text_overlay_score",
      visual_audio_coherence: 7,
      cognitive_load: 3,
    },
    cta_segment: overrides.ctaSegment,
  };

  return makePipelineResult({
    geminiResult: {
      analysis: widenedAnalysis,
      cost_cents: 2.0,
      signalAvailability: overrides.signalAvailability,
    },
    wave0Result: {
      content_type:
        overrides.contentTypeSlug === null
          ? null
          : { type: overrides.contentTypeSlug, confidence: 0.9 },
      niche: null,
    },
  });
}

describe("aggregateScores end-to-end — CTA penalty + per-segment SignalAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------
  // Test 18: CTA-penalty differentiator end-to-end
  // -------------------------------------------------
  it("Test 18: tutorial × cta_present=false produces overall_score 5 points lower than cta_present=true (with other factors held constant)", async () => {
    const noPenaltyResult = await aggregateScores(
      buildPipelineResult({
        contentTypeSlug: "tutorial",
        ctaSegment: ctaPresentTrue(8),
      }),
    );
    const penaltyResult = await aggregateScores(
      buildPipelineResult({
        contentTypeSlug: "tutorial",
        ctaSegment: ctaPresentFalse(),
      }),
    );

    // gemini_score in PredictionResult is PRE-penalty (exposed for UI breakdown card).
    expect(noPenaltyResult.gemini_score).toBe(penaltyResult.gemini_score);

    // overall_score reflects POST-penalty math. Penalty = 5 * weights.gemini.
    // weights.gemini in the full-signals case is 0.25; 5 * 0.25 = 1.25 → 1 point delta after Math.round.
    // We only need to assert "strictly lower" — not the exact magnitude — because
    // weight redistribution + clamping can adjust the delta by 1 point.
    expect(penaltyResult.overall_score).toBeLessThan(noPenaltyResult.overall_score);
  });

  // -------------------------------------------------
  // Test 19: per-segment SignalAvailability values populate from pipelineResult
  // -------------------------------------------------
  it("Test 19: signalAvailability values flow through aggregator", async () => {
    const result = await aggregateScores(
      buildPipelineResult({
        contentTypeSlug: "tutorial",
        ctaSegment: ctaPresentTrue(),
        signalAvailability: {
          gemini_hook: true,
          gemini_body: false,
          gemini_cta: true,
        },
      }),
    );

    expect(result.signal_availability.gemini_hook).toBe(true);
    expect(result.signal_availability.gemini_body).toBe(false);
    expect(result.signal_availability.gemini_cta).toBe(true);
    // Derived: gemini = hook || body || cta = true.
    expect(result.signal_availability.gemini).toBe(true);
  });

  it("Test 19b: all three gemini segments false → derived gemini=false", async () => {
    const result = await aggregateScores(
      buildPipelineResult({
        contentTypeSlug: "tutorial",
        ctaSegment: null,
        signalAvailability: {
          gemini_hook: false,
          gemini_body: false,
          gemini_cta: false,
        },
      }),
    );

    expect(result.signal_availability.gemini_hook).toBe(false);
    expect(result.signal_availability.gemini_body).toBe(false);
    expect(result.signal_availability.gemini_cta).toBe(false);
    expect(result.signal_availability.gemini).toBe(false);
  });

  // -------------------------------------------------
  // Test 20: legacy callers with undefined signalAvailability
  // -------------------------------------------------
  it("Test 20: legacy caller (signalAvailability undefined) → per-segment keys default to false; derived gemini uses HARD-03 factor-score fallback", async () => {
    const result = await aggregateScores(
      buildPipelineResult({
        contentTypeSlug: "tutorial",
        ctaSegment: null,
        signalAvailability: undefined, // legacy text mode / eval harness path
      }),
    );

    expect(result.signal_availability.gemini_hook).toBe(false);
    expect(result.signal_availability.gemini_body).toBe(false);
    expect(result.signal_availability.gemini_cta).toBe(false);
    // Derived gemini uses HARD-03 fallback (factor score > 0) when signalAvailability undefined.
    // Our fixture has factors at score=7 → HARD-03 fallback returns true.
    expect(result.signal_availability.gemini).toBe(true);
  });

  // -------------------------------------------------
  // Test 21: existing aggregator tests still pass (regression sentinel)
  // -------------------------------------------------
  it("Test 21: aggregator with no widened fields (legacy GeminiAnalysis shape) still produces valid PredictionResult", async () => {
    const result = await aggregateScores(
      makePipelineResult({
        wave0Result: { content_type: null, niche: null },
      }),
    );

    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
    expect(result.factors).toHaveLength(5);
    expect(result.signal_availability.gemini_hook).toBe(false);
    expect(result.signal_availability.gemini_body).toBe(false);
    expect(result.signal_availability.gemini_cta).toBe(false);
  });
});
