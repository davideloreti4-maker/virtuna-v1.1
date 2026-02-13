import type {
  ConfidenceLevel,
  DeepSeekReasoning,
  Factor,
  GeminiAnalysis,
  PredictionResult,
  RuleScoreResult,
  TrendEnrichment,
} from "./types";
import { GEMINI_MODEL } from "./gemini";
import { DEEPSEEK_MODEL } from "./deepseek";

export const ENGINE_VERSION = "1.0.0";

const SCORE_WEIGHTS = { rule: 0.5, trend: 0.3, ml: 0.2 };

/**
 * Determine confidence level based on data quality signals
 */
function determineConfidence(
  ruleResult: RuleScoreResult,
  trendEnrichment: TrendEnrichment,
  hasDeepSeek: boolean,
  deepseekReasoning?: string
): ConfidenceLevel {
  let score = 0;

  // More matched rules = higher confidence
  if (ruleResult.matched_rules.length >= 5) score += 0.3;
  else if (ruleResult.matched_rules.length >= 3) score += 0.2;
  else score += 0.1;

  // Trend data available
  if (trendEnrichment.matched_trends.length > 0) score += 0.2;
  else score += 0.05;

  // DeepSeek reasoning adds confidence
  if (hasDeepSeek) score += 0.4;
  else score += 0.1;

  // Confidence reasoning quality
  if (deepseekReasoning && deepseekReasoning.length > 50) score += 0.1;

  if (score >= 0.8) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

/**
 * Map Gemini factor scores to standard Factor type
 */
function mapGeminiFactors(gemini: GeminiAnalysis): Factor[] {
  return gemini.factors.map((f, i) => ({
    id: `factor-${i + 1}`,
    name: f.name,
    score: f.score,
    max_score: 10,
    description: f.description,
    tips: f.tips,
  }));
}

/**
 * Aggregate all signals into a PredictionResult (ENGINE-06)
 *
 * Weighted combination: rule_score * 0.5 + trend_score * 0.3 + ml_score * 0.2
 * ml_score defaults to rule_score until ML pipeline is active (Phase 7)
 */
export function aggregateScores(
  geminiAnalysis: GeminiAnalysis,
  ruleResult: RuleScoreResult,
  trendEnrichment: TrendEnrichment,
  deepseekResult: { reasoning: DeepSeekReasoning; cost_cents: number } | null,
  geminiCostCents: number,
  latencyMs: number
): PredictionResult {
  const hasDeepSeek = deepseekResult !== null;
  const deepseek = deepseekResult?.reasoning;

  // ml_score defaults to rule_score until ML is active
  const mlScore = ruleResult.rule_score;

  // Weighted overall score
  const weightedScore =
    ruleResult.rule_score * SCORE_WEIGHTS.rule +
    trendEnrichment.trend_score * SCORE_WEIGHTS.trend +
    mlScore * SCORE_WEIGHTS.ml;

  // If DeepSeek provided a refined score, blend it
  const overallScore = deepseek
    ? Math.round(weightedScore * 0.6 + deepseek.refined_score * 0.4)
    : Math.round(weightedScore);

  const confidence = determineConfidence(
    ruleResult,
    trendEnrichment,
    hasDeepSeek,
    deepseek?.confidence_reasoning
  );

  // Factors from Gemini
  const factors = mapGeminiFactors(geminiAnalysis);

  // Ensure exactly 5 factors
  while (factors.length < 5) {
    factors.push({
      id: `factor-${factors.length + 1}`,
      name: "Content Quality",
      score: 5,
      max_score: 10,
      description: "General content quality assessment",
      tips: ["Focus on improving specific aspects of your content"],
    });
  }

  // Suggestions from DeepSeek or fallback
  const suggestions = deepseek
    ? deepseek.suggestions.map((s, i) => ({
        id: `suggestion-${i + 1}`,
        ...s,
      }))
    : [
        {
          id: "suggestion-1",
          text: "Consider adding a stronger hook in the opening line",
          priority: "high" as const,
          category: "hook",
        },
        {
          id: "suggestion-2",
          text: "Include a clear call to action",
          priority: "medium" as const,
          category: "content",
        },
        {
          id: "suggestion-3",
          text: "Experiment with trending formats for your niche",
          priority: "medium" as const,
          category: "format",
        },
      ];

  // Persona reactions from DeepSeek or fallback
  const persona_reactions = deepseek
    ? deepseek.persona_reactions.map((p) => ({
        ...p,
      }))
    : [
        { persona_name: "Gen-Z Creator", quote: "This has potential but needs more personality", sentiment: "neutral" as const, resonance_score: 5 },
        { persona_name: "Marketing Pro", quote: "Solid structure, could use data backing", sentiment: "positive" as const, resonance_score: 6 },
        { persona_name: "Casual Scroller", quote: "Would I stop scrolling? Maybe...", sentiment: "neutral" as const, resonance_score: 5 },
        { persona_name: "Niche Expert", quote: "Decent topic coverage for the space", sentiment: "positive" as const, resonance_score: 6 },
        { persona_name: "The Skeptic", quote: "I've seen better takes on this", sentiment: "negative" as const, resonance_score: 4 },
      ];

  // Variants from DeepSeek or fallback
  const variants = deepseek
    ? deepseek.variants.map((v, i) => ({
        id: `variant-${i + 1}`,
        type: "rewritten" as const,
        ...v,
      }))
    : [
        {
          id: "variant-1",
          type: "rewritten" as const,
          content: "A stronger version would be generated by DeepSeek R1 (currently unavailable)",
          predicted_score: overallScore + 5,
          label: "Enhanced Version",
        },
      ];

  // Conversation themes from DeepSeek or empty
  const conversation_themes = deepseek
    ? deepseek.conversation_themes.map((t, i) => ({
        id: `theme-${i + 1}`,
        ...t,
      }))
    : [];

  const totalCost = geminiCostCents + (deepseekResult?.cost_cents ?? 0);

  return {
    overall_score: Math.min(100, Math.max(0, overallScore)),
    confidence,
    factors,
    suggestions,
    persona_reactions,
    variants,
    conversation_themes,
    rule_score: ruleResult.rule_score,
    trend_score: trendEnrichment.trend_score,
    ml_score: mlScore,
    score_weights: SCORE_WEIGHTS,
    latency_ms: latencyMs,
    cost_cents: Math.round(totalCost * 10000) / 10000,
    engine_version: ENGINE_VERSION,
    gemini_model: GEMINI_MODEL,
    deepseek_model: hasDeepSeek ? DEEPSEEK_MODEL : null,
  };
}
