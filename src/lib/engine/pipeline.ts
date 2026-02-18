import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createLogger } from "@/lib/logger";
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
  audioResult: null; // Audio analysis handled via fuzzy matching in trend enrichment -- no separate stage needed

  // Pipeline metadata
  requestId: string;
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

const DEFAULT_GEMINI_RESULT: PipelineResult["geminiResult"] = {
  analysis: {
    factors: [
      {
        name: "Scroll-Stop Power",
        score: 0,
        rationale: "Analysis unavailable",
        improvement_tip: "N/A",
      },
      {
        name: "Completion Pull",
        score: 0,
        rationale: "Analysis unavailable",
        improvement_tip: "N/A",
      },
      {
        name: "Rewatch Potential",
        score: 0,
        rationale: "Analysis unavailable",
        improvement_tip: "N/A",
      },
      {
        name: "Share Trigger",
        score: 0,
        rationale: "Analysis unavailable",
        improvement_tip: "N/A",
      },
      {
        name: "Emotional Charge",
        score: 0,
        rationale: "Analysis unavailable",
        improvement_tip: "N/A",
      },
    ],
    overall_impression:
      "Content analysis unavailable — external AI service error.",
    content_summary: "Unable to analyze content at this time.",
  },
  cost_cents: 0,
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
 *    - Stage 3: Gemini Analysis (non-critical -- fallback with warning, HARD-03)
 *    - Stage 4: Audio Analysis (placeholder)
 *    - Stage 5: Creator Context (non-critical -- fallback with warning)
 *    - Stage 6: Rule Loading + Scoring (non-critical -- fallback with warning)
 * 4. Wave 2 (parallel):
 *    - Stage 7: DeepSeek Reasoning (non-critical -- Gemini fallback, then weight redistribution)
 *    - Stage 8: Trend Enrichment (non-critical -- fallback with warning)
 * 5. Stage 9: Aggregate (delegated to caller in Plan 02)
 * 6. Stage 10: Finalize (attach metadata)
 *
 * INFRA-03: Non-critical stages (Creator, Rules, Trends, DeepSeek) fail
 * gracefully with fallback values and pipeline warnings. DeepSeek has a
 * Gemini fallback before degrading to null.
 * HARD-03: Gemini also degrades gracefully with zero-score fallback.
 * No stage is fatal — pipeline always produces a result.
 */
export async function runPredictionPipeline(
  input: AnalysisInput,
  opts?: { requestId?: string }
): Promise<PipelineResult> {
  const requestId = opts?.requestId ?? nanoid(12);
  const log = createLogger({ requestId, module: "pipeline" });
  log.info("Pipeline started", { input_mode: input.input_mode });

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
      Sentry.captureException(error, {
        tags: { stage: "validate", requestId },
      });
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
      Sentry.captureException(error, {
        tags: { stage: "normalize", requestId },
      });
      throw new Error(
        `Analysis failed: input normalization — ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Single service client for this pipeline run
  const supabase = createServiceClient();

  // -------------------------------------------------------
  // Wave 1: Gemini + Audio + Creator + Rules (all non-critical, HARD-03)
  // -------------------------------------------------------

  // Stage 3: Gemini Analysis -- NON-CRITICAL (fallback with warning — HARD-03)
  const geminiPromise = (async (): Promise<PipelineResult["geminiResult"]> => {
    try {
      return await timed("gemini_analysis", timings, () =>
        analyzeWithGemini(validated)
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: { stage: "gemini_analysis", requestId },
      });
      warnings.push(
        `Gemini analysis unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "gemini_analysis", duration_ms: 0 });
      return DEFAULT_GEMINI_RESULT;
    }
  })();

  // Stage 4: Audio Analysis (handled via fuzzy matching in trend enrichment -- no separate stage)
  const audioPromise = timed("audio_analysis", timings, async () => null);

  // Stage 5: Creator Context -- NON-CRITICAL (fallback with warning)
  const creatorPromise = (async (): Promise<CreatorContext> => {
    try {
      return await timed("creator_context", timings, () =>
        fetchCreatorContext(supabase, payload.creator_handle, payload.niche)
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: { stage: "creator_context", requestId },
      });
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
      Sentry.captureException(error, {
        tags: { stage: "rule_scoring", requestId },
      });
      warnings.push(
        `Rule scoring unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "rule_scoring", duration_ms: 0 });
      return DEFAULT_RULE_RESULT;
    }
  })();

  // Run Wave 1 in parallel -- all stages gracefully degrade (HARD-03)
  const [geminiResult, audioResult, creatorContext, ruleResult] = await timed(
    "wave_1",
    timings,
    () => Promise.all([geminiPromise, audioPromise, creatorPromise, rulePromise])
  );

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 1 complete",
    level: "info",
    data: { requestId, stages: ["gemini", "audio", "creator", "rules"] },
  });

  // Format creator context for DeepSeek prompt injection
  const creatorContextString = formatCreatorContext(creatorContext);

  // -------------------------------------------------------
  // Wave 2: DeepSeek (non-critical, Gemini fallback) + Trends (non-critical)
  // -------------------------------------------------------

  // Stage 7: DeepSeek Reasoning -- NON-CRITICAL (has Gemini fallback; degrades gracefully as last resort)
  const deepseekPromise = (async (): Promise<{
    reasoning: DeepSeekReasoning;
    cost_cents: number;
  } | null> => {
    try {
      return await timed("deepseek_reasoning", timings, async () => {
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

        return result;
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { stage: "deepseek_reasoning", requestId },
      });
      warnings.push(
        `DeepSeek reasoning unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "deepseek_reasoning", duration_ms: 0 });
      return null;
    }
  })();

  // Stage 8: Trend Enrichment -- NON-CRITICAL (fallback with warning)
  const trendPromise = (async (): Promise<TrendEnrichment> => {
    try {
      return await timed("trend_enrichment", timings, () =>
        enrichWithTrends(supabase, validated)
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: { stage: "trend_enrichment", requestId },
      });
      warnings.push(
        `Trend enrichment unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "trend_enrichment", duration_ms: 0 });
      return DEFAULT_TREND_ENRICHMENT;
    }
  })();

  // Run Wave 2 in parallel -- both stages gracefully degrade
  const [deepseekRaw, trendEnrichment] = await timed("wave_2", timings, () =>
    Promise.all([deepseekPromise, trendPromise])
  );

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 2 complete",
    level: "info",
    data: { requestId, stages: ["deepseek", "trends"] },
  });

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

  const total_cost_cents =
    (geminiResult.cost_cents ?? 0) + (deepseekRaw?.cost_cents ?? 0);
  log.info("Pipeline complete", {
    stage: "pipeline",
    duration_ms: total_duration_ms,
    cost_cents: +total_cost_cents.toFixed(4),
    warnings_count: warnings.length,
  });

  return {
    payload,
    geminiResult,
    creatorContext,
    ruleResult,
    trendEnrichment,
    deepseekResult: deepseekRaw,
    audioResult,
    requestId,
    timings,
    total_duration_ms,
    warnings,
  };
}
