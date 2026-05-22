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
} from "./types";
import { normalizeInput } from "./normalize";
import {
  analyzeWithGemini,
  loadCalibrationData,
  // D-18 (Phase 13 Plan 03): pipeline-entry upload helpers — exported by Plan 02 Task 2.2 Step E
  getClient as getGeminiClient,
  VIDEO_POLL_TIMEOUT_MS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_MAX_SIZE_BYTES,
  EXT_TO_MIME,
} from "./gemini";
import { analyzeVideoSegmented } from "./gemini/segmented"; // Phase 5 Plan 02/03 — segmented video path
import { matchAudioFingerprint } from "./audio-fingerprint"; // Phase 6 Plan 04 — pgvector fingerprint match

// Phase 5 IN-05 fix: removed re-export of `analyzeVideoWithGemini`. Direct-import
// is the canonical pattern from `./gemini` for legacy consumers (eval-harness).
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
import { runBenchmarkRetrieval } from "./retrieval/retrieval-stage";
import { runPlatformFit } from "./wave4/platform-fit";

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

  // D-18 (Phase 13 Plan 03): Gemini Files API videoContext from pipeline-entry upload.
  // Surfaced here so the route handler can pass { videoContext } to aggregateScores,
  // which threads it to Stage 11 (runStage11Counterfactuals). Null for text/tiktok_url modes.
  videoContext: { fileUri: string; mimeType: string } | null;

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

// Phase 8 — Wave-1 retrieval graceful-empty fallback (matches BenchmarkRetrievalResult shape).
// Used when runBenchmarkRetrieval throws an unexpected error past its own outer catch
// (defense in depth per T-08-16 — the stage itself returns this shape, but pipeline
// wraps in try/catch to satisfy BENCH-05 even if the stage's catch fails).
const DEFAULT_RETRIEVAL_RESULT: BenchmarkRetrievalResult = {
  evidence: [],
  score: null,
  availability: false,
  cost_cents: 0,
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
  // D-18 (Phase 13 Plan 03): Single Gemini Files API upload at pipeline entry.
  // One upload per analysis run — Wave 0, Wave 1 segmented, and Stage 11 all share
  // the same fileUri via the videoContext bag. Caller (pipeline.ts) owns cleanup.
  //
  // tiktok_url mode: NO upload — content-type-detector skips non-video_upload mode
  // (confirmed in Plan 01 D-31 audit). videoContext remains null.
  // -------------------------------------------------------
  let videoContext: { fileUri: string; mimeType: string } | null = null;
  let geminiUploadedFileName: string | undefined;
  const geminiAiClient = getGeminiClient();

  if (validated.input_mode === "video_upload" && validated.video_storage_path) {
    const { data: videoBlob, error: videoDownloadError } = await supabase
      .storage
      .from("videos")
      .download(validated.video_storage_path);

    if (videoDownloadError || !videoBlob) {
      throw new Error(
        `Video download failed at pipeline entry: ${videoDownloadError?.message ?? "no data"}`,
      );
    }

    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
    if (videoBuffer.byteLength > VIDEO_MAX_SIZE_BYTES) {
      throw new Error("Video exceeds maximum size (287MB).");
    }

    const ext = validated.video_storage_path.split(".").pop()?.toLowerCase() ?? "mp4";
    const mimeType = EXT_TO_MIME[ext] ?? "video/mp4";
    const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });

    const uploadResult = await geminiAiClient.files.upload({ file: blob, config: { mimeType } });
    if (!uploadResult.name) throw new Error("Video upload failed: no file name returned");
    geminiUploadedFileName = uploadResult.name;

    let fileState = uploadResult.state;
    let fileUri = uploadResult.uri ?? "";
    // Hoist lastFileInfo so duration metadata is accessible whether or not polling ran.
    let lastFileInfo: Awaited<ReturnType<typeof geminiAiClient.files.get>> | typeof uploadResult = uploadResult;
    const pollStart = Date.now();
    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) {
        // Upload timeout: do NOT delete — file is in PROCESSING state, let TTL expire it.
        throw new Error("Video upload timeout — file still processing in Gemini Files API.");
      }
      await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
      lastFileInfo = await geminiAiClient.files.get({ name: geminiUploadedFileName });
      fileState = lastFileInfo.state;
      fileUri = lastFileInfo.uri ?? "";
    }
    if (fileState !== "ACTIVE" || !fileUri) {
      // Gemini returned FAILED — likely unsupported codec (e.g. HEVC/H.265).
      // Attempt re-encode to H.264 via ffmpeg and retry upload once (dev only).
      let retryOk = false;
      try {
        const { execSync } = await import("child_process");
        const { writeFileSync, readFileSync, unlinkSync } = await import("fs");
        const tmpIn = `/tmp/gsd-vin-${requestId}.mp4`;
        const tmpOut = `/tmp/gsd-vout-${requestId}.mp4`;
        writeFileSync(tmpIn, Buffer.from(await blob.arrayBuffer()));
        execSync(`ffmpeg -y -i "${tmpIn}" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart "${tmpOut}" 2>/dev/null`, { timeout: 60000 });
        const reencoded = Buffer.from(readFileSync(tmpOut));
        unlinkSync(tmpIn);
        unlinkSync(tmpOut);
        const reBlob = new Blob([new Uint8Array(reencoded)], { type: "video/mp4" });
        const reUpload = await geminiAiClient.files.upload({ file: reBlob, config: { mimeType: "video/mp4" } });
        if (reUpload.name) {
          geminiUploadedFileName = reUpload.name;
          let reState = reUpload.state;
          let reUri = reUpload.uri ?? "";
          let reInfo: typeof reUpload = reUpload;
          const rePollStart = Date.now();
          while (reState === "PROCESSING") {
            if (Date.now() - rePollStart > VIDEO_POLL_TIMEOUT_MS) break;
            await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
            reInfo = await geminiAiClient.files.get({ name: reUpload.name });
            reState = reInfo.state;
            reUri = reInfo.uri ?? "";
          }
          if (reState === "ACTIVE" && reUri) {
            fileUri = reUri;
            retryOk = true;
            videoContext = { fileUri, mimeType: "video/mp4" };
            const rawDur = (reInfo as { videoMetadata?: { videoDuration?: string } }).videoMetadata?.videoDuration;
            if (rawDur && payload.duration_hint == null) {
              const dm = rawDur.match(/^(\d+(?:\.\d+)?)s?$/);
              if (dm) payload.duration_hint = Math.round(parseFloat(dm[1]!));
            }
          }
        }
      } catch (_) { /* ffmpeg not available or failed — proceed without video context */ }

      if (!retryOk) {
        warnings.push(`Gemini file processing ${fileState} — running metadata-only analysis (video signals unavailable).`);
        onStageEvent?.({ type: "pipeline_warning", message: `Gemini file upload ${fileState}`, stage: "gemini_video_unavailable" });
      }
    } else {
      // Extract duration from Gemini file metadata and backfill payload.duration_hint
      // so the segmented analysis isn't skipped on video_upload with no caption.
      // Gemini returns videoDuration as a protobuf Duration string e.g. "30.500s".
      const rawDuration = (lastFileInfo as { videoMetadata?: { videoDuration?: string } }).videoMetadata?.videoDuration;
      if (rawDuration != null && payload.duration_hint == null) {
        const m = rawDuration.match(/^(\d+(?:\.\d+)?)s?$/);
        if (m) payload.duration_hint = Math.round(parseFloat(m[1]!));
      }

      videoContext = { fileUri, mimeType };

      Sentry.addBreadcrumb({
        category: "engine.pipeline",
        message: "D-18: video uploaded at pipeline entry — fileUri shared across stages",
        level: "info",
        data: { requestId, geminiUploadedFileName, mimeType },
      });
    }
  }

  // -------------------------------------------------------
  // Wrap pipeline body in try/finally to ensure cleanup.
  // D-18: cleanup (ai.files.delete) happens once at pipeline exit.
  // -------------------------------------------------------
  try {

  // -------------------------------------------------------
  // Wave 0: Content-type + niche detection (Phase 4 — D-17 folded into single Gemini call)
  // Runs BEFORE Wave 1 — events fire before any Wave 1 stage_start.
  // D-18: videoContext threaded so Wave 0 skips its own upload.
  // -------------------------------------------------------
  const wave0Result = await runWave0(payload, supabase, creatorContext, videoContext, onStageEvent);

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 0 complete",
    level: "info",
    data: { requestId, stages: ["wave_0_content_type"] },
  });

  // -------------------------------------------------------
  // Wave 1: Gemini + Audio + Creator + Rules (all non-critical, HARD-03)
  // -------------------------------------------------------

  // Stage 3: Gemini Analysis -- NON-CRITICAL (fallback with warning — HARD-03)
  const geminiPromise = (async (): Promise<PipelineResult["geminiResult"]> => {
    try {
      // Route video uploads to segmented Gemini analysis (Phase 5 Plan 02/03).
      // D-11: legacy `analyzeVideoWithGemini` import preserved above for eval-harness
      // corpus-replay path; not invoked from production video branch.
      // D-14: NO outer `timed("gemini_video_analysis", ...)` wrapper here — the three
      // per-segment events emitted by helpers (gemini_hook / _body / _cta) REPLACE it.
      // D-18: videoContext from pipeline entry — Wave 1 uses it instead of re-uploading.
      if (validated.input_mode === "video_upload" && validated.video_storage_path) {
        // Load calibration baseline so segment prompts can embed differentiators.
        // Reuses the module-level cache singleton in gemini.ts — no extra disk reads on warm path.
        // If calibration cannot load, legacy analyzeVideoWithGemini also fails; preserve that
        // behavior by throwing here, which the outer catch routes to DEFAULT_GEMINI_RESULT.
        const calibration = await loadCalibrationData();
        if (!calibration) {
          throw new Error(
            "Calibration baseline unavailable — Gemini segmented analysis cannot proceed."
          );
        }

        // Phase 4 D-15: content_type from Wave 0 flows into segment prompts.
        // Phase 5 D-15-partial: niche threads through; creatorStyle (Card 4) deferred.
        const contentTypeSlug = wave0Result.content_type?.type ?? null;

        // WR-08: duration_hint=null is silently dangerous — defaulting to 30s
        // against a real 6-second video puts body's window at 5s→27s and CTA's
        // at 27s→30s, both well beyond the actual content. The model will
        // hallucinate scores against frames that don't exist. Skip segmentation
        // and surface a pipeline_warning + DEFAULT_GEMINI_RESULT so the
        // aggregator's weight redistribution kicks in (gemini_hook/body/cta =
        // false), rather than feeding fabricated scores forward. The legacy
        // single-call path is NOT a safe fallback because it has the same
        // inherited Files API state bug (fixed in CR-01 but not on the
        // production hot path).
        if (payload.duration_hint == null) {
          const msg =
            "Gemini segmented analysis skipped — video_upload missing duration_hint (would otherwise hallucinate scores against fabricated window math).";
          warnings.push(msg);
          onStageEvent?.({
            type: "pipeline_warning",
            message: msg,
            stage: "gemini_video_unavailable",
          });
          timings.push({ stage: "gemini_analysis", duration_ms: 0 });
          return {
            ...DEFAULT_GEMINI_RESULT,
            signalAvailability: {
              gemini_hook: false,
              gemini_body: false,
              gemini_cta: false,
            },
          };
        }

        // D-18: pass videoContext so segmented.ts skips its own upload (shared fileUri).
        // When videoContext is null (e.g. timeout at entry), analyzeVideoSegmented falls
        // back to legacy upload path — graceful degradation preserved.
        const merged = await analyzeVideoSegmented(
          videoContext ? Buffer.alloc(0) : Buffer.alloc(0), // buffer unused when videoContext set
          videoContext?.mimeType ?? "video/mp4",
          {
            calibration,
            niche: validated.niche ?? creatorContext.niche ?? null,
            contentType: contentTypeSlug,
            creatorStyle: null,
            onStageEvent,
            durationSeconds: payload.duration_hint,
            videoContext: videoContext ?? undefined,
          },
        );

        // D-09: 3-of-3 failure path — `analyzeVideoSegmented` returns `analysis: null`.
        // Preserve DEFAULT_GEMINI_RESULT shape (5 zero-score factors) for the existing
        // factor-array consumers downstream, but surface the merged `signalAvailability`
        // so the aggregator (Plan 03) can mark gemini_hook/body/cta as false and trigger
        // weight redistribution.
        if (merged.analysis === null) {
          return {
            ...DEFAULT_GEMINI_RESULT,
            signalAvailability: merged.signalAvailability,
          };
        }

        return {
          analysis: merged.analysis,
          cost_cents: merged.cost_cents,
          signalAvailability: merged.signalAvailability,
        };
      }

      // Default: text analysis (unchanged from Phase 4).
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

  // Stage 6.5: Benchmark Retrieval -- NON-CRITICAL (Phase 8 D-09 graceful degradation).
  // retrieval-stage.ts SELF-EMITS stage_start/stage_end events; we do NOT wrap in
  // timed() here (would double-emit per PATTERNS Critical Cross-File Constraint #3).
  // Outer try/catch is defense-in-depth — the stage's own catch returns
  // GRACEFUL_EMPTY, but if anything escapes (e.g. type-coercion bug at call site)
  // we still surface as a warning rather than break the pipeline (BENCH-05).
  const retrievalPromise = (async (): Promise<BenchmarkRetrievalResult> => {
    try {
      return await runBenchmarkRetrieval({
        payload,
        creatorContext,
        wave0Result,
        supabase,
        onEvent: onStageEvent,
        requestId,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { stage: "retrieval", requestId },
      });
      warnings.push(
        `Retrieval unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      timings.push({ stage: "retrieval", duration_ms: 0 });
      return DEFAULT_RETRIEVAL_RESULT;
    }
  })();

  // Run Wave 1 in parallel -- all stages gracefully degrade (HARD-03).
  // Phase 4: the third slot (creatorPromise) returns the same value as the
  // outer-scope `creatorContext` (pre-fetched above), so we discard the array
  // slot to avoid redeclaration.
  // Phase 6: 2nd slot is audioFingerprintPromise (renamed from audio_analysis per D-A4);
  // returns AudioFingerprintResult | null. Phase 8: 5th slot is retrievalPromise
  // (D-09 — Wave 1 sibling, graceful-degradation BenchmarkRetrievalResult).
  const [geminiResult, audioFingerprintResult, , ruleResult, retrievalResult] = await timed(
    "wave_1",
    timings,
    () =>
      Promise.all([
        geminiPromise,
        audioFingerprintPromise,
        creatorPromise,
        rulePromise,
        retrievalPromise,
      ]),
    { wave: 1, onEvent: onStageEvent }
  );

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 1 complete",
    level: "info",
    data: { requestId, stages: ["gemini", "audio_fingerprint", "creator", "rules", "retrieval"] },
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
  // Phase 9 — Platform-fit: runs AFTER Wave 3, BEFORE aggregateScores.
  // Uses deepseekResult's reasoning + Gemini's watermark detection for
  // per-platform scoring. Non-critical — returns null on any failure.
  // -------------------------------------------------------
  const watermarkDetected =
    geminiResult.analysis.hook_decomposition?.watermark_detected ?? null;
  const platformFitResult = await runPlatformFit(
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
    videoContext, // D-18 (Phase 13 Plan 03) — threaded to aggregateScores via route.ts
    requestId,
    timings,
    total_duration_ms,
    warnings,
  };

  } finally {
    // D-18: best-effort cleanup of the pipeline-entry uploaded file.
    // Only runs when WE uploaded (geminiUploadedFileName set).
    // T-13-15: failure here leaks only quota; Files API has 48h TTL.
    if (geminiUploadedFileName) {
      try {
        await geminiAiClient.files.delete({ name: geminiUploadedFileName });
      } catch {
        // Best-effort — TTL provides eventual cleanup.
      }
    }
  }
}
