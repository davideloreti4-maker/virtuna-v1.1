import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createLogger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import {
  AnalysisInputSchema,
  type AnalysisInput,
  type ContentPayload,
  type GeminiAnalysis,
  type DeepSeekReasoning,
  type Wave0Result,
  type PersonaSimulationResult,
  type PersonaBehavioralAggregate,
  type BenchmarkRetrievalResult,
  type SegmentGrid,
  type VerbatimPayload,
  type EmotionArcPoint,
} from "./types";
import { normalizeInput } from "./normalize";
import { analyzeVideoWithOmni } from "./qwen/omni-analysis";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "./qwen/client";
import { calculateCost } from "./qwen/cost";
import { stripModelOutput } from "./utils/strip";
import { reasonWithDeepSeek } from "./deepseek";
import {
  fetchCreatorContext,
  formatCreatorContext,
  type CreatorContext,
} from "./creator";
import type { StageEventCallback, StageEventWave } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import { IngestError } from "@/lib/scraping/types";
import { createEmptyRetrievalResult } from "./retrieval-empty";
// Phase 4 Plan 05 — fold is the sole audience-sim path (10-pass deleted).
// Wave3Pass2Outcome kept for PipelineResult back-compat (field always null after deletion).
import type { Wave3Pass2Outcome } from "./wave3/pass2";
import { runFold, type Wave3FoldOutcome } from "./wave3/fold";
import { aggregatePersonaResults } from "./wave3/aggregator";
import { triggerFilmstripGeneration } from "./filmstrip/queue";
// R1′b — the active audience flows in via PipelineOptions; buildAudienceRepaint projects it
// to the per-archetype repaint map the fold consumes (SAME projection the text SIM uses).
import type { Audience } from "@/lib/audience/audience-types";
import { buildAudienceRepaint } from "@/lib/engine/flash/build-reaction-panel";

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
  deepseekResult: { reasoning: DeepSeekReasoning; cost_cents: number } | null;

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

  // Phase 4 Plan 05: pass2Outcome is always null (10-pass deleted). Field kept for
  // type back-compat with persisted analysis_results rows produced before Plan 05.
  pass2Outcome: Wave3Pass2Outcome | null;

  // Plan 04-03 / Phase 4 Plan 05 — Fold outcome from runFold (the sole audience-sim path).
  // Populated when omniSegments are present (video_upload mode with Omni success).
  // Null in text mode / tiktok_url mode (no segments). Aggregator reads this unconditionally.
  foldOutcome: Wave3FoldOutcome | null;

  // Phase 3 (Plan 08) — Omni segments from Wave 0 (SegmentGrid[]).
  // Required by aggregator.assembleHeatmapPayload + buildWeightedCurve.
  // Undefined/empty when text mode or tiktok_url mode (no video segments).
  segments?: SegmentGrid[];

  // reading-ux 2026-06-15 (S1 tiktok-half) — Supabase Storage path of a KEPT video,
  // surfaced so the route can persist it on the analysis_results row (the retention
  // scrubber needs a playable source on permalink reload). Set ONLY for tiktok_url runs
  // that re-hosted into an owner-prefixed path AND succeeded (opts.userId present). Null
  // for video_upload (route persists validated.video_storage_path directly), text mode,
  // and any tiktok_url run whose re-host failed or had no userId (those temp objects are
  // dropped — see dropRehostTemp). Read by route.buildInsertRow's tiktok branch.
  video_storage_path?: string | null;

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
   * Phase 3 (Plan 08) D-11: analysis row ID. Required for triggerFilmstripGeneration
   * (the filmstrip API needs analysisId to write keyframe_uri for the board filmstrip UI).
   * When absent: filmstrip trigger is skipped.
   */
  analysisId?: string;
  /**
   * reading-ux 2026-06-15 (S1 tiktok-half): owner user id. When present for a
   * tiktok_url run, the re-hosted mp4 is written to an owner-prefixed path
   * (`${userId}/tiktok-${requestId}.mp4`) that `/api/videos/sign` accepts, and is
   * KEPT on success (surfaced via PipelineResult.video_storage_path) so the retention
   * scrubber can replay it on permalink reload. When absent, the re-host falls back to
   * the legacy `remix-temp/${requestId}.mp4` derive-and-drop path (deleted unconditionally).
   */
  userId?: string;
  /**
   * R1′b — the active calibrated audience for this Read (loaded from the user's open
   * thread `active_audience_id` by the analyze route, mirroring the generative skills).
   * The fold repaints its 10 archetypes with this audience's stored reaction frames so the
   * Read simulates the user's REAL audience (the moat: one audience substrate across every
   * skill). General / null / is_general → no repaint → byte-identical fold (regression-safe).
   */
  audience?: Audience;
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
// Source receipt — the scrape's own evidence, published for the in-flight Reading
// =====================================================

export interface SourceReceipt {
  cover_url: string | null;
  handle: string | null;
  views: number | null;
  video_url: string | null;
}

/**
 * Write the resolved post's cover / author / views to `variants.source` so the loading Reading
 * can show WHAT it is reading, seconds into a two-minute run.
 *
 * Graceful-degradation contract (mirrors triggerFilmstripGeneration): never throws, never
 * awaited by the pipeline. A receipt that fails to publish costs the user a thumbnail during
 * the wait — it must never cost them the run.
 *
 * The patch touches ONLY the `source` key, so it cannot clobber craft / apollo / remix /
 * filmstrip_segments written concurrently (Bug #7 lost-update).
 */
async function publishSourceReceipt(
  supabase: ReturnType<typeof createServiceClient>,
  analysisId: string,
  source: SourceReceipt,
): Promise<void> {
  // Nothing worth showing (no cover AND no author) → don't write an empty receipt.
  if (!source.cover_url && !source.handle) return;

  const { error } = await supabase.rpc("patch_analysis_variants", {
    p_id: analysisId,
    p_patch: { source } as unknown as Json,
  });

  if (error) {
    sourceLog.error("source receipt publish failed", { analysisId, error: error.message });
  }
}

const sourceLog = createLogger({ module: "engine.source-receipt" });

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
  // Plan 03 (INGEST-01 hard gate) — tiktok_url Omni branch (ADDITIVE else-if).
  //
  // Strategy: Option B (Supabase re-host with derive-and-drop) — spike §8.
  //   Rationale: resolved mp4Url is a PRIVATE api.apify.com KV record (anon GET → 403).
  //   Appending ?token= to feed Omni directly leaks a full-access Apify token to
  //   DashScope/Alibaba — unacceptable. Instead, download server-side with the token,
  //   re-host to videos bucket at a temp path, mint a short-TTL signed URL, feed that to
  //   Omni, then unconditionally delete the temp object in finally (derive-and-drop).
  //
  // Latency: resolve(25-38s) + download(~7MB) + upload + sign + Omni(35s) ≈ 70-90s <<
  //   maxDuration=300s (spike §5) — runs INLINE, no async split needed.
  //
  // Threat T-01-07 / pitfall C4: non-owned media must never persist past the request.
  //   The finally-delete is UNCONDITIONAL — it does NOT consult storage_retention_opted_in.
  //   buildInsertRow (route.ts:450-455) keeps video_storage_path null for tiktok_url.
  // -------------------------------------------------------
  let rehostPath: string | null = null;
  // reading-ux 2026-06-15 (S1 tiktok-half): the re-host path we KEEP + surface to the row
  // (set only after a full re-host success when an owner userId is available). Stays null
  // for the legacy derive-and-drop path so dropRehostTemp still cleans it up.
  let persistedVideoPath: string | null = null;
  const ownerId = opts?.userId;
  if (validated.input_mode === "tiktok_url" && validated.tiktok_url) {
    try {
      // Step 1: Resolve URL via ApifyScrapingProvider.resolveVideoUrl (Plan 02 impl).
      // The returned mp4Url is an SSRF-validated https://api.apify.com/...  URL.
      const resolver = new ApifyScrapingProvider();
      const resolved = await resolver.resolveVideoUrl(validated.tiktok_url);

      // Step 1b: publish the SOURCE RECEIPT — the first honest evidence of the run.
      //
      // The scrape lands within seconds and already holds the post's cover, author and view
      // count; the pipeline used to keep `mp4Url` and drop all of it. That left the in-flight
      // Reading with nothing to show for the first ~30s (keyframes only start after Wave 0), so
      // the user's opening impression of a 2-minute wait was a grey shimmer.
      //
      // Fire-and-forget, exactly like the filmstrip trigger: this is a UX affordance, and it
      // must never add latency to — or fail — the engine run.
      if (opts?.analysisId) {
        void publishSourceReceipt(supabase, opts.analysisId, {
          cover_url: resolved.coverUrl ?? null,
          handle: resolved.handle ?? null,
          views: resolved.views ?? null,
          video_url: resolved.videoUrl ?? validated.tiktok_url,
        });
      }

      // Step 2: Download mp4 bytes SERVER-SIDE with the Apify token.
      // Token is ONLY used for this server-side fetch — it is NEVER put in the URL
      // handed to Omni (which would leak it to DashScope). T-01-05 note: the
      // DAILY_LIMITS/429 check in route.ts:296-310 runs BEFORE the pipeline and is
      // mode-agnostic — it is the cost-exhaustion guard for tiktok_url requests.
      const tokenedUrl = `${resolved.mp4Url}?token=${process.env.APIFY_TOKEN ?? ""}`;
      const fetchResp = await fetch(tokenedUrl);
      if (!fetchResp.ok) {
        throw new Error(`mp4 download failed: HTTP ${fetchResp.status}`);
      }
      const mp4Bytes = await fetchResp.arrayBuffer();

      // Step 3: Re-host bytes to the videos bucket.
      // The path uses the requestId so concurrent requests never collide. reading-ux S1
      // (2026-06-15): when an owner userId is present, write under an owner-prefixed path so
      // `/api/videos/sign` (which enforces `path.split('/')[0] === user.id`) can mint a
      // playable URL on permalink reload, and KEEP it on success (set persistedVideoPath
      // below). Without a userId, fall back to the legacy remix-temp derive-and-drop path.
      rehostPath = ownerId
        ? `${ownerId}/tiktok-${requestId}.mp4`
        : `remix-temp/${requestId}.mp4`;
      const { error: uploadError } = await supabase
        .storage
        .from("videos")
        .upload(rehostPath, mp4Bytes, { contentType: "video/mp4", upsert: true });
      if (uploadError) {
        throw new Error(`re-host upload failed: ${uploadError.message}`);
      }

      // Step 4: Mint a short-lived signed URL (1 hour, mirrors pipeline.ts video_upload path).
      // This is the URL fed to analyzeVideoWithOmni — proven path from spike §8 / omni-analysis.ts
      // header ("Video is passed as a Supabase signed URL").
      const { data: signedData, error: signedError } = await supabase
        .storage
        .from("videos")
        .createSignedUrl(rehostPath, 3600);
      if (signedError || !signedData?.signedUrl) {
        throw new Error(
          `re-host signed URL failed: ${signedError?.message ?? "no URL returned"}`,
        );
      }

      // Step 5: Assign to signedVideoUrl — the same variable the gate at line 520 reads.
      // No rename: signedVideoUrl is read at 520/522/542/545/559; assigning here is minimal-diff.
      signedVideoUrl = signedData.signedUrl;

      // reading-ux S1 (2026-06-15): re-host fully succeeded (upload + signed URL). When an
      // owner userId is present the object lives at an owner-prefixed, signable path — KEEP it
      // and surface it to the row so the retention scrubber replays it on reload. Without a
      // userId persistedVideoPath stays null → dropRehostTemp deletes the legacy temp object.
      if (ownerId) persistedVideoPath = rehostPath;
    } catch (error) {
      // On IngestError or any re-host failure: push a warning and leave signedVideoUrl null
      // (graceful — the existing text branch fires; pipeline does NOT crash).
      const kind =
        error instanceof IngestError
          ? `[${error.kind}]`
          : "";
      warnings.push(
        `tiktok_url resolve/re-host unavailable${kind ? " " + kind : ""}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // If upload succeeded before the error, rehostPath is still set — cleaned in finally below.
    }
  }
  // DERIVE-AND-DROP: delete rehostPath unconditionally — but only AFTER the sighted calls
  // (Omni + fold) have fetched the signed URL. F7 (plan 01-05): the previous inline delete here
  // ran the fire-and-forget remove BEFORE those calls, racing their server-side fetch of the
  // signed URL (it only "worked" on nondeterministic timing). Deferred into a true post-pipeline
  // finally (see the Stage-9 await below) so cleanup runs on EVERY path (success AND failure)
  // without the race. NOT gated on storage_retention_opted_in. Separate from cleanupUploadedStorage
  // (owned uploads only — route.ts). Remix derive-and-drop boundary (T-01-07 / pitfall C4 / T-04-01).
  const dropRehostTemp = () => {
    if (rehostPath === null) return;
    // reading-ux S1 (2026-06-15): KEEP a fully re-hosted, owner-prefixed object on success —
    // it is surfaced via PipelineResult.video_storage_path and persisted on the row for the
    // retention scrubber. Only orphans (legacy remix-temp path, or a re-host that uploaded but
    // never reached signed-URL success → persistedVideoPath null) are dropped here. This runs in
    // the post-pipeline finally, so by then persistedVideoPath reflects the final keep/drop decision.
    if (rehostPath === persistedVideoPath) return;
    const pathToDelete = rehostPath;
    // Fire-and-forget + .catch() so a delete failure never crashes the pipeline.
    void supabase
      .storage
      .from("videos")
      .remove([pathToDelete])
      .catch((err: unknown) => {
        log.warn("remix_rehost_cleanup_failed", {
          err: err instanceof Error ? err.message : String(err),
          path: pathToDelete,
        });
      });
  };

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
        // Text-only analysis (no-video path). Reviewed 2026-06-25 (model policy): pin
        // determinism (temperature:0 + seed) + thinking OFF (3.7-plus defaults thinking ON →
        // latency) + a max_tokens rail (was unbounded → runaway risk). 5 factors + summaries
        // measure ~600-900 output → 2000 is ~2× headroom (rail, not lever).
        const geminiParams = {
          model,
          messages: [
            { role: "system", content: "You are a TikTok content analyst. Analyze the provided content and return a JSON object with fields: factors (array of 5 with name, score 0-10, rationale, improvement_tip), overall_impression (string), content_summary (string). Factor names must be exactly: Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge." },
            { role: "user",   content: `Analyze this TikTok content:\n\n${validated.content_text ?? "(no text provided)"}` },
          ],
          response_format: { type: "json_object" as const },
          temperature: 0,
          max_tokens: 2000,
        };
        // @ts-expect-error — DashScope extensions not in OpenAI types
        geminiParams.seed = QWEN_SEED;
        // @ts-expect-error — DashScope extension: thinking-off
        geminiParams.enable_thinking = false;
        const completion = await ai.chat.completions.create(geminiParams as never);
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

  // Run Wave 1 in parallel -- all stages gracefully degrade (HARD-03).
  // Plan 03 strip: audio + rules call sites removed; Wave 1 = gemini + creator only.
  const [geminiResult] = await timed(
    "wave_1",
    timings,
    () =>
      Promise.all([
        geminiPromise,
        creatorPromise,
      ]),
    { wave: 1, onEvent: onStageEvent }
  );
  const retrievalResult = createEmptyRetrievalResult();

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 1 complete",
    level: "info",
    data: { requestId, stages: ["gemini", "creator"] },
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
        // Plan 03-04 (R2): Thread verbatim hook into DeepSeekInput so Apollo can ground
        // rewrite.original in the literal spoken/on-screen line. Non-fatal — degrades
        // gracefully when hook_verbatim absent (text mode or Omni omitted the field).
        const hookRaw = (geminiResult.analysis as unknown as {
          hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
        })?.hook_verbatim;
        const verbatim: VerbatimPayload | null = hookRaw
          ? {
              hook: {
                spoken_words: hookRaw.spoken_words ?? null,
                on_screen_text: hookRaw.on_screen_text ?? null,
              },
            }
          : null;

        const result = await reasonWithDeepSeek({
          input: validated,
          gemini_analysis: geminiResult.analysis,
          rule_result: { rule_score: 50, matched_rules: [] },
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
          verbatim, // Plan 03-04 (R2): verbatim hook for Apollo rewrite grounding
          // Sighted reasoner (2026-06-06): Apollo (qwen3.6-plus) watches the video so its
          // hook judgment is grounded, not blind. Null in text/tiktok_url mode (no upload)
          // → reason degrades to text-only (byte-identical to the pre-video behavior + cache).
          videoUrl: signedVideoUrl,
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

  // Wave 2: DeepSeek only (Plan 03: trends + platform_fit call sites removed).
  const wave2Promise = timed("wave_2", timings, () =>
    Promise.all([deepseekPromise]),
    { wave: 2, onEvent: onStageEvent }
  );

  // -------------------------------------------------------
  // Wave 3: Single-call fold — the sole audience-sim path (Phase 4 Plan 05).
  // The 10× Pass-1 loop (runWave3) and 10× Pass-2 loop (runWave3Pass2) are DELETED.
  // runFold replaces both: one bounded qwen3.6-plus thinking call → all 10 archetypes.
  // Only invoked when omniSegments are present (video_upload mode with Omni success).
  // Skipped in text mode + tiktok_url mode (no segments) — foldOutcome stays null.
  // LATENCY NOTE: budget=1000 → ~90s (thin margin vs PER_CALL_TIMEOUT_MS=90s).
  //   Do not raise the timeout; lower budget or trim max_tokens for more headroom.
  // -------------------------------------------------------
  let foldOutcome: Wave3FoldOutcome | null = null;
  if (omniSegments && omniSegments.length > 0) {
    try {
      // Verbatim from geminiResult (same pluck as aggregator.ts ~544).
      // Non-fatal — fold proceeds with "" on omission.
      const hookRawForFold = (geminiResult.analysis as unknown as {
        hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
      })?.hook_verbatim;
      const verbatimText = hookRawForFold
        ? [hookRawForFold.spoken_words, hookRawForFold.on_screen_text].filter(Boolean).join(" ")
        : "";
      // emotion_arc: same pluck from geminiResult.analysis (mirrors aggregator.ts ~533-537).
      const emotionArcRaw = (geminiResult.analysis as unknown as {
        emotion_arc?: EmotionArcPoint[];
      })?.emotion_arc;
      const emotionArc: EmotionArcPoint[] = Array.isArray(emotionArcRaw) ? emotionArcRaw : [];
      // Select persona slots (same routing as the deleted Pass 1 for slot_type consistency).
      const { selectPersonaSlots } = await import("./wave3/persona-registry");
      const foldSlots = selectPersonaSlots(
        wave0Result.content_type?.type ?? null,
        wave0Result.niche?.primary_slug ?? null,
      );
      // R1′b — repaint the fold's 10 archetypes with the active calibrated audience's stored
      // reaction frames (the moat: the Read simulates the user's REAL audience, not generic
      // archetypes). buildAudienceRepaint is the SAME projection the text SIM uses, so both
      // skills simulate the audience identically. General/null/is_general → undefined → the
      // fold is byte-identical to pre-R1′b (regression-gate-safe; ENGINE_VERSION untouched).
      const foldAudienceRepaint = buildAudienceRepaint(opts?.audience ?? null);
      foldOutcome = await runFold(
        foldSlots,
        omniSegments,
        verbatimText,
        emotionArc,
        signedVideoUrl, // sighted/deaf fold: qwen3.7-plus watches the video; audio via Wave 0 audio_event
        onStageEvent,
        foldAudienceRepaint,
      );
      warnings.push(...foldOutcome.warnings);
    } catch (error) {
      Sentry.captureException(error, { tags: { stage: "wave_3_fold", requestId } });
      warnings.push(`Fold unavailable: ${error instanceof Error ? error.message : String(error)}`);
      // AUD-FAIL-01 — a fold that dies by THROWING is still a fold that was attempted, and it
      // must be scored exactly like one that dies by returning fold_success:false. Leaving
      // foldOutcome null here made the two indistinguishable from text mode (where no fold was
      // ever promised), so the aggregator took the apollo-vs-behavioral fallback and handed the
      // run the same 0.4 self-agreement bonus this fix exists to remove — a dead audience back
      // at HIGH confidence. Not a hypothetical branch: getQwenClient() and buildFoldUserContent()
      // run OUTSIDE runFold's per-attempt try, so a missing/rotated API key throws right here.
      // Record the attempt. Every other consumer of foldOutcome guards on fold_success, so a
      // failed outcome is inert to them (pass2_timeline=false, no heatmap, 0 cost) — the only
      // thing it changes is that the aggregator now knows the audience was supposed to exist.
      foldOutcome = {
        pass2Results: [],
        personaSimResults: [],
        warnings: [], // already pushed above — do not double-report
        cost_cents: 0,
        fold_success: false,
      };
    }
  }

  // Derive wave3Result + personaBehavioralAggregate from fold output (replaces the deleted
  // runWave3 return values). These fields are consumed by aggregator + audience-viz UI.
  // When fold failed (null or fold_success=false), fall back to empty / null.
  const foldPersonaSimResults = foldOutcome?.personaSimResults ?? [];
  const wave3Result: PersonaSimulationResult[] = foldPersonaSimResults;
  const { aggregate: foldAggregate } = foldPersonaSimResults.length > 0
    ? aggregatePersonaResults(foldPersonaSimResults)
    : { aggregate: null };
  const personaBehavioralAggregate: PersonaBehavioralAggregate | null = foldAggregate;
  // CR-01: wave-level cost (fold replaces the deleted Pass1+Pass2 cost).
  const wave3CostCents = foldOutcome?.cost_cents ?? 0;

  Sentry.addBreadcrumb({
    category: "engine.pipeline",
    message: "Wave 3 fold complete",
    level: "info",
    data: { requestId, fold_success: foldOutcome?.fold_success ?? false },
  });

  // Pass 2 outcome always null — 10-pass deleted (Phase 4 Plan 05).
  const pass2Outcome: Wave3Pass2Outcome | null = null;

  // Plan 03: Wave 2 = deepseek only (trends + platform_fit removed). Await deepseek.
  // F7 (plan 01-05): this is the last sighted-call await (Omni + fold already resolved above),
  // so the rehost temp cleanup runs HERE in a finally — after every sighted call has fetched the
  // signed URL, unconditionally on success OR failure (T-04-01), with no race.
  let wave2Result: Awaited<typeof wave2Promise>;
  try {
    wave2Result = await wave2Promise;
  } finally {
    dropRehostTemp();
  }
  const [deepseekRaw] = wave2Result;

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
    + wave3CostCents; // CR-01: fold cost tracked here; replaces deleted Pass1+Pass2 spend
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
    deepseekResult: deepseekRaw,
    wave0Result,
    // wave3Result sourced from fold adapters (fold.ts adaptFoldToPersonaSimResults).
    // Empty array when fold failed (no video segments, or fold call errored).
    wave3Result,
    // personaBehavioralAggregate from fold-sourced aggregatePersonaResults.
    // Null when fold failed or fewer than threshold personas returned.
    personaBehavioralAggregate,
    // CR-01: fold cost in cents (replaces deleted Pass1+Pass2 wave cost).
    wave3CostCents,
    retrievalResult, // Phase 8 D-09 (Plan 04) — graceful-degradation BenchmarkRetrievalResult
    pass2Outcome,    // Always null — 10-pass deleted (Phase 4 Plan 05).
    foldOutcome,     // Phase 4 Plan 05 — sole audience-sim; null in text/tiktok_url mode.
    segments: omniSegments, // SegmentGrid[] for aggregator.assembleHeatmapPayload
    // reading-ux S1 (2026-06-15): KEPT tiktok re-host path (null unless an owner userId was
    // provided and the re-host fully succeeded). Route persists it for tiktok_url rows.
    video_storage_path: persistedVideoPath,
    requestId,
    timings,
    total_duration_ms,
    warnings,
  };

}
