import { z } from "zod";

// =====================================================
// Engine Input
// =====================================================

export const AnalysisInputSchema = z.object({
  content_text: z.string().min(1),
  content_type: z.enum([
    "post",
    "reel",
    "story",
    "video",
    "thread",
  ]),
  society_id: z.string().optional(),
  image_url: z.string().url().optional(),
});

export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

// =====================================================
// Engine Output Components
// =====================================================

export interface Factor {
  id: string;
  name: string;
  score: number; // 0-10
  max_score: number;
  description: string;
  tips: string[];
}

export interface Suggestion {
  id: string;
  text: string;
  priority: "high" | "medium" | "low";
  category: string;
}

/**
 * @deprecated Remove in Phase 5 cleanup. Persona reactions deferred to Phase 5/8.
 * Still referenced by PredictionResult and aggregator.
 */
export interface PersonaReaction {
  persona_name: string;
  quote: string;
  sentiment: "positive" | "neutral" | "negative";
  resonance_score: number; // 0-10
}

/**
 * @deprecated Remove in Phase 5 cleanup. Variants are dead v1 output.
 * Still referenced by PredictionResult, aggregator, and UI components.
 */
export interface Variant {
  id: string;
  type: "original" | "rewritten";
  content: string;
  predicted_score: number; // 0-100
  label: string;
}

/**
 * @deprecated Remove in Phase 5 cleanup. Conversation themes are dead v1 output.
 * Still referenced by PredictionResult, aggregator, and UI components.
 */
export interface ConversationTheme {
  id: string;
  title: string;
  percentage: number;
  description: string;
}

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

// =====================================================
// Full Prediction Result (ENGINE-11)
// =====================================================

export interface PredictionResult {
  overall_score: number; // 0-100
  confidence: ConfidenceLevel;
  factors: Factor[];
  suggestions: Suggestion[];
  persona_reactions: PersonaReaction[];
  variants: Variant[];
  conversation_themes: ConversationTheme[];
  rule_score: number;
  trend_score: number;
  ml_score: number;
  score_weights: { rule: number; trend: number; ml: number };
  latency_ms: number;
  cost_cents: number;
  engine_version: string;
  gemini_model: string;
  deepseek_model: string | null;
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

/**
 * @deprecated Remove in Phase 5 cleanup. PersonaReactionSchema removed from DeepSeek v2.
 * Kept temporarily for aggregator backward compatibility.
 */
export const PersonaReactionSchema = z.object({
  persona_name: z.string(),
  quote: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  resonance_score: z.number().min(0).max(10),
});

export const SuggestionSchema = z.object({
  text: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.string(),
});

/**
 * @deprecated Remove in Phase 5 cleanup. VariantSchema removed from DeepSeek v2.
 * Kept temporarily for aggregator backward compatibility.
 */
export const VariantSchema = z.object({
  content: z.string(),
  predicted_score: z.number().min(0).max(100),
  label: z.string(),
});

/**
 * @deprecated Remove in Phase 5 cleanup. ConversationThemeSchema removed from DeepSeek v2.
 * Kept temporarily for aggregator backward compatibility.
 */
export const ConversationThemeSchema = z.object({
  title: z.string(),
  percentage: z.number().min(0).max(100),
  description: z.string(),
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
}
