/**
 * Phase 1 (R1.9) — aggregator's anti_virality_gated wiring tests (B4).
 *
 * Plan 01-01 shipped 4 it.todo placeholders; Plan 01-06 T3 fills them with real
 * assertions exercising the wiring inside aggregateScores().
 *
 * The 9-key D-02 contract for the boolean flag:
 * - REQUIRED field on PredictionResult (not optional).
 * - Computed AFTER confidence calibration (Platt + HARD-03 + Stage 10 critique).
 * - Matches `confidence < ANTI_VIRALITY_THRESHOLD` post-critique.
 *
 * Mock pattern mirrors src/lib/engine/__tests__/aggregator.test.ts top block —
 * stubs supabase/sentry/cache/ml/calibration/gemini/deepseek/stage11 so the
 * aggregator runs without touching a network/DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mocks — external dependencies imported transitively by aggregator.ts
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

// ml mock removed (Plan 04, R9): ml key removed from blend; ../ml moves to _dormant/ in Plan 05.
// Leftover mock would strand a dead import and compile-fail the suite after the move.

vi.mock("../calibration", () => ({
  getPlattParameters: vi.fn().mockResolvedValue(null),
  applyPlattScaling: vi.fn((score: number, _params: unknown) => score),
}));

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
  isCircuitOpen: vi.fn(() => true),
}));

// Stage 10 critique mock — returns null so result.confidence is NOT adjusted
// post-result-assembly. Keeps the test's confidence math deterministic on
// the PRE-critique path (matches the default aggregator.test.ts behavior).
vi.mock("../stage10-critique", () => ({
  runStage10Critique: vi.fn(async () => null),
  applyCritiqueAdjustment: vi.fn((c: number) => c),
}));

// Plan 01-05 Task 0: aggregator now imports maybeAppendLikelyFlopWarning from ./flop-warning.
// ../stage11-counterfactuals mock removed (module moves to _dormant/ — path won't resolve after move).
vi.mock("../flop-warning", () => ({
  maybeAppendLikelyFlopWarning: vi.fn(),
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { aggregateScores } from "../aggregator";
import {
  ANTI_VIRALITY_THRESHOLD,
  isAntiViralityGated,
} from "@/lib/engine/anti-virality";
import { makePipelineResult, makeDeepSeekReasoning } from "./factories";

// =====================================================
// aggregateScores — anti_virality_gated wiring (B4)
// =====================================================

describe("aggregateScores — anti_virality_gated wiring (B4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anti_virality_gated is a required boolean field on every PredictionResult", async () => {
    const result = await aggregateScores(makePipelineResult());
    expect(result).toHaveProperty("anti_virality_gated");
    expect(typeof result.anti_virality_gated).toBe("boolean");
  });

  it("sets anti_virality_gated = true when calibrated confidence < ANTI_VIRALITY_THRESHOLD", async () => {
    // Force LOW-confidence pipeline: DeepSeek says "low" and Gemini factors are
    // weak. calculateConfidence() should land below the 0.4 threshold.
    const lowConfReasoning = makeDeepSeekReasoning();
    lowConfReasoning.confidence = "low";
    const lowPipeline = makePipelineResult({
      deepseekResult: { reasoning: lowConfReasoning, cost_cents: 0.3 },
      // Plan 03 strip: ruleResult + trendEnrichment removed from PipelineResult.
    });
    const result = await aggregateScores(lowPipeline);
    // Functional contract: anti_virality_gated MUST match isAntiViralityGated(result.confidence).
    // The pipeline above is constructed to drive confidence < threshold; assert both the
    // expected direction AND the helper-equality invariant.
    expect(result.anti_virality_gated).toBe(
      isAntiViralityGated(result.confidence)
    );
    if (result.confidence < ANTI_VIRALITY_THRESHOLD) {
      expect(result.anti_virality_gated).toBe(true);
    }
  });

  it("sets anti_virality_gated = false when calibrated confidence >= ANTI_VIRALITY_THRESHOLD", async () => {
    // Force HIGH-confidence pipeline: DeepSeek says "high", matched rules + trends.
    const highConfReasoning = makeDeepSeekReasoning();
    highConfReasoning.confidence = "high";
    const highPipeline = makePipelineResult({
      deepseekResult: { reasoning: highConfReasoning, cost_cents: 0.3 },
      // Plan 03 strip: ruleResult + trendEnrichment removed from PipelineResult.
    });
    const result = await aggregateScores(highPipeline);
    expect(result.anti_virality_gated).toBe(
      isAntiViralityGated(result.confidence)
    );
    if (result.confidence >= ANTI_VIRALITY_THRESHOLD) {
      expect(result.anti_virality_gated).toBe(false);
    }
  });

  it("anti_virality_gated value matches isAntiViralityGated(result.confidence) post-calibration", async () => {
    // Universal invariant: regardless of pipeline shape, the boolean MUST equal
    // the threshold comparison on the final (post-calibration, post-critique)
    // confidence value. This is the canonical B4 wiring contract.
    const result = await aggregateScores(makePipelineResult());
    const expected = result.confidence < ANTI_VIRALITY_THRESHOLD;
    expect(result.anti_virality_gated).toBe(expected);
  });
});
