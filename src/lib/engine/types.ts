import { z } from "zod";
import {
  HookDecompositionZodSchema,
  CtaSegmentZodSchema,
  type HookDecomposition,
  type CtaSegmentResult,
  type BodySegmentResult,
} from "./gemini/schemas";
import type { EmotionArcPoint } from "./qwen/schemas";
import type { OptimalPostWindow } from "./optimal-post";
import { ARCHETYPES } from "./wave3/persona-registry";

// Phase 5 D-13 — re-export segment types so downstream consumers (aggregator, merge,
// route handlers) have ONE import surface (`@/lib/engine/types`) instead of two.
export type { HookDecomposition, CtaSegmentResult, BodySegmentResult };

// Phase 1 (R1.7) — re-export EmotionArcPoint so consumers can import from
// "@/lib/engine/types" instead of reaching into qwen/schemas directly.
export type { EmotionArcPoint };

// Phase 3 (D-07) — re-export SegmentGrid so engine consumers don't reach into qwen/.
export type { SegmentGrid } from "./qwen/schemas";

// D-13 (Phase 3) + Phase 4 slot_type (OQ-1 / Plan 04-02): per-persona attention timeline + archetype slot.
// Backwards-compatible additive payload on PredictionResult. Phase 4 (Audience node)
// consumes this; null when Pass 2 < SUCCESS_THRESHOLD per D-06.
export interface HeatmapPayload {
  segments: Array<{
    idx: number;
    t_start: number;
    t_end: number;
    label?: string;                          // omni-supplied visual_event short label
    is_hook_zone: boolean;
    keyframe_uri: string | null;             // signed URL; null until filmstrip ready
  }>;
  personas: Array<{
    id: string;                              // matches existing persona.id
    slot_type: 'fyp' | 'niche' | 'loyalist' | 'cross_niche'; // Phase 4 OQ-1: client recompute key
    archetype?: string;                      // e.g. "high_engager", "lurker"; absent on old rows
    attentions: number[];                    // length === segments.length
    swipe_predicted_at: number | null;       // t value
    segment_reasons: Record<number, string>; // sparse, inflection points only
  }>;
  weighted_curve: number[];                  // weighted aggregate attention per segment
  weights: {                                 // transparency surface, default mix
    fyp: number;        // 0.65
    niche: number;      // 0.20
    loyalist: number;   // 0.10
    cross_niche: number;// 0.05
  };
  weights_source: 'default' | 'niche_override' | 'creator_override' | 'analysis_override';
  /** Niche-only weighted completion (0-1) — mean attention across niche-slot personas only.
   *  null when no niche-slot personas survived. Feeds the Audience "vs Niche" chip. */
  niche_completion_pct?: number | null;
  /** Overall weighted_completion_pct − niche_completion_pct (0-1, can be negative).
   *  Positive ⇒ this video plays broader than its niche baseline. null when no niche personas. */
  vs_niche_diff_pct?: number | null;
  /** Mirror of the top-level PredictionResult.weighted_completion_pct (0-1). Persisted
   *  here so the Score-frame engine signal survives permalink reload — the top-level
   *  field is computed at aggregate time but NOT a DB column. Absent on pre-fix rows. */
  weighted_completion_pct?: number | null;
  /** Mirror of the top-level PredictionResult.weighted_hook_score. Persisted here for
   *  the same reload-survival reason as weighted_completion_pct above. */
  weighted_hook_score?: number | null;
}

// D-15 (Phase 3) — Streaming partial extension for persona rows.
// Phase 4 board subscribes to attentions for row-by-row reveal choreography.
// Additive: Pass 1 fields (id, status, verdict, reasoning) preserved unchanged.
export interface PersonaStreamingPartial {
  id: string;
  status: "pending" | "streaming" | "complete";
  verdict?: string;
  reasoning?: string;
  // Pass 2 streaming fields
  pass2_status?: "pending" | "streaming" | "complete";
  attentions?: number[];
  swipe_predicted_at?: number;
}

// Phase 1 (R6.1, D-13) — re-export OptimalPostWindow so consumers can import
// from "@/lib/engine/types" instead of reaching into optimal-post directly.
export type { OptimalPostWindow };

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

    // Submission intent: 'score' (predict own content) or 'remix' (decode a viral video for adaptation).
    // Distinct from input_mode which captures the input mechanism (D-12).
    mode: z.enum(["score", "remix"]).default("score"),
  })
  .refine(
    (data) => {
      if (data.input_mode === "text") return !!data.content_text;
      if (data.input_mode === "tiktok_url") return !!data.tiktok_url;
      if (data.input_mode === "video_upload") return !!data.video_storage_path;
      return false;
    },
    { message: "Required field missing for selected input_mode" }
  )
  .refine(
    (data) => !(data.mode === "remix" && data.input_mode === "text"),
    { message: "Remix mode requires a video or link source, not text" }
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
  /** Phase 1 (R1.7) — Emotion arc timeline from Omni Plus. Null when video absent
   *  or Qwen omitted the field. Optional to preserve compile against existing consumers. */
  emotion_arc?: EmotionArcPoint[] | null;
  /** Phase 1 (R1.9, Plan 06 T3 B4) — true when confidence < ANTI_VIRALITY_THRESHOLD.
   *  UI renders "Don't post yet" orange verdict state when true. REQUIRED field
   *  (not optional) — aggregator assigns on every PredictionResult; defaults to
   *  false when calibrated confidence >= threshold. Eliminates dead-code threshold
   *  per checker B4. Gated on POST-CRITIQUE confidence (Pitfall 7 ordering invariant —
   *  matches the gate `maybeAppendLikelyFlopWarning` uses). */
  anti_virality_gated: boolean;
  /** Phase 3 (Plan 08, D-17) — reason discriminator from isAntiViralityGatedFull.
   *  "confidence" | "timeline_pattern" | "both" | null. null when not gated. */
  anti_virality_reason?: "confidence" | "timeline_pattern" | "both" | null;
  /** Phase 3 (Plan 08, D-17) — top-N worst weighted_curve segment indices.
   *  Non-empty only when timeline_pattern triggered (from topDropoffSegmentIndices). */
  dropoff_segment_indices?: number[];
  /** Phase 1 (R6.1, D-13) — niche-aware optimal posting window from
   *  niche_post_windows (materialized aggregate refreshed daily by pg_cron).
   *  - OptimalPostWindow with source='niche' when DB lookup hits.
   *  - FALLBACK_POST_WINDOW (source='fallback') when niche unknown / not in
   *    the materialized table yet.
   *  - null on Supabase error (non-fatal per D-15) — P5 panel renders generic
   *    copy when null.
   *  Optional to preserve compile against existing consumers; aggregator
   *  always populates the field on Phase 1+ runs. */
  optimal_post_window?: OptimalPostWindow | null;
  /** Phase 6 (D-G1) — Full fingerprint match record or null if no match above threshold.
   *  Optional to preserve compile against existing consumers; plans 06-05/06-06 will start emitting it. */
  audio_fingerprint?: AudioFingerprintResult | null;
  /** Phase 6 (Note 7 / Q4 RESOLVED) — verbatim Gemini-emitted audio_description for
   *  persistence into analysis_results.audio_description (Plan 06-02 migration).
   *  Null when audio_signals absent. Sourced verbatim from
   *  geminiResult.analysis.audio_signals?.audio_description ?? null. */
  audio_description?: string | null;
  score_weights: {
    behavioral: number; // 0.35 (Phase 8 D-03b redistributed to 0.33)
    gemini: number; // 0.25 (Phase 8 D-03b redistributed to 0.24)
    ml: number; // 0.15 (Phase 8 D-03b redistributed to 0.14)
    rules: number; // 0.15 (Phase 8 D-03b redistributed to 0.14)
    trends: number; // 0.10
    /** Phase 6 (D-G1) — audio weight 0.07; redistributes when signal_availability.audio=false. */
    audio?: number;
    /** Phase 8 (D-03b) — 0.05 base; redistributed when SignalAvailability.retrieval = false. */
    retrieval?: number;
    /** Phase 9 — platform_fit weight; redistributed when SignalAvailability.platform_fit = false. */
    platform_fit?: number;
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

  /** Phase 7 (D-20) — null when Wave 3 below threshold (D-13). */
  persona_behavioral_aggregate: PersonaBehavioralAggregate | null;
  /** Phase 7 (D-09) — per-persona detail for M2 audience-viz. Empty array on fallback. */
  persona_simulation_results: PersonaSimulationResult[];

  // Phase 8 (D-11) — retrieval signal output
  retrieval_score: number | null;            // D-03 similarity-weighted bucket vote in [0,1]; null when availability.retrieval = false
  retrieval_evidence: RetrievalEvidenceItem[];  // D-02 shape, max 5 items

  // Phase 9 — platform fit score, self-critique, counterfactuals
  platform_fit?: PlatformFitResult | null;
  critique?: CritiqueResult | null;
  counterfactuals?: CounterfactualResult | null;

  // Phase 13 Plan 02 — Stage 11 full signal context (D-03).
  // Optional fields populated by aggregator from Wave 1 segmented results.
  // Stage 11 prompt builder reads these to construct the full signal context message.
  /** Hook decomposition from Wave 1 hook-segment analysis (HookDecomposition shape). */
  hook_decomposition?: HookDecomposition | null;
  /** Audio signals from Wave 1 Gemini audio analysis (GeminiAudioSignals shape). */
  audio_signals?: GeminiAudioSignals | null;
  /** Content-craft signals surfaced from the Omni Wave-1 analysis for the board's
   *  "Content craft" frame. Produced by the engine but historically dropped before
   *  persistence; the analyze route now stashes them into analysis_results.variants.craft
   *  (no migration). Optional to preserve compile against existing PredictionResult
   *  constructors (pipeline fallback, fixtures). */
  video_signals?: GeminiVideoSignals | null;
  cta_segment?: CtaSegmentResult | null;
  overall_impression?: string;
  content_summary?: string;
  /** Matched trends from trend enrichment stage. */
  matched_trends?: Array<{
    sound_name: string;
    velocity_score: number;
    trend_phase: string | null;
  }>;

  // Phase 3 (D-12) — additive, backwards-compatible. Pass 1 fields untouched.
  // null when Pass 2 < SUCCESS_THRESHOLD; consumers fall back to persona_behavioral_aggregate.
  weighted_completion_pct?: number | null;
  weighted_top_dropoff_t?: number | null;
  weighted_hook_score?: number | null;
  heatmap?: HeatmapPayload | null;
  /** Phase 02 (D-12) — submission intent, carried from analysis_results.mode.
   *  'score' | 'remix'. Optional to preserve compile against existing PredictionResult
   *  constructors; the board reads mode from the analysis_results row via select('*'). */
  mode?: "score" | "remix";
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
  // NEW Phase 5 (D-12) — per-segment availability from analyzeVideoSegmented.
  // PROVENANCE KEYS — must NOT be added to SCORE_WEIGHT_KEYS (Phase 4 Cross-File Constraint #3).
  // The existing `gemini` field becomes derived: gemini = gemini_hook || gemini_body || gemini_cta
  // (computed in aggregator — Plan 03 wires this; Plan 01 ships placeholders only).
  gemini_hook: boolean;
  gemini_body: boolean;
  gemini_cta: boolean;
  /**
   * Phase 7 (D-15) — true when persona_behavioral_aggregate !== null (≥7-of-10 personas succeeded).
   * WR-02: promoted from optional to required. Aggregator always sets this key from
   * `pipelineResult.personaBehavioralAggregate !== null`, so it is never absent on a
   * Phase 7+ PredictionResult. Downstream consumers and route persistence treat it as
   * guaranteed; the optional declaration was stale documentation that could let a future
   * regression silently elide the flag.
   */
  personas: boolean;
  // Phase 6 (D-G1) — weight-bearing: gates audio_perceptual_score contribution to overall_score.
  // Optional to preserve compile against existing aggregator; plans 06-05/06-06 emit it.
  audio?: boolean;
  // Phase 6 (D-G1) — provenance only: tracks whether pgvector returned a match; NOT in SCORE_WEIGHT_KEYS.
  // Optional to preserve compile against existing aggregator; plans 06-05/06-06 emit it.
  audio_fingerprint?: boolean;
  /**
   * NEW Phase 8 (D-10) — true when ≥1 match survives hierarchical relaxation AND
   * min_corpus_size gate passes (i.e., retrievalResult.score is non-null).
   * Weight-bearing — IS in SCORE_WEIGHT_KEYS.
   * Optional for back-compat with Phase 4/5/6/7 callsites that pre-date Phase 8;
   * aggregator + route always set it on Phase 8+ PredictionResult.
   */
  retrieval?: boolean;
  /** Phase 9 — platform_fit signal availability. True when V3 platform-fit run produced a non-null result. */
  platform_fit?: boolean;
  /** Phase 3 — true when pass2_aggregate_built (≥7/10 Pass 2 succeeded per D-06). */
  pass2_timeline?: boolean;
}

// Wave0Result now defined below as z.infer<typeof Wave0ResultSchema> — see Phase 4 block.

// PersonaSimulationResult moved BELOW BehavioralPredictionsSchema — Phase 7 (D-19)
// widens it into a Zod-derived schema that aliases PersonaBehavioralAggregate to
// BehavioralPredictions. See "Phase 7 — Persona Simulation Result Schemas" block.

/**
 * Stage 10 self-critique result (deterministic — see stage10-critique.ts).
 * `confidence_adjustment` is the only score-affecting output; `flags` are creator-cited
 * strings retained for a future "why we're unsure" surface. (`consistency_score` was
 * dropped 2026-05-31 — it had zero consumers and is trivially `10 − 2·flags.length`.)
 */
export interface CritiqueResult {
  flags: string[];
  confidence_adjustment: number;
}

/**
 * Phase 13 D-05 — counterfactual suggestion item with band-adaptive type.
 * - fix: concrete change needed (low + mid bands)
 * - stretch: ambitious enhancement (high band)
 * - reinforcement: what's already working well (mid + high bands)
 */
export interface CounterfactualSuggestionItem {
  type: "fix" | "stretch" | "reinforcement";
  headline: string;       // ≤ 80 chars
  detail: string;         // 1-2 sentences with specific expected outcome
  timestamp_ms: number;   // video timestamp in ms; 0 when unavailable
  signal_anchor: string;  // which signal this addresses
}

/**
 * Stage 11 counterfactuals result — Phase 13 Plan 02 rebuilt shape (D-05).
 * band: score band for adaptive rendering in SuggestionsSection.
 * suggestions: band-adaptive items (low=3 fix, mid=2+1, high=1+2-3).
 *
 * BREAKING CHANGE from Phase 9: old shape had `suggestions: Array<{change, timestamp_ms, expected_impact}>`.
 * Updated in Phase 13 Plan 02. Downstream consumers (results-panel, insights-section) updated in Task 2.3.
 */
export interface CounterfactualResult {
  band: "low" | "mid" | "high";
  suggestions: CounterfactualSuggestionItem[];
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
    // min(10): floor matches the smoke-test validation gate (10-300) and rules
    //   out empty/degenerate responses. max(280): aligned with the backfill +
    //   cron truncation cap (slice(0, 280)) — anything longer gets truncated
    //   downstream anyway, so accepting >280 invites silent data loss. Prompt
    //   asks for 50-150 chars; the band [10,280] is intentional slack for LLMs
    //   that don't honor exact char counts (06-REVIEW.md WR-05 — was min(1).max(300)).
    audio_description: z.string().min(10).max(280),
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
  video_signals: GeminiVideoSignalsSchema.nullable().optional(),
  // .nullable().optional() — accept both omitted-key and explicit-null (06-REVIEW.md WR-02):
  // if Gemini emits `audio_signals: null` instead of omitting the key, .optional()-only
  // rejects it and the whole video analysis falls through to fallback factors (not just
  // audio degradation). Both shapes degrade to the same `T | null | undefined` contract,
  // which downstream optional-chaining (`?.audio_description ?? null`) handles uniformly.
  audio_signals: GeminiAudioSignalsSchema.nullable().optional(),
});

export type GeminiAnalysis = z.infer<typeof GeminiResponseSchema>;

// GeminiVideoResponseSchema is the strict superset for video-mode responses:
// video_signals becomes REQUIRED (not optional). audio_signals remains optional
// for graceful degradation. Phase 5 D-13 also widens with hook_decomposition +
// cta_segment (both .optional().nullable() so makeGeminiAnalysis() factory at
// __tests__/factories.ts:22 continues to typecheck without modification).
export const GeminiVideoResponseSchema = GeminiResponseSchema.extend({
  video_signals: GeminiVideoSignalsSchema,
  audio_signals: GeminiAudioSignalsSchema.nullable().optional(),
  hook_decomposition: HookDecompositionZodSchema.optional().nullable(),
  cta_segment: CtaSegmentZodSchema.optional().nullable(),
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
  "comedy",
  "other",
] as const);

export type ContentTypeSlug = z.infer<typeof ContentTypeEnumSchema>;

export const Wave0ContentTypeResultSchema = z.object({
  type: ContentTypeEnumSchema,
  confidence: z.number().min(0).max(1),
  warning: z.enum(["mixed_content_detected", "low_confidence"]).optional(),
});
export type Wave0ContentTypeResult = z.infer<typeof Wave0ContentTypeResultSchema>;

// D-17 (Phase 13 Plan 03): niche folded into Gemini content-type call.
// New shape: flat { primary_slug, micro_slug, confidence } — replaces old DeepSeek
// { primary, sub, micro, confidence, source, warning } shape.
// Consumers updated: wave3.ts:113, retrieval/retrieval-stage.ts:105.
export const Wave0NicheResultSchema = z.object({
  primary_slug: z.string(),
  micro_slug: z.string().nullable(),
  confidence: z.number().min(0).max(1),
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
  // Optional: present on the Wave-3 PersonaBehavioralAggregate (drives the Audience
  // LOOP chip), absent on raw DeepSeek behavioral_predictions. Optional so the
  // DeepSeek v2 response still validates without emitting it.
  loop_pct: z.number().min(0).max(100).optional(),
  loop_percentile: z.string().optional(),
});

export type BehavioralPredictions = z.infer<typeof BehavioralPredictionsSchema>;

// =====================================================
// Phase 7 — Persona Simulation Result Schemas (D-19)
// Per CONTEXT D-02 + D-03: 10 archetypes total — 6 FYP behavioral + 4 specialized.
// Per CONTEXT D-19: widened shape adds archetype, slot_type, niche, reasoning.
// =====================================================

/**
 * WR-06: ARCHETYPES is the canonical source of truth (wave3/persona-registry.ts).
 * The previous duplicated `z.enum([...10 names...])` listing risked silent drift —
 * if someone added an 11th archetype to the registry but forgot to update the schema
 * (or vice versa), the wave3/aggregator.ts tie-break (`ARCHETYPES.indexOf(...)`) would
 * drift relative to the Zod schema. Test 8 (tie-break determinism) would still pass
 * against the inconsistent state. Now derived from ARCHETYPES so both stay in lockstep.
 *
 * Import is hoisted because TypeScript module evaluation processes imports before any
 * top-level code; persona-registry.ts only imports `type ContentTypeSlug` from this
 * module (erased at runtime), so the cycle is safe.
 */
export const PersonaArchetypeSchema = z.enum(ARCHETYPES);
export type PersonaArchetype = z.infer<typeof PersonaArchetypeSchema>;

export const PersonaSlotTypeSchema = z.enum([
  "fyp",
  "niche_deep",
  "loyalist",
  "cross_niche",
] as const);
export type PersonaSlotType = z.infer<typeof PersonaSlotTypeSchema>;

/** Wave 3 persona simulation result — Phase 7 fills with real V3 reactions (D-19). */
export const PersonaSimulationResultSchema = z.object({
  persona_id: z.string(),
  archetype: PersonaArchetypeSchema,
  slot_type: PersonaSlotTypeSchema,
  niche: z.string(),
  scroll_past_second: z.number().min(0),
  watch_through_pct: z.number().min(0).max(100),
  comment_intent: z.number().min(0).max(100),
  share_intent: z.number().min(0).max(100),
  save_intent: z.number().min(0).max(100),
  /** Replay/loop intent (0-100) — aggregated into PersonaBehavioralAggregate.loop_pct. */
  rewatch_intent: z.number().min(0).max(100),
  /** Pitfall 5: required non-empty — LLMs occasionally omit reasoning under token-budget pressure. */
  reasoning: z.string().min(1).max(500),
});
export type PersonaSimulationResult = z.infer<typeof PersonaSimulationResultSchema>;

/**
 * Phase 7 D-19 alias — distinguish at type level from raw BehavioralPredictions.
 * Aggregator (Plan 07-02's wave3/aggregator.ts) returns this; PredictionResult will surface as
 * `persona_behavioral_aggregate: PersonaBehavioralAggregate | null` (Plan 07-02 widens PredictionResult).
 */
export type PersonaBehavioralAggregate = BehavioralPredictions;

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
// Phase 8 — Benchmark Retrieval (pgvector) Schemas
// Per CONTEXT D-02 (evidence item shape) + D-03 (result shape) + D-10/D-11
// (SignalAvailability + PredictionResult extensions below).
// =====================================================

/**
 * Phase 8 — Retrieval Evidence Item (D-02).
 * One record per item returned by runBenchmarkRetrieval. Rich shape so M2's
 * "similar videos" panel can render without further DB joins.
 *
 * Persisted to analysis_results.retrieval_evidence JSONB column (D-11).
 */
export const RetrievalEvidenceItemSchema = z.object({
  source_pool: z.enum(["training_corpus", "scraped_videos"]),
  source_id: z.string().uuid(),
  similarity_score: z.number().min(0).max(1),
  video_url: z.string().nullable(),
  creator_handle: z.string().nullable(),
  caption_snippet: z.string().nullable(),
  views: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative().nullable(),
  hashtags: z.array(z.string()),
  posted_at: z.string().nullable(),
  bucket_label: z.enum(["viral", "average", "under"]),
  bucket_source: z.enum(["corpus", "derived"]),
  relaxed_to: z.enum(["strict", "niche+platform", "niche_only"]).nullable(),
});
export type RetrievalEvidenceItem = z.infer<typeof RetrievalEvidenceItemSchema>;

/**
 * Phase 8 — Benchmark Retrieval Result (return shape of runBenchmarkRetrieval).
 *
 * evidence: max 5 items, may be empty
 * score: D-03 similarity-weighted bucket vote in [0,1]; null when zero matches
 *        OR min_corpus_size gate fails (D-04b)
 * availability: SignalAvailability.retrieval value (true when score is non-null)
 * cost_cents: telemetry for stage_end event (D-15)
 */
export const BenchmarkRetrievalResultSchema = z.object({
  evidence: z.array(RetrievalEvidenceItemSchema).max(5),
  score: z.number().min(0).max(1).nullable(),
  availability: z.boolean(),
  cost_cents: z.number().nonnegative(),
});
export type BenchmarkRetrievalResult = z.infer<typeof BenchmarkRetrievalResultSchema>;

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

// =====================================================
// Phase 9 — Platform Fit, Self-Critique, Counterfactuals
// =====================================================

/**
 * Platform fit result — how well content matches a platform's algorithmic preferences.
 * Produced by runPlatformFit() in wave4/platform-fit.ts (Plan 09-03).
 */
export const PlatformFitResultSchema = z.object({
  platform: z.string(),
  fit_score: z.number().min(0).max(100),
  rationale: z.string(),
  watermark_penalty: z.boolean().optional(),
});
export type PlatformFitResult = z.infer<typeof PlatformFitResultSchema>;
