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

export interface PersonaReaction {
  persona_name: string;
  quote: string;
  sentiment: "positive" | "neutral" | "negative";
  resonance_score: number; // 0-10
}

export interface Variant {
  id: string;
  type: "original" | "rewritten";
  content: string;
  predicted_score: number; // 0-100
  label: string;
}

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
  description: z.string(),
  tips: z.array(z.string()).default([]),
});

export const GeminiResponseSchema = z.object({
  factors: z.array(FactorSchema).min(1),
  overall_impression: z.string(),
  content_summary: z.string(),
  hook_strength: z.number().min(0).max(10),
  emotional_resonance: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  originality: z.number().min(0).max(10),
  call_to_action: z.number().min(0).max(10),
});

export type GeminiAnalysis = z.infer<typeof GeminiResponseSchema>;

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

export const VariantSchema = z.object({
  content: z.string(),
  predicted_score: z.number().min(0).max(100),
  label: z.string(),
});

export const ConversationThemeSchema = z.object({
  title: z.string(),
  percentage: z.number().min(0).max(100),
  description: z.string(),
});

export const DeepSeekResponseSchema = z.object({
  persona_reactions: z.array(PersonaReactionSchema).min(1),
  suggestions: z.array(SuggestionSchema).min(1),
  variants: z.array(VariantSchema).min(1),
  conversation_themes: z.array(ConversationThemeSchema).default([]),
  refined_score: z.number().min(0).max(100),
  confidence_reasoning: z.string(),
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
