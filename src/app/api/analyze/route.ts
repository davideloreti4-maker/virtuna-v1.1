import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores } from "@/lib/engine/aggregator";
import { AnalysisInputSchema } from "@/lib/engine/types";
import {
  computeContentHash,
  lookupPredictionCache,
  populatePredictionCache,
} from "@/lib/engine/cache/prediction-cache";
import type { StageEvent } from "@/lib/engine/events";
import type { PredictionResult } from "@/lib/engine/types";
import type { Json } from "@/types/database.types";

/**
 * Phase 3 — Vercel Fluid Compute route config.
 * Per RESEARCH Pitfalls 1+2 + State of the Art:
 * - nodejs runtime required for long-lived SSE
 * - force-dynamic prevents Vercel route caching of the stream
 * - maxDuration=300 (Fluid Compute default); bump to 800 on Pro if needed
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// INFRA-01: Rate limits by subscription tier (daily analysis count)
const DAILY_LIMITS: Record<string, number> = {
  free: 5,
  starter: 50,
  pro: Infinity, // unlimited
};

/**
 * POST /api/analyze
 *
 * Accepts content + type + society, runs prediction engine,
 * streams progress via SSE, returns PredictionResult.
 *
 * v2: Uses runPredictionPipeline() + aggregateScores() pattern
 * instead of direct engine module calls.
 *
 * INFRA-01: Rate limiting by subscription tier
 * INFRA-04: Input validation (TikTok URL, content length, video path)
 */
export async function POST(request: Request) {
  const requestId = nanoid(12);
  const log = createLogger({ requestId, module: "analyze" });

  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // -------------------------------------------------------
    // INFRA-04: Input validation (before Zod parse for better error messages)
    // -------------------------------------------------------

    // Content text basic validation
    if (body.content_text && typeof body.content_text === "string") {
      const trimmed = body.content_text.trim();

      // Max length
      if (body.content_text.length > 10000) {
        return Response.json(
          { error: "Content text exceeds maximum length of 10,000 characters" },
          { status: 400 }
        );
      }

      // Min length (also rejects whitespace-only since trim reduces those to "")
      if (trimmed.length < 10) {
        return Response.json(
          { error: "Content text must be at least 10 characters after trimming" },
          { status: 400 }
        );
      }

      // Anti-spam: reject >90% repeated characters
      const charCounts = new Map<string, number>();
      for (const ch of trimmed) {
        charCounts.set(ch, (charCounts.get(ch) ?? 0) + 1);
      }
      const maxCharCount = Math.max(...charCounts.values());
      if (maxCharCount / trimmed.length > 0.9) {
        return Response.json(
          { error: "Content appears to be spam (excessive repeated characters)" },
          { status: 400 }
        );
      }
    }

    // TikTok URL format validation
    if (body.input_mode === "tiktok_url" && body.tiktok_url) {
      const tiktokPattern = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//;
      if (!tiktokPattern.test(body.tiktok_url)) {
        return Response.json(
          { error: "Invalid TikTok URL. Must be a tiktok.com link." },
          { status: 400 }
        );
      }
    }

    // Video storage path validation
    if (body.input_mode === "video_upload") {
      if (
        typeof body.video_storage_path !== "string" ||
        body.video_storage_path.length === 0 ||
        body.video_storage_path === "pending-upload"
      ) {
        return Response.json(
          { error: "Invalid video storage path" },
          { status: 400 }
        );
      }
    }

    // -------------------------------------------------------
    // INFRA-01: Rate limiting by subscription tier
    // -------------------------------------------------------

    // Service client created before stream — used for rate limit check AND inside stream
    const service = createServiceClient();

    // Query user's subscription tier
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("virtuna_tier")
      .eq("user_id", user.id)
      .single();
    const tier = (subscription?.virtuna_tier as string) || "free";

    // Phase 11 (INT-05/D-04): Read retention opt-in preference once — gates both branches.
    const { data: creatorProfile } = await supabase
      .from("creator_profiles")
      .select("storage_retention_opted_in")
      .eq("user_id", user.id)
      .maybeSingle();
    const retentionOptedIn = creatorProfile?.storage_retention_opted_in ?? false;

    // Query today's usage count
    const today = new Date().toISOString().split("T")[0]!;
    const { data: usage } = await service
      .from("usage_tracking")
      .select("analysis_count")
      .eq("user_id", user.id)
      .eq("period_start", today)
      .eq("period_type", "daily")
      .single();
    const currentCount = usage?.analysis_count ?? 0;

    // Check against limit
    const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.free!;
    if (currentCount >= limit) {
      return Response.json(
        {
          error: "Daily analysis limit reached",
          limit,
          tier,
          reset: "midnight UTC",
        },
        { status: 429 }
      );
    }

    // -------------------------------------------------------
    // Phase 3 — Accept-header content negotiation (CONTEXT D-03)
    // -------------------------------------------------------
    // Default to SSE for backwards compat (existing client doesn't send Accept; treat as SSE).
    // Explicit `Accept: application/json` opts into the JSON one-shot response.
    const acceptHeader = request.headers.get("accept") ?? "";
    const wantsSSE =
      acceptHeader.includes("text/event-stream") ||
      acceptHeader === "" ||
      acceptHeader.includes("*/*");
    const wantsJSON =
      acceptHeader.includes("application/json") &&
      !acceptHeader.includes("text/event-stream");
    void wantsSSE; // referenced for traceability; default branch when not JSON

    // -------------------------------------------------------
    // Phase 3 — Validate input + compute content hash + cache lookup
    // (must run BEFORE SSE/JSON branch so cache short-circuits both paths)
    // -------------------------------------------------------
    let validated: ReturnType<typeof AnalysisInputSchema.parse>;
    try {
      validated = AnalysisInputSchema.parse(body);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid input" },
        { status: 400 }
      );
    }

    // CONTEXT D-15 — bypass_cache from query param OR body (eval harness)
    const url = new URL(request.url);
    const bypassCache =
      url.searchParams.get("bypass_cache") === "true" ||
      (body as { bypass_cache?: boolean }).bypass_cache === true;

    // CONTEXT D-10 — content hash. Route does not hold the video buffer (Gemini
    // downloads it inside the pipeline); for video_upload mode hash falls back to
    // the trimmed content_text via computeContentHash's fallback branch.
    const contentHash = computeContentHash(validated);

    // CONTEXT D-09 — two-tier cache lookup BEFORE pipeline call. <2s typical on hit.
    const cached = await lookupPredictionCache(contentHash, user.id, {
      bypass: bypassCache,
    });
    if (cached) {
      log.info("cache_hit — silent replay", {
        contentHash,
        userId: user.id,
        engineVersion: cached.engine_version,
      });

      if (wantsJSON) {
        return Response.json(cached);
      }

      // SSE cache-hit — single `event: complete` with cached payload.
      const cacheEncoder = new TextEncoder();
      const cachedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            cacheEncoder.encode(
              `event: complete\ndata: ${JSON.stringify(cached)}\n\n`
            )
          );
          controller.close();
        },
      });
      return new Response(cachedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          Vary: "Accept",
        },
      });
    }

    // Shared INSERT builder — produces the analysis_results row for either branch.
    const buildInsertRow = (
      finalResult: PredictionResult,
      ruleContributions: Array<Record<string, unknown>>
    ) => ({
      user_id: user.id,
      content_text: validated.content_text ?? "",
      content_type: validated.content_type,
      society_id: validated.society_id ?? null,
      overall_score: finalResult.overall_score,
      confidence: finalResult.confidence,
      factors: finalResult.factors as unknown as null,
      suggestions: finalResult.suggestions as unknown as null,
      rule_score: finalResult.rule_score,
      trend_score: finalResult.trend_score,
      score_weights: finalResult.score_weights as unknown as null,
      latency_ms: finalResult.latency_ms,
      cost_cents: finalResult.cost_cents,
      engine_version: finalResult.engine_version,
      gemini_model: finalResult.gemini_model,
      deepseek_model: finalResult.deepseek_model,
      // v2 columns (from Phase 4 migration)
      behavioral_predictions:
        finalResult.behavioral_predictions as unknown as null,
      feature_vector: finalResult.feature_vector as unknown as null,
      reasoning: finalResult.reasoning,
      warnings: finalResult.warnings,
      input_mode: finalResult.input_mode,
      has_video: finalResult.has_video,
      gemini_score: finalResult.gemini_score,
      ml_score: finalResult.ml_score,
      // CAL-02: Calibration status for every result
      is_calibrated: finalResult.is_calibrated,
      // RULE-03: Per-rule contribution tracking for accuracy computation
      rule_contributions: ruleContributions as unknown as null,
      // Phase 3 — provenance columns (typed in database.types.ts after Plan 04 regen).
      // content_hash is `string` → matches `string | null` directly (no cast).
      // signal_availability cast to Json: the SignalAvailability interface is structurally
      // a Json object (boolean keys), but TS doesn't infer recursive Json subtyping.
      content_hash: contentHash,
      signal_availability: finalResult.signal_availability as unknown as Json,
      // Phase 6 (Note 7 / Q4 RESOLVED — Plan 06-06) — persist the verbatim Gemini
      // audio_description for debugging + future ML training. Aggregator sources
      // it from `geminiResult.analysis.audio_signals?.audio_description ?? null`;
      // null when audio_signals absent. Column added by Plan 06-02 migration.
      audio_description: finalResult.audio_description ?? null,
      // Phase 11 (INT-05): Persist Supabase Storage path so retention cron can delete it.
      // Only set for video_upload mode; null for tiktok_url/text modes.
      video_storage_path:
        validated.input_mode === "video_upload" && validated.video_storage_path
          ? validated.video_storage_path
          : null,
    });

    // -------------------------------------------------------
    // JSON branch (CONTEXT D-03) — runs pipeline + aggregator inline.
    // No onStageEvent — JSON callers don't get stage events.
    // -------------------------------------------------------
    if (wantsJSON) {
      const pipelineResult = await runPredictionPipeline(validated, {
        requestId,
        bypassCache,
      });
      const result = await aggregateScores(pipelineResult);

      const ruleContributions = pipelineResult.ruleResult.matched_rules.map(
        (r) => ({
          rule_id: r.rule_id,
          rule_name: r.rule_name,
          score: r.score,
          max_score: r.max_score,
          tier: r.tier,
        })
      );

      const finalResult: PredictionResult = {
        ...result,
        warnings: [...pipelineResult.warnings, ...result.warnings],
      };

      const { error: insertError } = await service
        .from("analysis_results")
        .insert(buildInsertRow(finalResult, ruleContributions));

      if (insertError) {
        log.error("DB insert failed (json)", { error: insertError.message });
      } else {
        populatePredictionCache(contentHash, user.id, finalResult, {
          bypass: bypassCache,
        });
      }

      // Track usage
      await service.from("usage_tracking").upsert(
        {
          user_id: user.id,
          period_start: today,
          period_type: "daily",
          analysis_count: currentCount + 1,
        },
        { onConflict: "user_id,period_start,period_type" }
      );

      // Phase 11 (INT-05/D-04): Delete uploaded video only if user has NOT opted into retention.
      // Opted-in users keep their video; retention cron handles 30-day expiry.
      if (
        validated.input_mode === "video_upload" &&
        validated.video_storage_path &&
        !retentionOptedIn
      ) {
        service.storage
          .from("videos")
          .remove([validated.video_storage_path])
          .catch(() => {
            // Best-effort cleanup — don't fail the response
          });
      }

      // Phase 11 (PROFILE-16/D-08): Atomic lifetime analysis counter — triggers banner at count % 10.
      // Uses DB function to avoid read-then-write race condition.
      // Fire-and-forget: counter failure must NOT break the analysis response.
      void (async () => {
        const { error } = await service.rpc("increment_creator_analysis_count", { p_user_id: user.id });
        if (error) {
          log.error("analysis_count increment failed", { error: error.message });
        }
      })();

      return Response.json(finalResult);
    }

    // -------------------------------------------------------
    // SSE stream setup (default branch — preserves existing client contract)
    // -------------------------------------------------------
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Phase 1: Run full pipeline (handles Wave 1 + Wave 2 internally).
          // Phase 3 — forward fine-grained stage events to SSE client as `event: stage`.
          send("phase", {
            phase: "analyzing",
            message:
              "Analyzing content with Gemini and loading creator context...",
          });
          const pipelineResult = await runPredictionPipeline(validated, {
            requestId,
            bypassCache,
            onStageEvent: (event: StageEvent) => {
              send("stage", event);
            },
          });

          // Phase 2: Aggregate scores — pass onStageEvent so Stage 10/11 stubs forward.
          send("phase", {
            phase: "scoring",
            message: "Calculating predictions and assembling results...",
          });
          const result = await aggregateScores(pipelineResult, /* onStageEvent: */ (event: StageEvent) => {
            send("stage", event);
          });

          // Build rule_contributions JSONB for per-rule tracking (RULE-03)
          const ruleContributions = pipelineResult.ruleResult.matched_rules.map(r => ({
            rule_id: r.rule_id,
            rule_name: r.rule_name,
            score: r.score,
            max_score: r.max_score,
            tier: r.tier,
          }));

          // Prepend pipeline warnings (partial failures) before DeepSeek warnings
          const finalResult: PredictionResult = {
            ...result,
            warnings: [...pipelineResult.warnings, ...result.warnings],
          };

          // Persist to DB with v2 + Phase 3 columns
          const { error: insertError } = await service
            .from("analysis_results")
            .insert(buildInsertRow(finalResult, ruleContributions));

          if (insertError) {
            log.error("DB insert failed", { error: insertError.message });
          } else {
            // Phase 3 — hydrate L1 cache after successful INSERT (CONTEXT D-15 symmetric bypass).
            populatePredictionCache(contentHash, user.id, finalResult, {
              bypass: bypassCache,
            });
          }

          // Track usage (increments AFTER successful analysis)
          await service.from("usage_tracking").upsert(
            {
              user_id: user.id,
              period_start: today,
              period_type: "daily",
              analysis_count: currentCount + 1,
            },
            { onConflict: "user_id,period_start,period_type" }
          );

          send("complete", finalResult);

          // Phase 11 (INT-05/D-04): Opt-in gate (mirrors JSON branch).
          if (
            validated.input_mode === "video_upload" &&
            validated.video_storage_path &&
            !retentionOptedIn
          ) {
            service.storage
              .from("videos")
              .remove([validated.video_storage_path])
              .catch(() => {
                // Best-effort cleanup — don't fail the response
              });
          }

          // Phase 11 (PROFILE-16/D-08): Atomic lifetime analysis counter (mirrors JSON branch).
          void (async () => {
            const { error } = await service.rpc("increment_creator_analysis_count", { p_user_id: user.id });
            if (error) {
              log.error("analysis_count increment failed", { error: error.message });
            }
          })();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Pipeline failed";
          send("error", { error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        Vary: "Accept",
      },
    });
  } catch (error) {
    log.error("Request error", {
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, {
      tags: { stage: "analyze_route", requestId },
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
