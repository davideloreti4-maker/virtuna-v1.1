import { createServiceClient } from "@/lib/supabase/service";
import { AnalysisInputSchema, type AnalysisInput, type PredictionResult } from "./types";
import { analyzeWithGemini } from "./gemini";
import { reasonWithDeepSeek } from "./deepseek";
import { loadActiveRules, scoreContentAgainstRules } from "./rules";
import { enrichWithTrends } from "./trends";
import { aggregateScores } from "./aggregator";

/**
 * Run the full prediction pipeline (ENGINE-03)
 *
 * Orchestration:
 * 1. Validate input (Zod)
 * 2. Parallel: Gemini analysis + rule loading/scoring + trend enrichment
 * 3. Sequential: DeepSeek reasoning with all collected context
 * 4. Aggregate all signals into PredictionResult
 */
export async function runPredictionPipeline(
  input: AnalysisInput
): Promise<PredictionResult> {
  const start = performance.now();

  // 1. Validate input
  const validated = AnalysisInputSchema.parse(input);

  // Single service client for this pipeline run
  const supabase = createServiceClient();

  // 2. Parallel: Gemini + rules + trends
  const [geminiResult, rules, trendEnrichment] = await Promise.all([
    analyzeWithGemini(validated),
    loadActiveRules(supabase, validated.content_type),
    enrichWithTrends(supabase, validated),
  ]);

  // Score content against loaded rules
  const ruleResult = await scoreContentAgainstRules(
    validated.content_text,
    rules
  );

  // 3. Sequential: DeepSeek reasoning (returns null if circuit breaker open)
  const deepseekResult = await reasonWithDeepSeek({
    input: validated,
    gemini_analysis: geminiResult.analysis,
    rule_result: ruleResult,
    trend_enrichment: trendEnrichment,
  });

  // 4. Aggregate all signals
  const latencyMs = Math.round(performance.now() - start);

  return aggregateScores(
    geminiResult.analysis,
    ruleResult,
    trendEnrichment,
    deepseekResult,
    geminiResult.cost_cents,
    latencyMs,
  );
}
