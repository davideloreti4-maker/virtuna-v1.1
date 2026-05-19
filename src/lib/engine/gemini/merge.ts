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

  // ============================================================================
  // Phase 5 Plan 03 Task 3 — Rationale-vs-score consistency check (G7 + D15 + D16).
  // Lightweight regex-based catch for the most common "schema-valid but semantically
  // invalid" patterns. Emits pipeline_warning events that feed AI-SPEC §7 M9 (D15)
  // and M10 (D16) production telemetry. Does NOT block — the merged result is still
  // usable; the warnings are informational and inform F8 / F9 flywheel review.
  // ============================================================================
  if (hookOk && hookValue) {
    validateRationaleConsistency(hookValue.analysis, onStageEvent);
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

// ============================================================================
// Phase 5 D15 — Rationale-vs-score consistency check (G7 + M9 in AI-SPEC §6/§7)
// ============================================================================
// Lightweight regex-based catch for the most common schema-valid-but-semantically-invalid
// pattern: the model says "no on-screen text" / "no spoken words" / "silent" in
// rationale text but emits a non-zero score for that modality. Phase 5 ships the
// simple regex; the LLM-judge full version is Phase 12 territory.
//
// Emits up to 2 pipeline_warning events:
//   - "rationale_inconsistency" (D15) — score vs absent-language contradiction.
//   - "hook_temporal_drift" (D16) — hook rationale references events outside the 0-5s window.
//
// Neither blocks the merged result; both feed the F8 / F9 flywheel review path.

// WR-03: Narrow regexes to clauses that ONLY appear in failure-mode language.
// Pre-fix regexes false-positively matched legitimate descriptive rationales
// like "the silent video movement is huge in this niche" or "punchline at the
// end of the hook" — polluting F8/F9 flywheel signal (AI-SPEC §7 M9/M10).
// Phase 12's LLM-judge layer is the real fix; these are floor-pass tightenings.
const ABSENT_TEXT_PATTERNS: RegExp[] = [
  /\bno (?:on-screen )?text(?: overlay)?\b/i,
  /\bno (?:visible |on-screen )?(?:overlay|caption)s?\b/i,
];
const ABSENT_SPEECH_PATTERNS: RegExp[] = [
  /\bno (?:spoken|verbal) (?:words?|content|opening)\b/i,
  // Require strong precedent for "silent X" — narrow to the clause shapes that
  // describe THIS hook, not the trend space (e.g. drop bare "\bsilent video\b"
  // which matches "the silent video trend is huge" — a positive description).
  /\b(?:hook|opening) is silent\b/i,
  /\bsilent (?:hook|opening)\b/i,
  /\bno (?:speech|narration|voiceover|dialogue)\b/i,
];
const TEMPORAL_DRIFT_PATTERNS: RegExp[] = [
  /\blater in the video\b/i,
  /\bafter the (?:hook|5 seconds?|5s)\b/i,
  // Replace the bare "at the end" (false-positive on "punchline at the end of
  // the hook" — well within 0-5s) with explicit "end of the video" variants.
  /\bat the (?:very )?end of the video\b/i,
  // Bare seconds timestamp > 5s (e.g., "at 15s", "by 6s") — single-digit 6-9 OR multi-digit ≥10.
  /\b(?:[6-9]|[1-9]\d+)s\b/i,
];

/**
 * Phase 5 Plan 03 Task 3 — Run rationale-vs-score consistency check on the parsed hook segment.
 *
 * Emits up to 2 pipeline_warning events via the optional callback:
 *   - `rationale_inconsistency` (D15) — when rationale text claims a modality is
 *     absent but the corresponding score is > 2.
 *   - `hook_temporal_drift` (D16) — when hook rationale references content outside
 *     the 0-5s window (later timestamps, "at the end", "later in the video").
 *
 * Pure-ish function: regex-only, no I/O, no API calls. Safe to call even when the
 * callback is undefined (early-return).
 */
export function validateRationaleConsistency(
  hookAnalysis: {
    factors: Array<{ rationale: string; name?: string }>;
    hook_decomposition: { text_overlay_score: number; first_words_speech_score: number };
  },
  onStageEvent: StageEventCallback | undefined,
): void {
  if (!onStageEvent) return;

  // Collect ALL rationale text from the hook segment for pattern scanning.
  const allRationales = hookAnalysis.factors.map((f) => f.rationale).join(" ");

  // D15: text_overlay_score should be ≤ 2 when rationale claims no on-screen text.
  if (
    hookAnalysis.hook_decomposition.text_overlay_score > 2 &&
    ABSENT_TEXT_PATTERNS.some((p) => p.test(allRationales))
  ) {
    onStageEvent({
      type: "pipeline_warning",
      message: `Hook rationale claims absent text but text_overlay_score=${hookAnalysis.hook_decomposition.text_overlay_score} (>2)`,
      stage: "rationale_inconsistency",
    });
  }

  // D15: first_words_speech_score should be ≤ 2 when rationale claims no speech.
  if (
    hookAnalysis.hook_decomposition.first_words_speech_score > 2 &&
    ABSENT_SPEECH_PATTERNS.some((p) => p.test(allRationales))
  ) {
    onStageEvent({
      type: "pipeline_warning",
      message: `Hook rationale claims absent speech but first_words_speech_score=${hookAnalysis.hook_decomposition.first_words_speech_score} (>2)`,
      stage: "rationale_inconsistency",
    });
  }

  // D16: hook rationale should NOT reference events later than 5s (HAVEN-class
  // temporal hallucination — arXiv 2503.19622, AI-SPEC §1b failure mode #9).
  if (TEMPORAL_DRIFT_PATTERNS.some((p) => p.test(allRationales))) {
    onStageEvent({
      type: "pipeline_warning",
      message:
        "Hook segment rationale references events outside the 0-5s window (temporal grounding drift)",
      stage: "hook_temporal_drift",
    });
  }
}
