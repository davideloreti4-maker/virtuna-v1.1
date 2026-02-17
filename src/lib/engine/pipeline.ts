import { createServiceClient } from "@/lib/supabase/service";
import {
  AnalysisInputSchema,
  type AnalysisInput,
  type ContentPayload,
  type GeminiAnalysis,
  type DeepSeekReasoning,
  type RuleScoreResult,
  type TrendEnrichment,
} from "./types";
import { normalizeInput } from "./normalize";
import { analyzeWithGemini } from "./gemini";
import { reasonWithDeepSeek } from "./deepseek";
import { loadActiveRules, scoreContentAgainstRules } from "./rules";
import { enrichWithTrends } from "./trends";
import {
  fetchCreatorContext,
  formatCreatorContext,
  type CreatorContext,
} from "./creator";

// =====================================================
// Pipeline Types
// =====================================================

export interface StageTiming {
  stage: string;
  duration_ms: number;
}

export interface PipelineResult {
  // Stage outputs
  payload: ContentPayload;
  geminiResult: { analysis: GeminiAnalysis; cost_cents: number };
  creatorContext: CreatorContext;
  ruleResult: RuleScoreResult;
  trendEnrichment: TrendEnrichment;
  deepseekResult: { reasoning: DeepSeekReasoning; cost_cents: number } | null;
  audioResult: null; // Placeholder for Phase 11

  // Pipeline metadata
  timings: StageTiming[];
  total_duration_ms: number;
  warnings: string[]; // Pipeline-level warnings from partial failures (INFRA-03)
}

// =====================================================
// Timing helper
// =====================================================

/**
 * Wrap an async operation with timing capture.
 * Records stage name and duration to the provided timings array.
 */
async function timed<T>(
  name: string,
  timings: StageTiming[],
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  timings.push({
    stage: name,
    duration_ms: Math.round(performance.now() - start),
  });
  return result;
}

// =====================================================
// Default fallback values for non-critical stages
// =====================================================

const DEFAULT_CREATOR_CONTEXT: CreatorContext = {
  found: false,
  follower_count: null,
  avg_views: null,
  engagement_rate: null,
  niche: null,
  posting_frequency: null,
  platform_averages: {
    avg_views: 50000,
    avg_engagement_rate: 0.06,
    avg_share_rate: 0.008,
    avg_comment_rate: 0.005,
  },
};

const DEFAULT_RULE_RESULT: RuleScoreResult = {
  rule_score: 50,
  matched_rules: [],
};

const DEFAULT_TREND_ENRICHMENT: TrendEnrichment = {
  trend_score: 0,
  matched_trends: [],
  trend_context: "Trend data unavailable.",
  hashtag_relevance: 0,
};

// =====================================================
// 10-Stage Prediction Pipeline with Wave Parallelism
// =====================================================

/**
 * Run the full 10-stage prediction pipeline.
 *
 * Architecture:
 * 1. Validate     -- Parse input with AnalysisInputSchema
 * 2. Normalize    -- Convert AnalysisInput to ContentPayload
 * 3. Wave 1 (parallel):
 *    - Stage 3: Gemini Analysis (CRITICAL -- throws on failure)
 *    - Stage 4: Audio Analysis (placeholder)
 *    - Stage 5: Creator Context (non-critical -- fallback with warning)
 *    - Stage 6: Rule Loading + Scoring (non-critical -- fallback with warning)
 * 4. Wave 2 (parallel):
 *    - Stage 7: DeepSeek Reasoning (CRITICAL -- throws on failure)
 *    - Stage 8: Trend Enrichment (non-critical -- fallback with warning)
 * 5. Stage 9: Aggregate (delegated to caller in Plan 02)
 * 6. Stage 10: Finalize (attach metadata)
 *
 * INFRA-03: Non-critical stages (Creator, Rules, Trends) fail gracefully
 * with fallback values and pipeline warnings. Gemini and DeepSeek are
 * critical -- their failure halts the pipeline.
 */
export async function runPredictionPipeline(
  input: AnalysisInput
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const timings: StageTiming[] = [];
  const warnings: string[] = [];

  // -------------------------------------------------------
  // Stage 1: Validate
  // -------------------------------------------------------
  const validated = await timed("validate", timings, async () => {
    try {
      return AnalysisInputSchema.parse(input);
    } catch (error) {
      throw new Error(
        `Analysis failed: input validation — ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // -------------------------------------------------------
  // Stage 2: Normalize
  // -------------------------------------------------------
  const payload = await timed("normalize", timings, async () => {
    try {
      return normalizeInput(validated);
    } catch (error) {
      throw new Error(
        `Analysis failed: input normalization — ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Single service client for this pipeline run
  const supabase = createServiceClient();

  // -------------------------------------------------------
  // Wave 1: Gemini (critical) + Audio + Creator + Rules (non-critical)
  // -------------------------------------------------------

  // Stage 3: Gemini Analysis -- CRITICAL (throws on failure)
  const geminiPromise = timed("gemini_analysis", timings, async () => {
    try {
      return await analyzeWithGemini(validated);
    } catch (error) {
      throw new Error(
        `Analysis failed: Gemini content analysis — ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Stage 4: Audio Analysis (placeholder for Phase 11)
  const audioPromise = timed("audio_analysis", timings, async () => null);

  // Stage 5: Creator Context -- NON-CRITICAL (fallback with warning)
  const creatorPromise = (async (): Promise<CreatorContext> => {
    try {
      return await timed("creator_context", timings, () =>
        fetchCreatorContext(supabase, payload.creator_handle, payload.niche)
      );
    } catch (error) {
      warnings.push(
        `Creator context unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "creator_context", duration_ms: 0 });
      return DEFAULT_CREATOR_CONTEXT;
    }
  })();

  // Stage 6: Rule Loading + Scoring -- NON-CRITICAL (fallback with warning)
  const rulePromise = (async (): Promise<RuleScoreResult> => {
    try {
      return await timed("rule_scoring", timings, async () => {
        const rules = await loadActiveRules(supabase, payload.content_type);
        return scoreContentAgainstRules(payload.content_text, rules);
      });
    } catch (error) {
      warnings.push(
        `Rule scoring unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "rule_scoring", duration_ms: 0 });
      return DEFAULT_RULE_RESULT;
    }
  })();

  // Run Wave 1 in parallel -- Gemini throws, others gracefully degrade
  const [geminiResult, audioResult, creatorContext, ruleResult] = await timed(
    "wave_1",
    timings,
    () => Promise.all([geminiPromise, audioPromise, creatorPromise, rulePromise])
  );

  // Format creator context for DeepSeek prompt injection
  const creatorContextString = formatCreatorContext(creatorContext);

  // -------------------------------------------------------
  // Wave 2: DeepSeek (critical) + Trends (non-critical)
  // -------------------------------------------------------

  // Stage 7: DeepSeek Reasoning -- CRITICAL (throws on failure)
  const deepseekPromise = timed("deepseek_reasoning", timings, async () => {
    try {
      const result = await reasonWithDeepSeek({
        input: validated,
        gemini_analysis: geminiResult.analysis,
        rule_result: ruleResult,
        trend_enrichment: {
          // Trend enrichment runs in parallel -- use empty placeholder for DeepSeek prompt.
          // The final trend data will be in the pipeline result for the aggregator.
          trend_score: 0,
          matched_trends: [],
          trend_context:
            "Trend analysis running in parallel — results available in pipeline output.",
          hashtag_relevance: 0,
        },
        creator_context: creatorContextString,
      });

      // Per user decision: all stages are required. Circuit breaker returning null
      // means service is unavailable -- this is a stage failure.
      if (result === null) {
        throw new Error(
          "service temporarily unavailable (circuit breaker open)"
        );
      }

      return result;
    } catch (error) {
      throw new Error(
        `Analysis failed: DeepSeek reasoning — ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Stage 8: Trend Enrichment -- NON-CRITICAL (fallback with warning)
  const trendPromise = (async (): Promise<TrendEnrichment> => {
    try {
      return await timed("trend_enrichment", timings, () =>
        enrichWithTrends(supabase, validated)
      );
    } catch (error) {
      warnings.push(
        `Trend enrichment unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "trend_enrichment", duration_ms: 0 });
      return DEFAULT_TREND_ENRICHMENT;
    }
  })();

  // Run Wave 2 in parallel -- DeepSeek throws, trends gracefully degrade
  const [deepseekRaw, trendEnrichment] = await timed("wave_2", timings, () =>
    Promise.all([deepseekPromise, trendPromise])
  );

  // -------------------------------------------------------
  // Stage 9: Aggregate (delegated -- caller uses PipelineResult)
  // -------------------------------------------------------
  // The pipeline returns raw stage outputs. The API route (Plan 02)
  // calls aggregateScores with these outputs. This separates
  // orchestration (pipeline) from scoring (aggregator).

  // -------------------------------------------------------
  // Stage 10: Finalize -- attach metadata
  // -------------------------------------------------------
  const total_duration_ms = Math.round(performance.now() - pipelineStart);

  return {
    payload,
    geminiResult,
    creatorContext,
    ruleResult,
    trendEnrichment,
    deepseekResult: deepseekRaw,
    audioResult,
    timings,
    total_duration_ms,
    warnings,
  };
}
