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
  type PlatformFitResult,
  type RuleScoreResult,
  type TrendEnrichment,
  type Wave0Result,
  type PersonaSimulationResult,
  type PersonaBehavioralAggregate,
  type BenchmarkRetrievalResult,
  type SegmentGrid,
} from "./types";
import { normalizeInput } from "./normalize";
import { matchAudioFingerprint } from "./audio-fingerprint"; // Phase 6 Plan 04 — pgvector fingerprint match
import { analyzeVideoWithOmni } from "./qwen/omni-analysis";
import { getQwenClient, QWEN_REASONING_MODEL } from "./qwen/client";
import { calculateCost } from "./qwen/cost";
import { stripModelOutput } from "./utils/strip";
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
import { runWave3 } from "./wave3";
import { createEmptyRetrievalResult } from "./retrieval-empty";
import { runPlatformFit } from "./wave4/platform-fit";
// Phase 3 (Plan 08) — Pass 2 orchestrator + filmstrip trigger
import { runWave3Pass2, type Wave3Pass2Outcome } from "./wave3/pass2";
import type { DemographicContext } from "./wave3/persona-prompts-pass2";
import { triggerFilmstripGeneration } from "./filmstrip/queue";

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
  geminiResult: {
    analysis: GeminiAnalysis;
    cost_cents: number;
    /**
     * Phase 5 D-12: per-segment availability flags populated by `analyzeVideoSegmented`.
     * Undefined for text mode + tiktok_url mode + legacy video path (D-11 eval-harness
     * compatibility). The aggregator (Plan 03) reads this to populate
     * SignalAvailability.gemini_hook/body/cta with a `?? false` fallback for legacy
     * callers (RESEARCH line 475 — historical JSONB rows missing the new keys).
     */
    signalAvailability?: {
      gemini_hook: boolean;
      gemini_body: boolean;
      gemini_cta: boolean;
    };
  };
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
  /**
   * Phase 7 — Wave 3 outputs surfaced as TWO derived fields rather than a single
   * `Wave3Outcome`. They originate from the same `runWave3` call:
   *   - `wave3Result` ← `Wave3Outcome.results` (per-persona detail for audience-viz)
   *   - `personaBehavioralAggregate` ← `Wave3Outcome.aggregate` (top-3-weighted aggregate, or null)
   *   - `Wave3Outcome.warnings` is folded into the pipeline-level `warnings` array.
   * Reviewer note (IN-04): treat these as a logical group. Pipeline-level consumers
   * that need both should read both — the orchestrator does not synthesize them
   * from independent sources.
   */
  wave3Result: PersonaSimulationResult[];
  personaBehavioralAggregate: PersonaBehavioralAggregate | null;
  /**
   * Phase 7 CR-01 — wave-level Wave 3 cost in cents, surfaced so the aggregator can fold
   * it into PredictionResult.cost_cents. Without this, eval-runner cost-cap enforcement is
   * silently bypassed for hidden Wave 3 spend (eval-runner reads `prediction.cost_cents`
   * which previously only covered Gemini + DeepSeek).
   */
  wave3CostCents: number;

  // Phase 8 — Wave 1 retrieval sibling (Plan 04). Graceful empty on any failure;
  // aggregator folds retrievalResult.score into overall_score at weight 0.05.
  retrievalResult: BenchmarkRetrievalResult;

  // Phase 9 — Platform-fit V3 result (Plan 03). Null when V3 call fails or circuit
  // breaker is open. Aggregator reads this (via widenedPipeline cast) to compute
  // platform_fit signal availability + fold mean fit_score into overall_score.
  platformFitResult: PlatformFitResult[] | null;

  // Phase 3 (Plan 08) — Pass 2 outcome from runWave3Pass2.
  // Null when no segments (text mode / tiktok_url mode) or when Pass 2 itself is skipped.
  // Aggregator reads this to populate weighted_* + heatmap + isAntiViralityGatedFull.
  pass2Outcome: Wave3Pass2Outcome | null;

  // Phase 3 (Plan 08) — Omni segments from Wave 0 (SegmentGrid[]).
  // Required by aggregator.assembleHeatmapPayload + buildWeightedCurve.
  // Undefined/empty when text mode or tiktok_url mode (no video segments).
  segments?: SegmentGrid[];

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
  /**
   * Phase 3 (Plan 08) D-11: analysis row ID. Required for:
   *   1. triggerFilmstripGeneration (filmstrip API needs analysisId to write keyframe_uri).
   *   2. readKeyframeUris (reads analysis_results.heatmap.segments[].keyframe_uri for Pass 2).
   * When absent: filmstrip trigger is skipped; Pass 2 receives all-null keyframeUris.
   */
  analysisId?: string;
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
  // Phase 2 (D-19) — 9-card profile fields. Graceful-degradation default is
  // null for every field; downstream consumers (Wave 0 niche detector,
  // creator context formatter, Phase 8 retrieval-stage) handle null safely.
  // WR-03: these fields are required-but-nullable on CreatorContext (creator.ts:26-46);
  // tsc --noEmit fails if any are missing here.
  target_platforms: null,
  niche_primary: null,
  niche_sub: null,
  target_audience: null,
  primary_goal: null,
  creator_stage: null,
  content_style: null,
  cuts_per_second: null,
  reference_creators: null,
  past_wins: null,
  past_flops: null,
  time_of_day_aware: null,
  pain_points: null,
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
// Phase 3 (Plan 08) — Helpers for Pass 2 orchestration
// =====================================================

/**
 * Read current keyframe URIs from analyses.analysis_results JSONB.
 * Returns all-null array when DB read fails (graceful degradation per D-03).
 */
async function readKeyframeUris(
  supabase: ReturnType<typeof createServiceClient>,
  analysisId: string,
  segmentCount: number,
): Promise<(string | null)[]> {
  try {
    // Use type cast to bypass Supabase generated types — "analyses" is a real table
    // but the generated types don't include it in all environments.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("analyses")
      .select("analysis_results")
      .eq("id", analysisId)
      .single() as { data: { analysis_results: unknown } | null; error: unknown };
    if (error || !data) {
      return new Array<string | null>(segmentCount).fill(null);
    }
    // analysis_results is a JSONB column; heatmap.segments[].keyframe_uri are set by
    // /api/filmstrip/extract after filmstrip generation completes (Plan 07).
    const ar = data.analysis_results as { heatmap?: { segments?: Array<{ keyframe_uri?: string | null }> } } | null;
    const segments = ar?.heatmap?.segments;
    if (!Array.isArray(segments)) {
      return new Array<string | null>(segmentCount).fill(null);
    }
    return segments.map((s) => (s as { keyframe_uri?: string | null }).keyframe_uri ?? null);
  } catch {
    return new Array<string | null>(segmentCount).fill(null);
  }
}

/**
 * Build DemographicContext from creator profile + server clock heuristics (D-04).
 * time_of_day derived from UTC hour; scrolling_state inferred from time_of_day.
 * All fields optional — unknown/missing values fall back to undefined (omitted).
 */
function buildDemographicContext(
  creatorCtx: import("./creator").CreatorContext,
  now: Date,
): DemographicContext {
  const utcHour = now.getUTCHours();
  // Map UTC hour ranges to time_of_day buckets (interfaces section heuristic).
  type KnownTimeOfDay = "morning" | "midday" | "afternoon" | "evening" | "late_night";
  let time_of_day: KnownTimeOfDay | undefined;
  if (utcHour >= 23 || utcHour < 6)       time_of_day = "late_night";
  else if (utcHour >= 6 && utcHour < 11)  time_of_day = "morning";
  else if (utcHour >= 11 && utcHour < 14) time_of_day = "midday";
  else if (utcHour >= 14 && utcHour < 18) time_of_day = "afternoon";
  else if (utcHour >= 18 && utcHour < 23) time_of_day = "evening";
  // else: undefined (unknown hour) → omit field

  // scrolling_state derived from time_of_day (simple heuristic per interfaces section).
  type ScrollingState = "commute" | "work_break" | "leisure" | "pre_sleep";
  const scrollingStateMap: Record<KnownTimeOfDay, ScrollingState> = {
    morning:    "commute",
    midday:     "work_break",
    afternoon:  "leisure",
    evening:    "leisure",
    late_night: "pre_sleep",
  };
  const scrolling_state = time_of_day ? scrollingStateMap[time_of_day] : undefined;

  // follower_tier mapped from follower_count to DemographicContext union:
  // "new" | "growing" | "established" | "creator"
  const fc = creatorCtx.follower_count;
  type FollowerTier = DemographicContext["follower_tier"];
  const follower_tier: FollowerTier = (() => {
    if (!fc) return undefined;
    if (fc < 10_000) return "new";
    if (fc < 100_000) return "growing";
    if (fc < 1_000_000) return "established";
    return "creator";
  })();

  return {
    // geo comes from target_audience.geo (Card 2 JSONB nested field)
    geo: creatorCtx.target_audience?.geo ?? undefined,
    follower_tier,
    time_of_day,
    scrolling_state,
  };
}

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

  // Video signed URL for Omni-Plus — no upload, no polling, no cleanup.
  // Supabase Storage already holds the video; we generate a 1-hour signed URL.
  let signedVideoUrl: string | null = null;

  if (validated.input_mode === "video_upload" && validated.video_storage_path) {
    const { data: signedData, error: signedError } = await supabase
      .storage
      .from("videos")
      .createSignedUrl(validated.video_storage_path, 3600);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(
        `Failed to generate video signed URL: ${signedError?.message ?? "no URL returned"}`,
      );
    }
    signedVideoUrl = signedData.signedUrl;
  }

  // -------------------------------------------------------
  // Wave 0 + Wave 1 visual/audio: unified Omni-Plus call (replaces Wave 0 + Gemini segmented)
  // For video_upload mode, a single qwen3.5-omni-plus call returns content-type, niche,
  // hook/body/CTA analysis, and audio signals in one response.
  // -------------------------------------------------------
  let wave0Result: Wave0Result = { content_type: null, niche: null };
  let precomputedGeminiResult: PipelineResult["geminiResult"] | null = null;
  // Phase 3 (Plan 08) — segments from Omni call; used for filmstrip trigger + Pass 2.
  let omniSegments: SegmentGrid[] | undefined;

  if (signedVideoUrl) {
    try {
      const omniOut = await analyzeVideoWithOmni(signedVideoUrl, {
        niche: validated.niche ?? creatorContext.niche ?? undefined,
        onEvent: onStageEvent,
      });
      wave0Result         = omniOut.wave0Result;
      // Capture segments for Phase 3 Pass 2 wiring
      omniSegments = omniOut.segments;
      precomputedGeminiResult = omniOut.geminiResult
        ? {
            analysis: omniOut.geminiResult.analysis,
            cost_cents: omniOut.geminiResult.cost_cents,
            signalAvailability: omniOut.signalAvailability,
          }
        : {
            ...DEFAULT_GEMINI_RESULT,
            signalAvailability: omniOut.signalAvailability,
          };
      // Phase 3 (Plan 08) D-11: fire-and-forget filmstrip generation at wave_0_complete.
      // Pipeline does NOT await — filmstrip latency must never count against engine SLA.
      // analysisId is threaded via opts.analysisId (API route sets this before calling pipeline).
      if (omniOut.segments && omniOut.segments.length > 0 && signedVideoUrl) {
        const analysisId = opts?.analysisId;
        if (analysisId) {
          triggerFilmstripGeneration(analysisId, omniOut.segments, signedVideoUrl);
        }
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { stage: "omni_analysis", requestId } });
      warnings.push(`Omni analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      precomputedGeminiResult = DEFAULT_GEMINI_RESULT;
    }
  }

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 0 + Omni analysis complete",
    level: "info",
    data: { requestId, hasVideo: !!signedVideoUrl },
  });

  // Wave 1: remaining parallel stages
  // geminiPromise is pre-resolved from Omni (video mode) or runs text analysis (text/url mode).
  const geminiPromise: Promise<PipelineResult["geminiResult"]> = (async (): Promise<PipelineResult["geminiResult"]> => {
    if (precomputedGeminiResult !== null) {
      return precomputedGeminiResult;
    }
    // Text / tiktok_url mode: text analysis via Qwen
    try {
      return await timed("gemini_analysis", timings, async () => {
        const ai    = getQwenClient();
        const model = QWEN_REASONING_MODEL;
        const completion = await ai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: "You are a TikTok content analyst. Analyze the provided content and return a JSON object with fields: factors (array of 5 with name, score 0-10, rationale, improvement_tip), overall_impression (string), content_summary (string). Factor names must be exactly: Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge." },
            { role: "user",   content: `Analyze this TikTok content:\n\n${validated.content_text ?? "(no text provided)"}` },
          ],
          response_format: { type: "json_object" },
        });
        const raw    = completion.choices[0]?.message?.content ?? "{}";
        const text   = stripModelOutput(raw);
        const parsed = JSON.parse(text);
        const cost_cents = calculateCost(model, completion.usage ?? undefined);
        // Validate minimal shape
        if (!Array.isArray(parsed.factors) || parsed.factors.length !== 5) {
          throw new Error("Text analysis returned invalid factors array");
        }
        return {
          analysis: {
            factors: parsed.factors,
            overall_impression: parsed.overall_impression ?? "",
            content_summary: parsed.content_summary ?? "",
            video_signals: null,
          } as GeminiAnalysis,
          cost_cents,
          signalAvailability: { gemini_hook: false, gemini_body: false, gemini_cta: false },
        };
      }, { wave: 1, onEvent: onStageEvent });
    } catch (error) {
      Sentry.captureException(error, { tags: { stage: "gemini_analysis", requestId } });
      warnings.push(`Text analysis unavailable: ${error instanceof Error ? error.message : String(error)}`);
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
  // 06-REVIEW.md IN-04 — clarification for SSE consumers: the wall-clock duration between
  // audio_fingerprint stage_start and stage_end will include the gemini call latency that
  // this stage awaits internally. Consumers should NOT interpret total_duration as the
  // fingerprint-specific cost — only the segment AFTER gemini completes (embed + RPC) is
  // attributable to this stage. The internal `await geminiPromise` is sequentially ordered
  // by design (Pitfall 2), even though the outer Promise.all looks parallel.
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
  // Phase 6: 2nd slot is audioFingerprintPromise (renamed from audio_analysis per D-A4);
  // returns AudioFingerprintResult | null.
  // Phase 1 (MVP Cut D-09/D-10): retrieval removed from Wave 1; synthesized empty result
  // assigned from createEmptyRetrievalResult() helper — single swap point for M2 restore.
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
  const retrievalResult = createEmptyRetrievalResult();

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
  // Platform-fit — re-parallelized. It depends ONLY on Wave 2 (deepseek
  // reasoning) + Omni watermark detection, NOT on Wave 3. Kick it off here so
  // it runs concurrently with Wave 3 (Pass 1 + Pass 2) instead of serially
  // after Pass 2. It's ~17s vs Wave 3's ~88s, so it finishes inside Wave 3's
  // window at ~0 marginal wall cost (was costing a full serial 17s before).
  // -------------------------------------------------------
  const watermarkDetected =
    ((geminiResult.analysis as import("./types").GeminiVideoAnalysis).hook_decomposition)?.watermark_detected ?? null;
  const platformFitPromise = runPlatformFit(
    payload,
    creatorContext,
    deepseekRaw?.reasoning ?? null,
    watermarkDetected,
    onStageEvent,
  ).catch((error) => {
    Sentry.captureException(error, {
      tags: { stage: "platform_fit", requestId },
    });
    warnings.push(
      `Platform-fit unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  });

  // -------------------------------------------------------
  // Wave 3: Multi-persona simulation (Phase 7 fills the stub)
  // Runs AFTER Wave 2 completes — events fire after wave_2 stage_end.
  // Phase 7 Plan 07-02b: widened signature passes wave0Result (D-11 routing) +
  // creatorContext (D-03 loyalist grounding); returns Wave3Outcome with
  // aggregate + per-persona results + warnings.
  // -------------------------------------------------------
  const wave3Outcome = await runWave3(
    payload,
    deepseekRaw?.reasoning ?? null,
    wave0Result,
    creatorContext,
    onStageEvent,
  );
  const wave3Result: PersonaSimulationResult[] = wave3Outcome.results;
  const personaBehavioralAggregate: PersonaBehavioralAggregate | null = wave3Outcome.aggregate;
  // CR-01: wave-level cost surfaced to PipelineResult so the aggregator can fold Wave 3
  // spend into PredictionResult.cost_cents.
  const wave3CostCents = wave3Outcome.cost_cents;
  warnings.push(...wave3Outcome.warnings);

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 3 complete",
    level: "info",
    data: { requestId, stages: ["wave_3_personas"] },
  });

  // -------------------------------------------------------
  // Phase 3 (Plan 08) — Wave 3 Pass 2: runs AFTER Pass 1 (wave3Outcome),
  // BEFORE aggregateScores. Fire-and-forget filmstrip happened earlier at
  // wave_0_complete (D-11). Pass 2 receives whatever keyframeUris exist now
  // (some may be null — D-03 fallback to omni text descriptions is in pass2.ts).
  //
  // Only invoked when segments exist (video_upload mode with Omni success).
  // Skipped in text mode + tiktok_url mode (no segments).
  // -------------------------------------------------------
  let pass2Outcome: Wave3Pass2Outcome | null = null;
  if (omniSegments && omniSegments.length > 0 && wave3Result.length > 0) {
    try {
      const analysisId = opts?.analysisId;
      const keyframeUris = analysisId
        ? await readKeyframeUris(supabase, analysisId, omniSegments.length)
        : new Array<string | null>(omniSegments.length).fill(null);
      const demoContext = buildDemographicContext(creatorContext, new Date());
      pass2Outcome = await runWave3Pass2(
        omniSegments,
        keyframeUris,
        wave3Result,
        demoContext,
        onStageEvent,
        // CR-02: forward wave0 content_type + niche slugs so Pass 2 uses the same
        // slot routing as Pass 1 — prevents slot_type mismatch between passes.
        wave0Result.content_type?.type ?? null,
        wave0Result.niche?.primary_slug ?? null,
      );
      warnings.push(...pass2Outcome.warnings);
    } catch (error) {
      Sentry.captureException(error, { tags: { stage: "wave_3_pass2", requestId } });
      warnings.push(`Pass 2 unavailable: ${error instanceof Error ? error.message : String(error)}`);
      // pass2Outcome remains null — aggregator uses Pass 1 fallback
    }
  }

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 3 Pass 2 complete",
    level: "info",
    data: { requestId, pass2_aggregate_built: pass2Outcome?.pass2_aggregate_built ?? false },
  });

  // -------------------------------------------------------
  // Phase 9 — Platform-fit: kicked off right after Wave 2 (see platformFitPromise
  // above) so it runs concurrently with Wave 3 rather than serially after Pass 2.
  // Awaited here, where its result is needed for PipelineResult assembly.
  // -------------------------------------------------------
  const platformFitResult = await platformFitPromise;

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Platform-fit complete",
    level: "info",
    data: { requestId, resultCount: platformFitResult?.length ?? 0 },
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
    (geminiResult.cost_cents ?? 0)
    + (deepseekRaw?.cost_cents ?? 0)
    + wave3CostCents; // CR-01: include Wave 3 cost in pipeline-level log so true spend is observable.
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
    // Phase 7 (Plan 07-02b) — real aggregate from Wave 3 orchestrator. Null when <7 personas
    // succeed (D-13 threshold) OR when circuit-breaker fast-failed (W-3); the aggregator
    // surfaces null as signal_availability.personas = false via Plan 07-03.
    personaBehavioralAggregate,
    // CR-01: surfaced so aggregator can fold Wave 3 spend into PredictionResult.cost_cents
    // (eval-runner cost cap reads that rolled-up field).
    wave3CostCents,
    retrievalResult, // NEW Phase 8 D-09 (Plan 04) — graceful-degradation BenchmarkRetrievalResult
    platformFitResult, // NEW Phase 9 (Plan 03) — platform-fit V3 result array or null
    pass2Outcome,      // Phase 3 (Plan 08) — Pass 2 outcome; null when no segments or skipped
    segments: omniSegments, // Phase 3 (Plan 08) — SegmentGrid[] for aggregator.assembleHeatmapPayload
    requestId,
    timings,
    total_duration_ms,
    warnings,
  };

}
