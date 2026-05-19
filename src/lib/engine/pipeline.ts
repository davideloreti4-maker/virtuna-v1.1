import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createLogger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import {
  AnalysisInputSchema,
  type AnalysisInput,
  type AudioFingerprintResult,
  type ContentPayload,
  type GeminiAnalysis,
  type DeepSeekReasoning,
  type PipelineAudioFingerprintFields,
  type RuleScoreResult,
  type TrendEnrichment,
  type Wave0Result,
  type PersonaSimulationResult,
} from "./types";
import { normalizeInput } from "./normalize";
import { analyzeWithGemini, analyzeVideoWithGemini } from "./gemini";
import { matchAudioFingerprint } from "./audio-fingerprint";
import { reasonWithDeepSeek } from "./deepseek";
import { loadActiveRules, scoreContentAgainstRules } from "./rules";
import { enrichWithTrends } from "./trends";
import {
  fetchCreatorContext,
  formatCreatorContext,
  type CreatorContext,
} from "./creator";
import type { StageEventCallback, StageEventWave } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { runWave0 } from "./wave0";
import { runWave3 } from "./wave3";

// =====================================================
// Pipeline Types
// =====================================================

export interface StageTiming {
  stage: string;
  duration_ms: number;
}

export interface PipelineResult extends PipelineAudioFingerprintFields {
  // Stage outputs
  payload: ContentPayload;
  geminiResult: { analysis: GeminiAnalysis; cost_cents: number };
  creatorContext: CreatorContext;
  ruleResult: RuleScoreResult;
  trendEnrichment: TrendEnrichment;
  deepseekResult: { reasoning: DeepSeekReasoning; cost_cents: number } | null;
  // Phase 6 (D-A4) — audioFingerprintResult: AudioFingerprintResult | null
  // is inherited from PipelineAudioFingerprintFields above. Replaces the
  // pre-Phase-6 `audioResult: null` no-op slot. Aggregator (Plan 06-06) reads
  // `pipelineResult.audioFingerprintResult` to compute the audio_fingerprint
  // signal availability flag + the phase-aware boost in D-G2.

  // Phase 3 — Wave 0/3 stub outputs (Phase 4/7 fill with real logic)
  wave0Result: Wave0Result;
  wave3Result: PersonaSimulationResult[];

  // Pipeline metadata
  requestId: string;
  timings: StageTiming[];
  total_duration_ms: number;
  warnings: string[]; // Pipeline-level warnings from partial failures (INFRA-03)
}

/**
 * Options bag for runPredictionPipeline.
 * Per CONTEXT.md D-04: undefined opts must preserve byte-identical behavior to pre-Phase-3.
 */
export interface PipelineOptions {
  /** Caller-provided requestId; pipeline generates one if absent. */
  requestId?: string;
  /**
   * Optional callback for stage event emission (SSE consumption).
   * Per CONTEXT D-04: undefined = byte-identical behavior to pre-Phase-3.
   */
  onStageEvent?: StageEventCallback;
  /**
   * Per CONTEXT D-15: when true, route handler skips cache read+write (eval harness uses this).
   * Pipeline itself does NOT act on this flag — it's a passthrough for the consumer.
   */
  bypassCache?: boolean;
  /**
   * Phase 4 D-18: pre-fetched creator context (route handler may already have it).
   * When set: pipeline reuses it (skips the pre_creator_context DB read).
   * When absent: pipeline fetches via the new pre_creator_context stage BEFORE Wave 0.
   * Either way, Wave 0's niche detector receives the value via runWave0() argument.
   */
  creatorContext?: CreatorContext;
}

// =====================================================
// Timing helper
// =====================================================

/**
 * Wrap an async operation with timing capture.
 * Records stage name and duration to the provided timings array.
 *
 * Phase 3: optionally emits stage_start + stage_end events via opts.onEvent.
 * When opts is undefined, behavior is byte-identical to pre-Phase-3 (CONTEXT D-04).
 */
async function timed<T>(
  name: string,
  timings: StageTiming[],
  fn: () => Promise<T>,
  opts?: { wave?: StageEventWave; onEvent?: StageEventCallback; costCents?: number }
): Promise<T> {
  const wave = opts?.wave ?? 1;
  const start = emitStageStart(opts?.onEvent, name, wave);
  let ok = true;
  let warningMsg: string | undefined;
  try {
    const result = await fn();
    timings.push({
      stage: name,
      duration_ms: Math.round(performance.now() - start),
    });
    return result;
  } catch (e) {
    ok = false;
    warningMsg = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    emitStageEnd(opts?.onEvent, name, wave, start, {
      cost_cents: opts?.costCents ?? 0,
      ok,
      warning: warningMsg,
    });
  }
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
 *    - Stage 4: Audio Fingerprint (non-critical -- pgvector match against trending_sounds; D-A4)
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
  opts?: PipelineOptions
): Promise<PipelineResult> {
  const requestId = opts?.requestId ?? nanoid(12);
  const onStageEvent = opts?.onStageEvent;
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
  }, { wave: 1, onEvent: onStageEvent });

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
  }, { wave: 1, onEvent: onStageEvent });

  // -------------------------------------------------------
  // Single service client for this pipeline run
  // (moved BEFORE Wave 0 because Phase 4 pre_creator_context needs DB access).
  // -------------------------------------------------------
  const supabase = createServiceClient();

  // -------------------------------------------------------
  // Phase 4 D-17/D-18: pre-fetch creator context BEFORE Wave 0.
  // Wave 0's niche detector consumes Card 1/4/5/6 from creator profile (cheap
  // DB read ~50ms). The Wave 1 creator_context stage below becomes a passthrough
  // (reuses this pre-fetched value, preserves the event name for backwards-compat).
  // When opts.creatorContext is provided, this DB read is skipped entirely.
  // -------------------------------------------------------
  const creatorContext: CreatorContext =
    opts?.creatorContext ??
    (await (async () => {
      try {
        return await timed(
          "pre_creator_context",
          timings,
          () => fetchCreatorContext(supabase, payload.creator_handle, payload.niche),
          { wave: 1, onEvent: onStageEvent },
        );
      } catch (error) {
        Sentry.captureException(error, {
          tags: { stage: "pre_creator_context", requestId },
        });
        warnings.push(
          `Creator context pre-fetch unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
        return DEFAULT_CREATOR_CONTEXT;
      }
    })());

  // -------------------------------------------------------
  // Wave 0: Content-type + niche detection (Phase 4 — orchestrates parallel detectors)
  // Runs BEFORE Wave 1 — events fire before any Wave 1 stage_start.
  // -------------------------------------------------------
  const wave0Result = await runWave0(payload, supabase, creatorContext, onStageEvent);

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 0 complete",
    level: "info",
    data: { requestId, stages: ["wave_0_content_type", "wave_0_niche_detector"] },
  });

  // -------------------------------------------------------
  // Wave 1: Gemini + Audio + Creator + Rules (all non-critical, HARD-03)
  // -------------------------------------------------------

  // Extension → MIME type mapping for video downloads
  const EXT_TO_MIME: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
  };

  // Stage 3: Gemini Analysis -- NON-CRITICAL (fallback with warning — HARD-03)
  const geminiPromise = (async (): Promise<PipelineResult["geminiResult"]> => {
    try {
      // Route video uploads to video-specific Gemini analysis
      if (validated.input_mode === "video_upload" && validated.video_storage_path) {
        return await timed("gemini_video_analysis", timings, async () => {
          const { data: videoBlob, error: downloadError } = await supabase
            .storage
            .from("videos")
            .download(validated.video_storage_path!);

          if (downloadError || !videoBlob) {
            throw new Error(
              `Failed to download video from storage: ${downloadError?.message ?? "no data"}`
            );
          }

          const buffer = Buffer.from(await videoBlob.arrayBuffer());
          const ext = validated.video_storage_path!.split(".").pop()?.toLowerCase() ?? "mp4";
          const mimeType = EXT_TO_MIME[ext] ?? "video/mp4";

          return analyzeVideoWithGemini(buffer, mimeType, validated.niche);
        }, { wave: 1, onEvent: onStageEvent });
      }

      // Default: text analysis
      return await timed("gemini_analysis", timings, () =>
        analyzeWithGemini(validated),
        { wave: 1, onEvent: onStageEvent }
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

  // Stage 4: Audio Fingerprint — NON-CRITICAL (graceful degradation via null return per D-A4).
  // Sub-awaits geminiPromise's audio_description (RESEARCH Q3 Architectural Option A); this
  // preserves Wave 1 parallelism visible to SSE consumers: stage_start fires immediately
  // alongside gemini_video_analysis's stage_start, stage_end fires after the pgvector match
  // completes. The inner `await geminiPromise` is the known tradeoff (RESEARCH Pitfall 2) —
  // audio_fingerprint GENUINELY depends on Gemini's audio_description and cannot run earlier.
  //
  // matchAudioFingerprint() never throws — it returns null on every soft-failure path
  // (no description, empty embedding, RPC error object, no row above threshold). The outer
  // try/catch here exists solely as a defense-in-depth net for unexpected hard failures
  // (e.g., geminiPromise itself throws before yielding a value). Per HARD-03 + Phase 3 D-04,
  // audio is enhancement, never gating: a null result means signal_availability.audio_fingerprint
  // = false and weight redistribution flows through the existing aggregator math.
  const audioFingerprintPromise = (async (): Promise<AudioFingerprintResult | null> => {
    try {
      return await timed("audio_fingerprint", timings, async () => {
        // Sub-await — audio_fingerprint genuinely depends on Gemini's audio_description.
        const geminiInner = await geminiPromise;
        // `audio_signals` is `.optional()` on the Zod schema (Plan 03 Test 9 + BLOCKER 2);
        // optional chaining produces `string | undefined` — coerce to `string | null` for the
        // matchAudioFingerprint contract.
        const audioDescription =
          geminiInner.analysis.audio_signals?.audio_description ?? null;
        return matchAudioFingerprint(audioDescription, supabase);
      }, { wave: 1, onEvent: onStageEvent });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { stage: "audio_fingerprint", requestId },
      });
      warnings.push(
        `Audio fingerprint unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
      timings.push({ stage: "audio_fingerprint", duration_ms: 0 });
      return null;
    }
  })();

  // Stage 5: Creator Context -- Phase 4 PASSTHROUGH (reuses pre_creator_context).
  // The actual fetch happened above in the pre_creator_context stage (D-17/D-18).
  // We keep emitting the `creator_context` stage event for backwards-compat with
  // existing consumers (pipeline.test.ts asserts the event name + count) but the
  // "work" is a near-zero-duration passthrough — no second DB read.
  const creatorPromise = (async (): Promise<CreatorContext> => {
    return await timed(
      "creator_context",
      timings,
      async () => creatorContext,
      { wave: 1, onEvent: onStageEvent },
    );
  })();

  // Stage 6: Rule Loading + Scoring -- NON-CRITICAL (fallback with warning)
  const rulePromise = (async (): Promise<RuleScoreResult> => {
    try {
      return await timed("rule_scoring", timings, async () => {
        const rules = await loadActiveRules(supabase, payload.content_type);
        return scoreContentAgainstRules(payload.content_text, rules);
      }, { wave: 1, onEvent: onStageEvent });
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

  // Run Wave 1 in parallel -- all stages gracefully degrade (HARD-03).
  // Phase 4: the third slot (creatorPromise) returns the same value as the
  // outer-scope `creatorContext` (pre-fetched above), so we discard the array
  // slot to avoid redeclaration.
  // Phase 6: the second slot is the audio_fingerprint stage (renamed from
  // audio_analysis per D-A4); it returns AudioFingerprintResult | null.
  const [geminiResult, audioFingerprintResult, , ruleResult] = await timed(
    "wave_1",
    timings,
    () =>
      Promise.all([
        geminiPromise,
        audioFingerprintPromise,
        creatorPromise,
        rulePromise,
      ]),
    { wave: 1, onEvent: onStageEvent }
  );

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 1 complete",
    level: "info",
    data: { requestId, stages: ["gemini", "audio_fingerprint", "creator", "rules"] },
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
      }, { wave: 2, onEvent: onStageEvent });
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

  // Stage 8: Trend Enrichment -- NON-CRITICAL (fallback with warning).
  // Phase 6 D-F3: when the audio_fingerprint stage matched a sound (audioFingerprintResult
  // !== null), the aggregator synthesizes a matched_trends entry from the fingerprint result
  // (single source of truth). Pass that boolean down so enrichWithTrends skips its
  // Jaro-Winkler caption ↔ sound_name fallback loop. Hashtag scoring loop in trends.ts is
  // orthogonal and remains UNGATED.
  const trendPromise = (async (): Promise<TrendEnrichment> => {
    try {
      return await timed("trend_enrichment", timings, () =>
        enrichWithTrends(supabase, validated, {
          audioFingerprintMatched: audioFingerprintResult !== null,
        }),
        { wave: 2, onEvent: onStageEvent }
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
    Promise.all([deepseekPromise, trendPromise]),
    { wave: 2, onEvent: onStageEvent }
  );

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 2 complete",
    level: "info",
    data: { requestId, stages: ["deepseek", "trends"] },
  });

  // -------------------------------------------------------
  // Wave 3: Multi-persona simulation (Phase 7 fills the stub)
  // Runs AFTER Wave 2 completes — events fire after wave_2 stage_end.
  // -------------------------------------------------------
  const wave3Result = await runWave3(
    payload,
    deepseekRaw?.reasoning ?? null,
    onStageEvent
  );

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 3 complete",
    level: "info",
    data: { requestId, stages: ["wave_3_personas"] },
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
    // Phase 6 (D-A4): replaces the pre-Phase-6 audioResult: null slot. Plan 06-06's
    // aggregator reads this directly via `pipelineResult.audioFingerprintResult`.
    audioFingerprintResult,
    wave0Result,
    wave3Result,
    requestId,
    timings,
    total_duration_ms,
    warnings,
  };
}
