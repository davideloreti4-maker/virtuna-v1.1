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
  score_weights: {
    behavioral: number; // 0.35
    gemini: number; // 0.25
    ml: number; // 0.15
    rules: number; // 0.15
    trends: number; // 0.10
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
  /**
   * Phase 7 (D-15) — true when persona_behavioral_aggregate !== null (≥7-of-10 personas succeeded).
   * OPTIONAL in Plan 07-01 because aggregator.ts wiring lands in Plan 07-02 (per plan scope: "Zero changes to aggregator.ts").
   * Plan 07-02 will (a) wire it on the aggregator's `availability` object, and (b) consider promoting this
   * key to required once the aggregator path is exercised by tests.
   */
  personas?: boolean;
}

// Wave0Result now defined below as z.infer<typeof Wave0ResultSchema> — see Phase 4 block.

// PersonaSimulationResult moved BELOW BehavioralPredictionsSchema — Phase 7 (D-19)
// widens it into a Zod-derived schema that aliases PersonaBehavioralAggregate to
// BehavioralPredictions. See "Phase 7 — Persona Simulation Result Schemas" block.

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

export const GeminiResponseSchema = z.object({
  factors: z.array(FactorSchema).length(5),
  overall_impression: z.string(),
  content_summary: z.string(),
  video_signals: GeminiVideoSignalsSchema.optional(),
});

export type GeminiAnalysis = z.infer<typeof GeminiResponseSchema>;

export const GeminiVideoResponseSchema = GeminiResponseSchema.extend({
  video_signals: GeminiVideoSignalsSchema,
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

// =====================================================
// Phase 7 — Persona Simulation Result Schemas (D-19)
// Per CONTEXT D-02 + D-03: 10 archetypes total — 6 FYP behavioral + 4 specialized.
// Per CONTEXT D-19: widened shape adds archetype, slot_type, niche, reasoning.
// =====================================================

export const PersonaArchetypeSchema = z.enum([
  "high_engager",
  "saver",
  "lurker",
  "sharer",
  "tough_crowd",
  "purposeful_viewer",
  "niche_deep_buyer",
  "niche_deep_scout",
  "loyalist",
  "cross_niche_curiosity",
] as const);
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
