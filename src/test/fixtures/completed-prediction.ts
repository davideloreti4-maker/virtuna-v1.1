/**
 * Canonical completed-prediction fixture set.
 *
 * COMPLETED_PREDICTION represents a terminal-state PredictionResult that the
 * ResultCard's initialData path consumes (Pitfall #3 gate — rendering completed
 * analyses must NOT re-open the stream).
 *
 * IN_FLIGHT_ROW represents an analysis row whose overall_score is still null
 * (placeholder INSERT per Pitfall #6 Option A). ResultCard MUST open the stream
 * when handed this shape.
 *
 * Forward-compat: the three Phase 1 additive fields (optimal_post_window per
 * D-13, emotion_arc per R1.7, anti_virality_gated per R1.9) are intersected onto
 * Partial<PredictionResult> so the fixture compiles today and downstream Plans
 * 04 / 05 / 06 inherit the canonical shape verbatim.
 */
import type { PredictionResult } from "@/lib/engine/types";

/**
 * Phase 1 additive fields — locked here for downstream consumers.
 * Plans 04 (emotion_arc), 05 (optimal_post_window), 06 (anti_virality_gated)
 * promote these from fixture-local typing onto the canonical PredictionResult
 * interface in src/lib/engine/types.ts.
 */
export interface Phase1AdditiveFields {
  /** D-13 — niche-only corpus median posting window. Null when computation throws. */
  optimal_post_window: {
    day_of_week: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    hour_range: [number, number];
    timezone: "UTC";
    reasoning: string;
    source: "niche" | "creator" | "fallback";
  } | null;
  /** R1.7 — segmentation emotion arc curve. Null when omitted by engine. */
  emotion_arc: Array<{
    timestamp_ms: number;
    intensity_0_1: number;
    label?: "low" | "mid" | "high";
  }> | null;
  /** R1.9 — required boolean, default false. true when confidence < ANTI_VIRALITY_THRESHOLD. */
  anti_virality_gated: boolean;
}

export type CompletedPrediction = Partial<PredictionResult> &
  Phase1AdditiveFields & { overall_score: number };

/** Canonical completed PredictionResult for ResultCard initialData tests (Pitfall #3 gate). */
export const COMPLETED_PREDICTION: CompletedPrediction = {
  overall_score: 0.72,
  confidence: 0.65,
  confidence_label: "MEDIUM",
  factors: [],
  warnings: [],
  suggestions: [],
  reasoning: "Test reasoning narrative.",
  rule_score: 0.7,
  trend_score: 0.5,
  score_weights: {} as PredictionResult["score_weights"],
  latency_ms: 8500,
  cost_cents: 33,
  engine_version: "v3.0.0-test",
  gemini_model: "gemini-2.5-flash-lite",
  deepseek_model: "deepseek-chat",
  input_mode: "text",
  has_video: false,
  // Phase 1 fields (Plans 04 + 05 + 06) — fixture pre-populates so tests written
  // in this plan reference final shape; downstream plans only need to promote
  // the typing onto PredictionResult in src/lib/engine/types.ts.
  optimal_post_window: {
    day_of_week: "Tue",
    hour_range: [18, 21],
    timezone: "UTC",
    reasoning: "Your niche peaks Tue 18:00-21:00 UTC (n=42 videos)",
    source: "niche",
  },
  emotion_arc: [
    { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" },
    { timestamp_ms: 5000, intensity_0_1: 0.7, label: "high" },
    { timestamp_ms: 9500, intensity_0_1: 0.5, label: "mid" },
  ],
  // Phase 1 (R1.9, Plan 06 T3) — required field, default false for HIGH-confidence fixture
  anti_virality_gated: false,
};

/** Row that represents an in-flight analysis (overall_score null) — used to verify
 *  ResultCard OPENS the stream (Pitfall #3). */
export const IN_FLIGHT_ROW = {
  id: "test-analysis-id-12chars",
  user_id: "test-user-id",
  overall_score: null,
  confidence: null,
  created_at: new Date().toISOString(),
} as const;
