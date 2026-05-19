import { z } from "zod";

// =====================================================
// Feature Vector — Standardized signal backbone
// =====================================================

export interface FeatureVector {
  // Gemini factor scores (0-10)
  hookScore: number;
  completionPull: number;
  rewatchPotential: number;
  shareTrigger: number;
  emotionalCharge: number;

  // Gemini video signals (0-10, null when no video)
  visualProductionQuality: number | null;
  hookVisualImpact: number | null;
  pacingScore: number | null;
  transitionQuality: number | null;

  // DeepSeek component scores (0-10)
  hookEffectiveness: number;
  retentionStrength: number;
  shareability: number;
  commentProvocation: number;
  saveWorthiness: number;
  trendAlignment: number;
  originality: number;

  // Rules engine (0-100)
  ruleScore: number;

  // Trend signals (0-100)
  trendScore: number;

  // Audio/Sound (0-1 match score, null if no match)
  audioTrendingMatch: number | null;

  // Caption/Hashtag signals
  captionScore: number; // 0-10 estimated quality
  hashtagRelevance: number; // 0-1 relevance score
  hashtagCount: number; // raw count

  // Content metadata
  durationSeconds: number | null;
  hasVideo: boolean;
}

// =====================================================
// Engine Input — v2 with 3 input modes
// =====================================================

export const AnalysisInputSchema = z
  .object({
    // Input mode discriminator
    input_mode: z.enum(["text", "tiktok_url", "video_upload"]),

    // Text content (required for text mode, optional for URL/video as caption)
    content_text: z.string().max(10000).optional(),

    // TikTok URL (required for tiktok_url mode)
    tiktok_url: z.string().url().optional(),

    // Video upload reference (required for video_upload mode — Supabase Storage path)
    video_storage_path: z.string().optional(),

    // Content type (platform context)
    content_type: z.enum(["post", "reel", "story", "video", "thread"]),

    // Optional metadata
    society_id: z.string().optional(),
    niche: z.string().optional(),
    creator_handle: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.input_mode === "text") return !!data.content_text;
      if (data.input_mode === "tiktok_url") return !!data.tiktok_url;
      if (data.input_mode === "video_upload") return !!data.video_storage_path;
      return false;
    },
    { message: "Required field missing for selected input_mode" }
  );

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

// =====================================================
// Content Payload — Normalized internal representation
// =====================================================

export interface ContentPayload {
  content_text: string; // Always present (extracted from video/URL or user input)
  content_type: string;
  input_mode: "text" | "tiktok_url" | "video_upload";
  video_url: string | null; // ONLY populated for tiktok_url mode (the actual TikTok URL). null for text + video_upload modes. NEVER aliased to a Supabase storage key (Phase 4 GAP-04-01 fix — Option A).
  video_storage_path: string | null; // Phase 4 gap-closure: Supabase Storage object key for video_upload mode (e.g., "user-abc/video.mp4"). null for text + tiktok_url modes.
  hashtags: string[]; // Extracted from content_text
  duration_hint: number | null; // Seconds, from URL metadata or user input
  niche: string | null;
  creator_handle: string | null;
  society_id: string | null;
}

// =====================================================
// Engine Output Components
// =====================================================

export interface Factor {
  id: string;
  name: string;
  score: number; // 0-10
  max_score: number;
  rationale: string; // was: description
  improvement_tip: string; // was: tips: string[]
}

export interface Suggestion {
  id: string;
  text: string;
  priority: "high" | "medium" | "low";
  category: string;
}

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

// =====================================================
// Predicted Engagement — TikTok-style engagement metrics
// =====================================================

export interface PredictedEngagement {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
}

// =====================================================
// Full Prediction Result v2
// =====================================================

export interface PredictionResult {
  // Core prediction
  overall_score: number; // 0-100
  confidence: number; // 0-1 numeric (ENG-07: not categorical)
  confidence_label: ConfidenceLevel; // "HIGH" | "MEDIUM" | "LOW" for UI display
  is_calibrated: boolean; // CAL-02: whether Platt scaling was applied to overall_score

  // v2 outputs
  behavioral_predictions: BehavioralPredictions;
  feature_vector: FeatureVector;
  reasoning: string; // DeepSeek's reasoning text
  warnings: string[]; // Fatal flaw warnings from DeepSeek Step 4

  // Predicted engagement metrics (RES-2)
  predicted_engagement: PredictedEngagement;

  // Factors and suggestions (from Gemini + DeepSeek)
  factors: Factor[];
  suggestions: Suggestion[];

  // Scoring breakdown
  rule_score: number;
  trend_score: number;
  gemini_score: number; // Gemini's contribution
  behavioral_score: number; // DeepSeek behavioral contribution
  ml_score: number; // ML classifier score (0-100), 0 if model unavailable
  /** Phase 6 (D-G3) — 0-100 audio perceptual score before fingerprint boost. 0 when audio absent.
   *  Optional to preserve compile against existing consumers; plans 06-05/06-06 will start emitting it. */
  audio_perceptual_score?: number;
  /** Phase 6 (D-G1) — Full fingerprint match record or null if no match above threshold.
   *  Optional to preserve compile against existing consumers; plans 06-05/06-06 will start emitting it. */
  audio_fingerprint?: AudioFingerprintResult | null;
  /** Phase 6 (Note 7 / Q4 RESOLVED) — verbatim Gemini-emitted audio_description for
   *  persistence into analysis_results.audio_description (Plan 06-02 migration).
   *  Null when audio_signals absent. Sourced verbatim from
   *  geminiResult.analysis.audio_signals?.audio_description ?? null. */
  audio_description?: string | null;
  score_weights: {
    behavioral: number; // 0.35
    gemini: number; // 0.25
    ml: number; // 0.15
    rules: number; // 0.15
    trends: number; // 0.10
    /** Phase 6 (D-G1) — audio weight 0.07; redistributes when signal_availability.audio=false. */
    audio?: number;
  };

  // Meta
  latency_ms: number;
  cost_cents: number;
  engine_version: string;
  gemini_model: string;
  deepseek_model: string | null;
  input_mode: "text" | "tiktok_url" | "video_upload";
  has_video: boolean;

  /** Phase 3 — provenance flags surfaced from aggregator availability. */
  signal_availability: SignalAvailability;
}

// =====================================================
// Phase 3 — Signal Provenance + Future-Wave Stub Types
// =====================================================

/**
 * Provenance — which signals fired vs degraded for this prediction.
 * Persisted to analysis_results.signal_availability JSONB column.
 * Forward-compat: future phases (audio, retrieval, hook_decomp, etc.) add keys here.
 */
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;  // NEW Phase 4 (D-20) — set by aggregator from wave0Result.content_type !== null
  niche: boolean;          // NEW Phase 4 (D-20) — set by aggregator from wave0Result.niche !== null
  // Phase 6 (D-G1) — weight-bearing: gates audio_perceptual_score contribution to overall_score.
  // Optional to preserve compile against existing aggregator; plans 06-05/06-06 emit it.
  audio?: boolean;
  // Phase 6 (D-G1) — provenance only: tracks whether pgvector returned a match; NOT in SCORE_WEIGHT_KEYS.
  // Optional to preserve compile against existing aggregator; plans 06-05/06-06 emit it.
  audio_fingerprint?: boolean;
}

// Wave0Result now defined below as z.infer<typeof Wave0ResultSchema> — see Phase 4 block.

/** Wave 3 persona simulation result — Phase 7 fills with real V3 reactions. */
export interface PersonaSimulationResult {
  persona_id: string;
  scroll_past_second: number;
  watch_through_pct: number;
  comment_intent: number;
  share_intent: number;
  save_intent: number;
}

/** Stage 10 self-critique result — Phase 9 fills with V3 critique call. */
export interface CritiqueResult {
  consistency_score: number;
  flags: string[];
  confidence_adjustment: number;
}

/** Stage 11 counterfactuals result — Phase 9 fills with V3 counterfactual call. */
export interface CounterfactualResult {
  suggestions: Array<{ change: string; timestamp_ms: number; expected_impact: string }>;
}

// =====================================================
// Zod Schemas for LLM Response Validation (ENGINE-07)
// =====================================================

export const FactorSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(10),
  rationale: z.string(),
  improvement_tip: z.string(),
});

export const GeminiVideoSignalsSchema = z.object({
  visual_production_quality: z.number().min(0).max(10),
  hook_visual_impact: z.number().min(0).max(10),
  pacing_score: z.number().min(0).max(10),
  transition_quality: z.number().min(0).max(10),
});

// Phase 6 (D-A1..A3, D-F1) — Zod schema for the extended audio_signals block.
// `.refine()` normalizes ratio sums within ±0.1 tolerance per Pitfall 1.
// Chained `.optional()` on parent schemas wraps this refined schema so the
// refinement only fires when the field is present (graceful degradation per
// HARD-03 + Phase 3 D-04).
// NOTE: declared BEFORE GeminiResponseSchema so that the base schema can
// reference it directly via `.optional()` (Phase 6 wiring + aggregator access
// via `gemini.audio_signals?.audio_description ?? null`).
export const GeminiAudioSignalsSchema = z
  .object({
    voice_clarity_0_10: z.number().min(0).max(10).nullable(),
    audio_hook_first_2s_0_10: z.number().min(0).max(10).nullable(),
    silence_ratio: z.number().min(0).max(1),
    voiceover_ratio: z.number().min(0).max(1),
    music_ratio: z.number().min(0).max(1),
    audio_description: z.string().min(1).max(300),
  })
  .refine(
    (v) =>
      Math.abs(v.silence_ratio + v.voiceover_ratio + v.music_ratio - 1.0) < 0.1,
    { message: "Audio ratios must sum to ~1.0 (±0.1 tolerance)" },
  );

// Phase 6 — audio_signals is OPTIONAL on the BASE response schema (not just on
// GeminiVideoResponseSchema). When Gemini omits the audio_signals block (model
// regression, prompt edge case, or any failure mode where the LLM degrades to
// video-only output), the top-level response still passes Zod validation.
// Downstream code reads audio_signals via optional chaining
// (`geminiResult.analysis.audio_signals?.audio_description ?? null`), so the
// resulting `T | undefined` type is the canonical contract. The text-mode path
// never populates audio_signals at runtime, so the type stays `undefined` on
// text-only analyses — preserving graceful degradation per HARD-03 + Phase 3
// D-04. Aggregator sees audio_signals as undefined → signal_availability.audio
// = false → audio weight redistributes via the existing selectWeights math.
// Mirrors the existing `video_signals.optional()` pattern below it.
export const GeminiResponseSchema = z.object({
  factors: z.array(FactorSchema).length(5),
  overall_impression: z.string(),
  content_summary: z.string(),
  video_signals: GeminiVideoSignalsSchema.optional(),
  audio_signals: GeminiAudioSignalsSchema.optional(),
});

export type GeminiAnalysis = z.infer<typeof GeminiResponseSchema>;

// GeminiVideoResponseSchema is the strict superset for video-mode responses:
// video_signals becomes REQUIRED (not optional). audio_signals remains optional
// for graceful degradation — the inherited base shape carries it through.
export const GeminiVideoResponseSchema = GeminiResponseSchema.extend({
  video_signals: GeminiVideoSignalsSchema,
  // audio_signals optional inherited from GeminiResponseSchema — explicit here
  // for readability + to keep the Phase 6 BLOCKER 2 contract obvious to readers.
  audio_signals: GeminiAudioSignalsSchema.optional(),
});

export type GeminiVideoAnalysis = z.infer<typeof GeminiVideoResponseSchema>;

export type GeminiVideoSignals = z.infer<typeof GeminiVideoSignalsSchema>;

// =====================================================
// Phase 4 — Wave 0 Result Shapes (widens Wave0Result, adds Zod validation)
// Per CONTEXT D-08, D-11 + RESEARCH Topic #8.
// =====================================================

export const ContentTypeEnumSchema = z.enum([
  "talking_head",
  "b_roll",
  "slideshow",
  "action",
  "tutorial",
  "vlog",
  "other",
] as const);

export type ContentTypeSlug = z.infer<typeof ContentTypeEnumSchema>;

export const Wave0ContentTypeResultSchema = z.object({
  type: ContentTypeEnumSchema,
  confidence: z.number().min(0).max(1),
  warning: z.enum(["mixed_content_detected", "low_confidence"]).optional(),
});
export type Wave0ContentTypeResult = z.infer<typeof Wave0ContentTypeResultSchema>;

export const Wave0NicheResultSchema = z.object({
  primary: z.string(),
  sub: z.string(),
  micro: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["ai", "card1_fallback"]),
  warning: z
    .enum(["niche_drift_detected", "niche_low_confidence_no_fallback"])
    .optional(),
});
export type Wave0NicheResult = z.infer<typeof Wave0NicheResultSchema>;

export const Wave0ResultSchema = z.object({
  content_type: Wave0ContentTypeResultSchema.nullable(),
  niche: Wave0NicheResultSchema.nullable(),
});
export type Wave0Result = z.infer<typeof Wave0ResultSchema>;

export const SuggestionSchema = z.object({
  text: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.string(),
});

// =====================================================
// DeepSeek v2 Response Schema — Behavioral Predictions
// =====================================================

export const BehavioralPredictionsSchema = z.object({
  completion_pct: z.number().min(0).max(100),
  completion_percentile: z.string(),
  share_pct: z.number().min(0).max(100),
  share_percentile: z.string(),
  comment_pct: z.number().min(0).max(100),
  comment_percentile: z.string(),
  save_pct: z.number().min(0).max(100),
  save_percentile: z.string(),
});

export type BehavioralPredictions = z.infer<typeof BehavioralPredictionsSchema>;

export const ComponentScoresSchema = z.object({
  hook_effectiveness: z.number().min(0).max(10),
  retention_strength: z.number().min(0).max(10),
  shareability: z.number().min(0).max(10),
  comment_provocation: z.number().min(0).max(10),
  save_worthiness: z.number().min(0).max(10),
  trend_alignment: z.number().min(0).max(10),
  originality: z.number().min(0).max(10),
});

export type ComponentScores = z.infer<typeof ComponentScoresSchema>;

export const DeepSeekResponseSchema = z.object({
  behavioral_predictions: BehavioralPredictionsSchema,
  component_scores: ComponentScoresSchema,
  suggestions: z.array(SuggestionSchema).min(1),
  warnings: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]),
});

export type DeepSeekReasoning = z.infer<typeof DeepSeekResponseSchema>;

// =====================================================
// Internal Types
// =====================================================

export interface RuleScoreResult {
  rule_score: number; // 0-100
  matched_rules: Array<{
    rule_id: string;
    rule_name: string;
    score: number;
    max_score: number;
    tier: 'regex' | 'semantic'; // Which evaluation path produced this match
  }>;
}

export interface TrendEnrichment {
  trend_score: number; // 0-100
  matched_trends: Array<{
    sound_name: string;
    velocity_score: number;
    trend_phase: string | null;
  }>;
  trend_context: string; // Summary for DeepSeek prompt
  hashtag_relevance: number; // 0-1 semantic hashtag relevance (SIG-03)
}

// =====================================================
// Phase 6 — Audio Analysis result shapes
// =====================================================

/** Audio sub-scores extracted from the extended gemini_video_analysis response. D-A1, D-A3, D-F1. */
export interface GeminiAudioSignals {
  /** 0-10 voice clarity / SNR. null per D-A2 when content_type ∈ {slideshow, b_roll, action}. */
  voice_clarity_0_10: number | null;
  /** 0-10 audio hook score for first 2s (D-H2). null per D-A2 when content_type ∈ {slideshow, b_roll, action}. */
  audio_hook_first_2s_0_10: number | null;
  /** 0-1, sums to 1.0 with siblings per D-A3. */
  silence_ratio: number;
  /** 0-1, sums to 1.0 with siblings per D-A3. */
  voiceover_ratio: number;
  /** 0-1, sums to 1.0 with siblings per D-A3. */
  music_ratio: number;
  /** 50-150 char description for fingerprint matching per D-F1. */
  audio_description: string;
}

/** audio_perceptual_score output (D-G3 — content-type-adaptive formula). */
export interface AudioPerceptualResult {
  /** 0-100, normalized BEFORE audio_fingerprint_boost is applied per D-G3. */
  audio_perceptual_score: number;
  /** Which formula branch the score came from per D-G3. */
  formula_mode: "voice" | "ambient" | "balanced";
  /** Sub-score field names that fed the formula (for debugging — e.g., ["voice_clarity", "audio_hook", "voiceover_ratio"]). */
  sub_scores_used: string[];
}

/** pgvector fingerprint match result (D-F0, D-F1). null when no match above threshold. */
export interface AudioFingerprintResult {
  sound_name: string;
  sound_url: string | null;
  /** 0-1 cosine similarity. Threshold for inclusion is 0.80 (env-overridable AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD). */
  similarity: number;
  /** From trending_sounds.trend_phase column. null if column is null. */
  trend_phase: "emerging" | "rising" | "peak" | "declining" | null;
  /** From trending_sounds.velocity_score column. */
  velocity_score: number;
}

/**
 * Phase 6 D-A4 — feeder interface widening the pipeline result with the
 * audio_fingerprint stage output. `PipelineResult` (declared in pipeline.ts)
 * extends this interface so Plan 06-06's aggregator can read
 * `pipelineResult.audioFingerprintResult` with full type safety.
 *
 * Lives in types.ts (next to the AudioFingerprintResult shape it references)
 * to keep audio-related types in one place. pipeline.ts composes it into the
 * full PipelineResult so the broader interface stays close to its consumer.
 *
 * Value contract:
 * - `AudioFingerprintResult` when the pgvector RPC returned a row above the
 *   similarity threshold (0.80 by default; env-overridable).
 * - `null` when (a) Gemini omitted audio_signals, (b) audio_description was
 *   absent / empty, (c) embedContent failed softly, (d) the RPC returned an
 *   error object, (e) no row matched above threshold, or (f) any thrown
 *   exception was caught by the pipeline's audio_fingerprint stage.
 *
 * Never `undefined` — pipeline.ts always assigns either the match record or null
 * (the stage's graceful-degradation contract). Aggregator can therefore read
 * `pipelineResult.audioFingerprintResult !== null` for the availability flag.
 */
export interface PipelineAudioFingerprintFields {
  audioFingerprintResult: AudioFingerprintResult | null;
}
