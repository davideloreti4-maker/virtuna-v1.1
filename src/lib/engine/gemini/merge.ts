/**
 * Phase 5 Plan 02 Task 2 — Null-safe segment merge with partial-failure semantics.
 *
 * Pure function (no I/O, no API calls). Consumes three `PromiseSettledResult` values
 * produced by `Promise.allSettled([runHookSegment, runBodySegment, runCtaSegment])`
 * and returns a merged `GeminiVideoAnalysis` with the `signalAvailability` triple that
 * the aggregator (Plan 03) keys off for weight redistribution.
 *
 * Authority allocation per CONTEXT D-13 + RESEARCH Pattern 3:
 *   • Hook segment OWNS: factors[], overall_impression, content_summary,
 *                        hook_decomposition, video_signals.hook_visual_impact
 *                        (= hook_decomposition.visual_stop_power passthrough).
 *   • Body segment OWNS: video_signals.visual_production_quality,
 *                        video_signals.pacing_score,
 *                        video_signals.transition_quality.
 *   • CTA  segment OWNS: cta_segment.
 *
 * Partial-failure (CONTEXT D-08): one `pipeline_warning` per failed segment, null-fill
 * the missing data, the merge still returns a usable analysis. The aggregator drops
 * the failed segment's contribution via the `signalAvailability` triple — NOT by
 * reading the null-fill structural zeros directly.
 *
 * All-3-failure (CONTEXT D-09): emit ONE consolidated `gemini_video_unavailable`
 * pipeline_warning and return `{ analysis: null, cost_cents: 0, ... }`. The pipeline
 * (Plan 03) maps this to its DEFAULT_GEMINI_RESULT redistribution path.
 */

import type { GeminiVideoAnalysis } from "../types";
import type {
  HookSegmentResult,
  BodySegmentResult,
  CtaSegmentResult,
} from "./schemas";
import type { SegmentResult } from "./hook-segment";
import type { StageEventCallback } from "../events";

// ============================================================================
// Public surface
// ============================================================================

export type MergedSegmentedResult = {
  analysis: GeminiVideoAnalysis | null;
  cost_cents: number;
  signalAvailability: {
    gemini_hook: boolean;
    gemini_body: boolean;
    gemini_cta: boolean;
  };
};

// ============================================================================
// Null-fill defaults — used when hook fails but body/CTA can still produce
// partial analysis. Shape matches HookFactorSchema's enum union exactly.
// ============================================================================

const DEFAULT_NULL_FACTORS: HookSegmentResult["factors"] = [
  {
    name: "Scroll-Stop Power",
    score: 0,
    rationale: "Hook analysis unavailable",
    improvement_tip: "Hook analysis unavailable",
  },
  {
    name: "Completion Pull",
    score: 0,
    rationale: "Hook analysis unavailable",
    improvement_tip: "Hook analysis unavailable",
  },
  {
    name: "Rewatch Potential",
    score: 0,
    rationale: "Hook analysis unavailable",
    improvement_tip: "Hook analysis unavailable",
  },
  {
    name: "Share Trigger",
    score: 0,
    rationale: "Hook analysis unavailable",
    improvement_tip: "Hook analysis unavailable",
  },
  {
    name: "Emotional Charge",
    score: 0,
    rationale: "Hook analysis unavailable",
    improvement_tip: "Hook analysis unavailable",
  },
];

// Per-video aggregate cost soft cap (Section 4b cost table). Emit warning at 5.0¢.
const AGGREGATE_COST_SOFT_CAP_CENTS = 5.0;

// ============================================================================
// Internal helpers
// ============================================================================

type SettledSegment<T> = PromiseSettledResult<SegmentResult<T>>;

function isSegmentOk<T>(
  settled: SettledSegment<T>,
): settled is PromiseFulfilledResult<{
  ok: true;
  analysis: T;
  cost_cents: number;
  model: string;
}> {
  return settled.status === "fulfilled" && settled.value.ok === true;
}

// ============================================================================
// mergeSegments
// ============================================================================

/**
 * Null-safe merge of three segment results into a widened GeminiVideoAnalysis.
 *
 * @param hookSettled  Result of `runHookSegment` wrapped by `Promise.allSettled`.
 * @param bodySettled  Result of `runBodySegment` wrapped by `Promise.allSettled`.
 *                     May be a synthetic `{ ok: false, error: "body skipped" }` from
 *                     the orchestrator's short-video branch (≤8s duration).
 * @param ctaSettled   Result of `runCtaSegment` wrapped by `Promise.allSettled`.
 * @param onStageEvent Pipeline event callback for `pipeline_warning` emission.
 * @returns Merged analysis + per-video cost + signalAvailability triple.
 */
export function mergeSegments(
  hookSettled: SettledSegment<HookSegmentResult>,
  bodySettled: SettledSegment<BodySegmentResult>,
  ctaSettled: SettledSegment<CtaSegmentResult>,
  onStageEvent: StageEventCallback | undefined,
): MergedSegmentedResult {
  const hookOk = isSegmentOk(hookSettled);
  const bodyOk = isSegmentOk(bodySettled);
  const ctaOk = isSegmentOk(ctaSettled);

  // ============================================================================
  // D-09: All 3 segments failed → consolidated `gemini_video_unavailable` warning
  // and return `{ analysis: null, cost_cents: 0 }`. The aggregator redistributes
  // weight across other Wave 1 signals when gemini_hook/body/cta are all false.
  // ============================================================================
  if (!hookOk && !bodyOk && !ctaOk) {
    onStageEvent?.({
      type: "pipeline_warning",
      message:
        "All Gemini segments failed — video signal unavailable. Aggregator will redistribute weight across other Wave 1 signals.",
      stage: "gemini_video_unavailable",
    });
    return {
      analysis: null,
      cost_cents: 0,
      signalAvailability: {
        gemini_hook: false,
        gemini_body: false,
        gemini_cta: false,
      },
    };
  }

  // ============================================================================
  // D-08: Per-segment warnings for partial failures (1-of-3 or 2-of-3 failure).
  // ============================================================================
  if (!hookOk) {
    onStageEvent?.({
      type: "pipeline_warning",
      message:
        "Gemini hook analysis unavailable — score uses other segments.",
      stage: "gemini_hook",
    });
  }
  if (!bodyOk) {
    onStageEvent?.({
      type: "pipeline_warning",
      message:
        "Gemini body analysis unavailable — score uses other segments.",
      stage: "gemini_body",
    });
  }
  if (!ctaOk) {
    onStageEvent?.({
      type: "pipeline_warning",
      message:
        "Gemini CTA analysis unavailable — score uses other segments.",
      stage: "gemini_cta",
    });
  }

  // ============================================================================
  // Type-narrow OK results for the merge construction.
  // ============================================================================
  const hookValue = hookOk ? hookSettled.value : null;
  const bodyValue = bodyOk ? bodySettled.value : null;
  const ctaValue = ctaOk ? ctaSettled.value : null;

  // ============================================================================
  // Authority allocation — per D-13 merge contract.
  //
  // hook_visual_impact passthrough: hook owns this signal via the
  // `hook_decomposition.visual_stop_power` field. Body schema does NOT include it.
  // When hook fails, we use structural 0 — the aggregator reads
  // `signalAvailability.gemini_hook === false` as the source of truth and skips
  // the contribution via weight redistribution rather than reading the 0 directly.
  //
  // video_signals interior fields stay as `number` (not nullable) per the existing
  // GeminiVideoSignalsSchema kept unchanged by Plan 01. Using structural 0 keeps
  // the merged shape valid against the existing schema while signalAvailability
  // carries the real truth for Plan 03's aggregator.
  // ============================================================================
  const analysis: GeminiVideoAnalysis = {
    factors: hookValue ? hookValue.analysis.factors : DEFAULT_NULL_FACTORS,
    overall_impression: hookValue
      ? hookValue.analysis.overall_impression
      : "Hook analysis unavailable.",
    content_summary: hookValue
      ? hookValue.analysis.content_summary
      : "Video content summary unavailable — hook segment did not complete.",
    video_signals: {
      visual_production_quality: bodyValue
        ? bodyValue.analysis.video_signals.visual_production_quality
        : 0,
      hook_visual_impact: hookValue
        ? hookValue.analysis.hook_decomposition.visual_stop_power
        : 0,
      pacing_score: bodyValue
        ? bodyValue.analysis.video_signals.pacing_score
        : 0,
      transition_quality: bodyValue
        ? bodyValue.analysis.video_signals.transition_quality
        : 0,
    },
    hook_decomposition: hookValue ? hookValue.analysis.hook_decomposition : null,
    cta_segment: ctaValue ? ctaValue.analysis : null,
  };

  const cost_cents =
    (hookValue?.cost_cents ?? 0) +
    (bodyValue?.cost_cents ?? 0) +
    (ctaValue?.cost_cents ?? 0);

  // ============================================================================
  // Aggregate cost cap warning (Section 4b — per-video soft cap 5.0¢).
  // ============================================================================
  if (cost_cents > AGGREGATE_COST_SOFT_CAP_CENTS) {
    onStageEvent?.({
      type: "pipeline_warning",
      message: `Gemini per-video aggregate cost ${cost_cents.toFixed(4)}¢ exceeds soft cap ${AGGREGATE_COST_SOFT_CAP_CENTS}¢`,
      stage: "gemini_segmented",
    });
  }

  return {
    analysis,
    cost_cents,
    signalAvailability: {
      gemini_hook: hookOk,
      gemini_body: bodyOk,
      gemini_cta: ctaOk,
    },
  };
}
