import * as Sentry from "@sentry/nextjs";
// `after` import removed (Plan 02, R9): scheduleDeferredCounterfactuals deleted; after() no longer used.
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import { createLogger } from "@/lib/logger";
import { getReadingQuotaVerdict } from "@/lib/billing/quota";
import { recordReading } from "@/lib/billing/record-reading";
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";
import { resolvePack } from "@/lib/engine/packs";
// R1′b — load the user's active calibrated audience (same per-thread pin the generative
// skills use) so the Read fold simulates the REAL audience, not generic archetypes.
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
// stage11-counterfactuals import removed (Plan 02, R9): deferred re-run block deleted below.
import { AnalysisInputSchema } from "@/lib/engine/types";
import {
  computeContentHash,
  lookupPredictionCache,
  populatePredictionCache,
} from "@/lib/engine/cache/prediction-cache";
import type { StageEvent } from "@/lib/engine/events";
import type { PredictionResult } from "@/lib/engine/types";
import type { Json } from "@/types/database.types";
// Phase 03 Plan 02 — decode branch imports
import { resolveAndRehost } from "@/lib/engine/remix/resolve-and-rehost";
import { analyzeVideoWithOmni } from "@/lib/engine/qwen/omni-analysis";
import { runDecode, omniOutputToStructuralInput } from "@/lib/engine/remix/decode";
import type { DecodeResult } from "@/lib/engine/remix/decode-types";

/**
 * Phase 3 — Vercel Fluid Compute route config.
 * Per RESEARCH Pitfalls 1+2 + State of the Art:
 * - nodejs runtime required for long-lived SSE
 * - force-dynamic prevents Vercel route caching of the stream
 * - maxDuration=300 (Fluid Compute default); bump to 800 on Pro if needed
 */

// -------------------------------------------------------
// Phase 3 (quick task 260528-nsb) — Orphan storage cleanup helpers
//
// cleanupUploadedStorage: Use after Zod validation succeeds (validated is available).
// cleanupRawUpload: Use on early-return branches before Zod parse (only body available).
//
// NOT covered here (deferred — requires client-side try/finally):
//   - Auth fail (line ~59): `body` not yet read; cleanup would need AbortController hook in Board.tsx
//   - 413 content-length reject (line ~68): same — storage object may exist before POST reaches server
// -------------------------------------------------------

type ServiceClient = ReturnType<typeof createServiceClient>;
type Logger = ReturnType<typeof createLogger>;

/**
 * R11 layer 2 — lazy follower backfill (fire-and-forget).
 *
 * Mirrors the best-effort scrape /api/profile PATCH fires, but triggered from the
 * analyze path so a handle set during onboarding (which never hit that PATCH) still
 * gets its `tiktok_followers` populated. Intentionally NOT awaited: the scrape can be
 * slow/flaky and must not enter the ≤90s critical path. Populates the column for the
 * user's next run; failures are swallowed (the R11 range simply stays absent until a
 * later scrape succeeds — honest null, never fabricated).
 *
 * Concurrency note (code review): N analyses submitted before the first scrape
 * writes back will each see followers<=0 and fire their own scrape (N Apify runs
 * for one user). Accepted at current traffic — Apify resolves to the same profile
 * (idempotent last-write-wins) and the cost is a few redundant runs, not corruption.
 * Revisit with an advisory lock / short-TTL suppress flag if scrape volume grows.
 */
function backfillCreatorFollowers(
  service: ServiceClient,
  userId: string,
  tiktokHandle: string,
  log: Logger
): void {
  const handle = tiktokHandle.replace(/^@/, "");
  void (async () => {
    try {
      const scraper = createScrapingProvider();
      const profileData = await scraper.scrapeProfile(handle);
      await service
        .from("creator_profiles")
        .update({
          display_name: profileData.displayName,
          tiktok_followers: profileData.followerCount,
          avatar_url: profileData.avatarUrl,
          bio: profileData.bio,
        })
        .eq("user_id", userId);
      log.info("R11 follower backfill complete", { handle });
    } catch (err) {
      log.warn("R11 follower backfill failed (non-blocking)", {
        handle,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

function cleanupUploadedStorage(
  service: ServiceClient,
  validated: { input_mode: string; video_storage_path?: string | null },
  retentionOptedIn: boolean,
  log: Logger
): void {
  if (
    validated.input_mode === "video_upload" &&
    validated.video_storage_path &&
    !retentionOptedIn
  ) {
    service.storage
      .from("videos")
      .remove([validated.video_storage_path])
      .catch((err: unknown) => {
        log.warn("storage_cleanup_failed", {
          err: err instanceof Error ? err.message : String(err),
          path: validated.video_storage_path,
        });
      });
  }
}

function cleanupRawUpload(
  service: ServiceClient,
  body: Record<string, unknown>,
  retentionOptedIn: boolean,
  log: Logger
): void {
  if (
    body.input_mode === "video_upload" &&
    typeof body.video_storage_path === "string" &&
    body.video_storage_path &&
    !retentionOptedIn
  ) {
    service.storage
      .from("videos")
      .remove([body.video_storage_path])
      .catch((err: unknown) => {
        log.warn("storage_cleanup_failed", {
          err: err instanceof Error ? err.message : String(err),
          path: body.video_storage_path,
        });
      });
  }
}

/**
 * Stash the board "Content craft" frame's signals into analysis_results.variants.craft.
 *
 * These four signals (video_signals, cta_segment, audio_signals, audio_perceptual_score)
 * plus the editorial copy (overall_impression, content_summary) are emitted by the Omni
 * Wave-1 analysis but have no dedicated DB column. Rather than a migration, we persist
 * them into the existing `variants` JSONB — the same extensibility bag the filmstrip
 * background task uses for `filmstrip_segments`.
 *
 * Atomic single-key patch via patch_analysis_variants: the deep-merge runs inside one
 * UPDATE, so a concurrent writer (apollo / decode / the fire-and-forget filmstrip extract)
 * can never clobber a sibling key — no read-modify-write window (Bug #7). Non-fatal: a
 * failure here only blanks the Craft pillars, never the analysis itself.
 */
async function persistCraftToVariants(
  service: ServiceClient,
  id: string,
  userId: string,
  finalResult: PredictionResult,
  log: Logger,
): Promise<void> {
  const craft = {
    video_signals: finalResult.video_signals ?? null,
    cta_segment: finalResult.cta_segment ?? null,
    audio_signals: finalResult.audio_signals ?? null,
    audio_perceptual_score: finalResult.audio_perceptual_score ?? null,
    overall_impression: finalResult.overall_impression ?? null,
    content_summary: finalResult.content_summary ?? null,
  };
  // Skip the round-trip entirely when there is nothing craft-worthy to persist
  // (text / tiktok_url modes never produce video_signals or a cta_segment).
  if (craft.video_signals === null && craft.cta_segment === null && craft.audio_signals === null) {
    return;
  }
  try {
    // Atomic single-key patch — Postgres deep-merges `craft` into variants in one UPDATE,
    // so there is no read-modify-write window that a concurrent apollo/decode/filmstrip
    // writer can clobber (Bug #7 lost-update fix). p_user_id enforces CR-02 in the RPC.
    const { error: writeErr } = await service.rpc("patch_analysis_variants", {
      p_id: id,
      p_patch: { craft } as unknown as Json,
      p_user_id: userId,
    });
    if (writeErr) {
      log.warn("craft_variants_write_failed", { id, error: writeErr.message });
    }
  } catch (err) {
    log.warn("craft_variants_persist_threw", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// scheduleDeferredCounterfactuals removed (Plan 02, R9): stage11 deferred re-run deleted.
// counterfactuals stays null (whatever the pipeline produced). stage11-counterfactuals.ts
// moves to _dormant/ in Plan 05. The after() import above is also removed.

/**
 * Phase 03 Plan 04 (D-04) — Persist Apollo §4 output into variants.apollo.
 *
 * Atomic key-patch (patch_analysis_variants): the RPC deep-merges apollo / engagement_range
 * / hero into variants in one UPDATE, preserving craft + remix siblings under concurrency —
 * no read-modify-write window. Non-fatal: a failure here only blanks the Apollo frame.
 *
 * Threat T-03-09: the deep merge preserves craft + remix (no wholesale overwrite).
 * Threat T-03-10: p_user_id enforces V4 access control in the RPC's WHERE clause.
 *
 * Score-mode path only (NOT remix): called after the SSE upsert + craft persist.
 */
async function persistApolloToVariants(
  service: ServiceClient,
  id: string,
  userId: string,
  finalResult: PredictionResult,
  log: Logger,
): Promise<void> {
  const apollo = finalResult.apollo_reasoning;
  // R11 (surface + persist): the grounded engagement range. computeEngagementRange
  // returns null when no creator baseline exists (R9 honesty) — persist only a real
  // range, so permalink reload mirrors the live null-gate exactly.
  const engagement_range = finalResult.predicted_engagement;
  // F42 (plan 01-04): persist the hero block alongside apollo + engagement_range so a shared/
  // saved board permalink shows what the live run showed. Rides variants.hero — NO migration.
  const hero = finalResult.hero;
  // Skip only when there's nothing to persist (Apollo skipped AND no range AND no hero).
  if (!apollo && !engagement_range && !hero) return;

  try {
    // Patch only the keys this writer owns; the RPC deep-merges them into variants
    // atomically, preserving craft / remix / filmstrip_segments siblings under
    // concurrency (Bug #7). p_user_id enforces V4 access control (T-03-10) in the RPC.
    const patch: Record<string, unknown> = {};
    if (apollo) patch.apollo = apollo;
    if (engagement_range) patch.engagement_range = engagement_range;
    if (hero) patch.hero = hero; // F42 — hero block survives permalink reload
    const { error: writeErr } = await service.rpc("patch_analysis_variants", {
      p_id: id,
      p_patch: patch as unknown as Json,
      p_user_id: userId,
    });
    if (writeErr) {
      log.warn("apollo_variants_write_failed", { id, error: writeErr.message });
    }
  } catch (err) {
    log.warn("apollo_variants_persist_threw", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Phase 03 Plan 02 — Persist decode result into variants.remix.decode.
 *
 * Atomic nested patch (patch_analysis_variants): the RPC's DEEP merge sets
 * variants.remix.decode while preserving remix.adapt + the craft / filmstrip_segments
 * siblings — one UPDATE, no read-modify-write window under concurrency.
 * Non-fatal: a failure here only blanks the Decode frame, never the row itself.
 *
 * Threat T-03-04: the deep merge preserves craft + filmstrip_segments + remix.adapt.
 */
async function persistDecodeToVariants(
  service: ServiceClient,
  id: string,
  userId: string,
  decode: DecodeResult,
  log: Logger,
): Promise<void> {
  try {
    // Nested patch: the RPC's DEEP merge sets variants.remix.decode while preserving
    // remix.adapt / remix.filmstrip siblings — atomically, in one UPDATE, so a concurrent
    // craft/apollo/filmstrip writer can't clobber it (Bug #7). CR-02 enforced via p_user_id.
    const { error: writeErr } = await service.rpc("patch_analysis_variants", {
      p_id: id,
      p_patch: { remix: { decode } } as unknown as Json,
      p_user_id: userId,
    });
    if (writeErr) {
      log.warn("decode_variants_write_failed", { id, error: writeErr.message });
    }
  } catch (err) {
    log.warn("decode_variants_persist_threw", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Phase 03 Plan 02 — Lightweight decode path for mode:'remix'.
 *
 * Runs: resolveAndRehost → analyzeVideoWithOmni → runDecode → persistDecodeToVariants
 * Emits: started, phase, complete (with overall_score:null + variants.remix.decode)
 *
 * NEVER calls runPredictionPipeline, aggregateScores, or usage_tracking upsert (pitfall C2).
 * ALWAYS calls cleanup() in finally (derive-and-drop, pitfall C4).
 * overall_score stays null — completion marker is variants.remix != null (pitfall m3).
 */
async function runDecodeStream(
  controller: ReadableStreamDefaultController,
  send: (event: string, data: unknown) => void,
  opts: {
    service: ServiceClient;
    validated: ReturnType<typeof AnalysisInputSchema.parse>;
    analysisId: string;
    userId: string;
    log: Logger;
  },
): Promise<void> {
  const { service, validated, analysisId, userId, log } = opts;

  send("started", { id: analysisId });
  send("phase", { phase: "analyzing", message: "Decoding structure…" });

  // Derive-and-drop: always call cleanup() in finally (T-03-02 / pitfall C4)
  const { signedUrl, cleanup } = await resolveAndRehost(
    validated.tiktok_url!,
    analysisId,
  );

  let decode: DecodeResult | null = null;
  try {
    const omni = await analyzeVideoWithOmni(signedUrl);
    const structural = omniOutputToStructuralInput(omni);
    decode = structural ? await runDecode(structural) : null;
    if (decode) {
      await persistDecodeToVariants(service, analysisId, userId, decode, log);
    }
    send("complete", {
      id: analysisId,
      mode: "remix",
      overall_score: null,
      variants: { remix: { decode } },
    });
  } finally {
    // Unconditional cleanup — deletes temp mp4 regardless of decode outcome (pitfall C4)
    await cleanup();
    // Guard: client cancel (navigation) may have already closed the stream.
    try {
      controller.close();
    } catch {
      /* already closed/cancelled */
    }
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// INFRA-01: Rate limits by subscription tier (daily analysis count)
const DAILY_LIMITS: Record<string, number> = {
  free: 50, // bumped for Phase 13 E2E testing
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

    // BILLING — a Reading is the metered unit (Creator 50/mo · Pro 150/mo · Studio
    // unlimited), so the meter is checked HERE, before any engine spend. Inert until
    // BILLING_ENFORCE_QUOTA=true: the verdict is computed and logged either way, so the
    // real usage can be watched before the gate ever closes on a customer. Quota failures
    // fail OPEN (see lib/billing/quota.ts) — a flaky count must not cost a paid Reading.
    const quota = await getReadingQuotaVerdict(supabase, user.id);
    if (quota.enforced && !quota.allowed) {
      log.info("quota exceeded", {
        tier: quota.tier,
        used: quota.used,
        limit: quota.limit,
        inTrial: quota.inTrial,
      });

      // Three different dead-ends, three different things to say. A trialling customer has
      // NOT hit their plan's limit — they've spent the trial pool, and the honest next step
      // is "your plan starts on day 4", not "upgrade".
      const message = quota.inTrial
        ? `Your $1 trial includes ${quota.limit} Readings. Your full plan allowance starts when the trial converts.`
        : quota.limit === 0
          ? "Start a plan to run a Reading."
          : `You've used all ${quota.limit} Readings on your plan this month.`;

      return Response.json(
        {
          error: "reading_quota_exceeded",
          message,
          tier: quota.tier,
          used: quota.used,
          limit: quota.limit,
          inTrial: quota.inTrial,
        },
        { status: 402 } // Payment Required — the client turns this into the upgrade prompt.
      );
    }

    // D-19 (Phase 13 Plan 03): Fail fast before buffer load for oversized requests.
    // Defense-in-depth: even if header is missing/spoofed, pipeline.ts:VIDEO_MAX_SIZE_BYTES
    // check catches it after buffer load. T-13-14 mitigation.
    const contentLengthHeader = request.headers.get("content-length");
    const MAX_BODY_BYTES = 287 * 1024 * 1024; // 287MB — matches VIDEO_MAX_SIZE_BYTES
    if (contentLengthHeader && parseInt(contentLengthHeader, 10) > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Video exceeds 287MB limit" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
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

    // TikTok URL format validation — WR-01: shared trust-boundary regex
    // (src/lib/tiktok-url.ts), byte-identical to the client composer check so
    // the two cannot drift (the client previously carried a looser /i flag).
    if (body.input_mode === "tiktok_url" && body.tiktok_url) {
      if (!TIKTOK_URL_PATTERN.test(body.tiktok_url)) {
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
      .select("storage_retention_opted_in, tiktok_handle, tiktok_followers")
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
    // Plan 03 (INGEST-01 / T-01-05): this check is MODE-AGNOSTIC — it runs before the
    // pipeline stream for ALL input_mode values including "tiktok_url".
    // This is the cost-exhaustion guard for the remix path: paste-spam cannot trigger
    // unbounded billable Apify resolves. Do NOT add a second rate limiter for tiktok_url.
    const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.free!;
    if (currentCount >= limit) {
      // Phase 3 (260528-nsb): cleanup orphan before 429 return — body + retentionOptedIn available here.
      cleanupRawUpload(service, body as Record<string, unknown>, retentionOptedIn, log);
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
      // Phase 3 (260528-nsb): cleanup orphan on Zod validation failure — body + retentionOptedIn available.
      cleanupRawUpload(service, body as Record<string, unknown>, retentionOptedIn, log);
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid input" },
        { status: 400 }
      );
    }

    // R11 (P5 UAT fix): thread the signed-in user's own creator handle into the
    // pipeline input so fetchCreatorContext can load their follower_count for the
    // grounded engagement range. The client input never carries creator_handle, so
    // without this the pipeline always cold-starts (follower_count null) and R11's
    // EngagementRange stays dormant in the product even though the compute is correct.
    if (!validated.creator_handle && creatorProfile?.tiktok_handle) {
      validated.creator_handle = creatorProfile.tiktok_handle;
    }

    // R11 layer 2 (backfill on first analyze): the onboarding handle step writes
    // tiktok_handle directly and never fires the follower scrape that /api/profile
    // PATCH triggers, so tiktok_followers stays null → R11's range can't render even
    // with the handle threaded above. Lazily fire that same best-effort scrape here
    // whenever a handle exists but the follower count is missing. Fire-and-forget
    // (never awaited) so it adds ZERO latency to the ≤90s budget: THIS run still
    // cold-starts, but the column is populated for the user's next analysis — which
    // is what "backfill on first analyze" means. Self-healing for any handle-having
    // user regardless of how their handle was set (onboarding or otherwise).
    // Trigger when the count is null/undefined OR <= 0: computeEngagementRange
    // (aggregator.ts) treats follower_count <= 0 as "no baseline" and suppresses
    // the range, so a stale `0` is just as dormant as null and must also backfill.
    if (
      creatorProfile?.tiktok_handle &&
      (creatorProfile.tiktok_followers == null || creatorProfile.tiktok_followers <= 0)
    ) {
      backfillCreatorFollowers(service, user.id, creatorProfile.tiktok_handle, log);
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

      // Phase 3 (260528-nsb) Mode A fix: cache hit returns without persisting video_storage_path
      // for the NEW upload, so the uploaded object becomes an orphan. Clean it up now.
      // Single call covers both wantsJSON and SSE sub-branches below.
      cleanupUploadedStorage(service, validated, retentionOptedIn, log);

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
      _ruleContributions: Array<Record<string, unknown>>,
      // reading-ux S1 (2026-06-15): tiktok_url re-host path surfaced by the pipeline
      // (PipelineResult.video_storage_path). Null for video_upload (validated path wins
      // below) and text mode. Persisting it lets the retention scrubber replay on reload.
      pipelineVideoPath?: string | null,
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
      // Wave 3 per-persona detail — surfaced in UI Audience node. Empty array when
      // Wave 3 below threshold (D-13) or fallback path taken.
      personas:
        (finalResult.persona_simulation_results ?? []) as unknown as Json,
      feature_vector: finalResult.feature_vector as unknown as null,
      reasoning: finalResult.reasoning,
      warnings: finalResult.warnings,
      input_mode: finalResult.input_mode,
      mode: validated.mode,
      // Plan 05-01 (D-07): lineage FK — null for ordinary analyses; non-null for developed children.
      // Covers JSON-branch INSERT (~629) and SSE-branch UPSERT (~836) via buildInsertRow spread.
      parent_id: validated.parent_id ?? null,
      has_video: finalResult.has_video,
      gemini_score: finalResult.gemini_score,
      ml_score: finalResult.ml_score,
      // RULE-03: rule_contributions column pending migration — omitted until schema updated
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
      // Phase 11 (INT-05): Persist Supabase Storage path so /api/videos/sign can mint
      // a playable URL on permalink reload (the reading retention scrubber needs real
      // video on EVERY read — reading-ux 2026-06-15, Option A). Set for ALL video_upload
      // rows regardless of storage_retention_opted_in: the file is no longer deleted on
      // the success path (the two success-path cleanupUploadedStorage calls were removed);
      // the 30-day retention cron still expires non-opted-in videos, after which the
      // scrubber degrades to the keyframe filmstrip. For tiktok_url, the pipeline re-hosts
      // the real mp4 into an owner-prefixed path and surfaces it as pipelineVideoPath
      // (reading-ux S1 2026-06-15) — persisted here so the scrubber replays on reload too.
      // Text mode → both are null.
      video_storage_path:
        validated.input_mode === "video_upload" && validated.video_storage_path
          ? validated.video_storage_path
          : pipelineVideoPath ?? null,
      // Persist the assembled HeatmapPayload so /api/analysis/[id] can return
      // the real segments/personas/weighted_curve on permalink replay instead
      // of falling back to the server-side synth.
      heatmap: (finalResult.heatmap ?? null) as unknown as Json,
      // Phase 4 (MVP Cut) — Schema Drift Fix: persist the four engine-emitted fields
      // the DB previously dropped on the floor. Reverts the inline workaround in
      // /api/analyze/[id]/script/route.ts (commit 3bf3eb7).
      // counterfactuals + hook_decomposition: structural Json — cast required because
      // the engine types (CounterfactualResult, HookDecomposition) are typed narrowly
      // while the DB column is Json. Pattern matches the existing
      // `behavioral_predictions as unknown as null` casts above.
      counterfactuals: (finalResult.counterfactuals ?? null) as unknown as Json,
      hook_decomposition: (finalResult.hook_decomposition ?? null) as unknown as Json,
      // confidence_label + anti_virality_gated are REQUIRED on PredictionResult
      // (always populated by aggregator). No null coalesce needed.
      confidence_label: finalResult.confidence_label,
      anti_virality_gated: finalResult.anti_virality_gated,
      // Persist three more engine-emitted fields the DB previously dropped, so
      // they survive permalink reload (migration 20260531000000). Structural
      // Json — cast through unknown like the behavioral_predictions casts above.
      emotion_arc: (finalResult.emotion_arc ?? null) as unknown as Json,
      // Phase 2 (R1) — verbatim transcription (hook + per-segment) from Omni.
      // Full { hook, segments } object — NOT a { hook }-only subset (Pitfall 2 /
      // T-2-05: streaming runs use the UPDATE path below; a subset there drops segments).
      verbatim: (finalResult.verbatim ?? null) as unknown as Json,
      persona_behavioral_aggregate:
        (finalResult.persona_behavioral_aggregate ?? null) as unknown as Json,
      optimal_post_window:
        (finalResult.optimal_post_window ?? null) as unknown as Json,
    });

    // -------------------------------------------------------
    // R1′b — Load the active calibrated audience (same per-thread pin as the generative
    // skills: ideas/hooks/script read thread.active_audience_id → getAudience). The Read
    // fires from the same composer, so it picks up the SAME active audience → the fold
    // simulates the user's REAL audience (the moat: one audience substrate everywhere).
    // Resolves to GENERAL_AUDIENCE (is_general → no repaint → byte-identical fold) on any
    // miss/failure — never blocks the Read.
    // -------------------------------------------------------
    let activeAudience: Audience = GENERAL_AUDIENCE;
    try {
      const openThread = await createOpenThreadLazy(user.id);
      const rawThread = openThread as typeof openThread & { active_audience_id?: string | null };
      const activeAudienceId = rawThread.active_audience_id ?? null;
      if (activeAudienceId) {
        const loaded = await getAudience(supabase, activeAudienceId);
        if (loaded) activeAudience = loaded;
      }
    } catch {
      // Non-fatal: fall back to General (no regression — the fold runs generic archetypes).
    }

    // -------------------------------------------------------
    // JSON branch (CONTEXT D-03) — runs pipeline + aggregator inline.
    // No onStageEvent — JSON callers don't get stage events.
    // -------------------------------------------------------
    if (wantsJSON) {
      const pack = resolvePack("socials");
      let pipelineResult;
      try {
        pipelineResult = await pack.run(validated, {
          requestId,
          bypassCache,
          // reading-ux S1 (2026-06-15): owner id so a tiktok_url re-host lands at a
          // signable, owner-prefixed path and is kept on success for the scrubber.
          userId: user.id,
          // R1′b — the active calibrated audience repaints the fold's 10 archetypes.
          audience: activeAudience,
        });
      } catch (pipelineError) {
        // Phase 3 (260528-nsb): cleanup orphan on JSON-branch pipeline throw.
        cleanupUploadedStorage(service, validated, retentionOptedIn, log);
        const message =
          pipelineError instanceof Error ? pipelineError.message : "Pipeline failed";
        log.error("Pipeline error (json)", { error: message });
        return Response.json({ error: message }, { status: 500 });
      }
      const tAgg = performance.now();
      // Stage 11 removed (Plan 02, R9); aggregateScores no longer needs deferCounterfactuals.
      const result = await pack.scoring.run(pipelineResult, undefined);
      const aggregateMs = Math.round(performance.now() - tAgg);

      // Plan 03 strip: ruleResult removed from pipeline — rule_contributions empty.
      const ruleContributions: { rule_id: string; rule_name: string; score: number; max_score: number; tier: string }[] = [];

      // board-fix #2: persist TRUE E2E latency = pipeline + aggregate (see SSE branch).
      const finalResult: PredictionResult = {
        ...result,
        warnings: [...pipelineResult.warnings, ...result.warnings],
        latency_ms: (result.latency_ms ?? 0) + aggregateMs,
      };

      const jsonInsertId = nanoid(12);
      const { error: insertError } = await service
        .from("analysis_results")
        .insert({ ...buildInsertRow(finalResult, ruleContributions, pipelineResult.video_storage_path), id: jsonInsertId });

      if (insertError) {
        log.error("DB insert failed (json)", { error: insertError.message });
      } else {
        populatePredictionCache(contentHash, user.id, finalResult, {
          bypass: bypassCache,
        });
        // Persist Content-craft signals into variants.craft (no migration). The
        // row id was generated inline for the JSON insert above.
        await persistCraftToVariants(service, jsonInsertId, user.id, finalResult, log);
        // Plan 03-04 (D-04): Persist Apollo §4 output into variants.apollo (read-merge-write).
        // Non-fatal: failure only blanks Apollo frame, never the row itself (T-03-09, T-03-10).
        await persistApolloToVariants(service, jsonInsertId, user.id, finalResult, log);
        // stage11 deferred backfill removed (Plan 02, R9); counterfactuals stays null.

        // BILL THE READING — inside the success branch, on purpose. This is the moment the
        // Reading exists; a pipeline that had failed never reaches here, so it never charges.
        await recordReading(
          service,
          { userId: user.id, analysisId: jsonInsertId, mode: validated.mode, tier: quota.tier },
          log
        );
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

      // reading-ux 2026-06-15 (Option A): uploaded videos are now KEPT on the success
      // path so the retention scrubber has a playable source on permalink reload. The
      // 30-day retention cron still expires non-opted-in videos. (Orphan cleanup still
      // runs on the cache-hit / 429 / pipeline-error branches, where no row references
      // the upload.) The former success-path cleanupUploadedStorage call was removed here.

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
    // Pitfall #6 (Plan 01-02 Option A) — insert placeholder analysis_results row
    // BEFORE streaming begins. GET /api/analyze/[id]/stream (Plan 01-03) reads this
    // row; the aggregator's final write is now an UPSERT by id so the row is
    // populated in place (no orphan, no duplicate).
    // Column-coverage note: per src/types/database.types.ts only user_id,
    // content_text, content_type are NOT NULL in the Insert type. Everything else
    // is nullable / has a DB default — sentinel placeholder values below mark the
    // row as in-flight until the aggregator UPSERT overwrites them.
    // -------------------------------------------------------
    const analysisId = nanoid(12);
    const { error: placeholderError } = await service
      .from("analysis_results")
      .insert({
        id: analysisId,
        user_id: user.id,
        content_text: validated.content_text ?? "",
        content_type: validated.content_type,
        society_id: validated.society_id ?? null,
        overall_score: null,                                 // sentinel: marks row in-flight
        confidence: null,
        engine_version: "pending",                           // sentinel: upsert overwrites
        input_mode: validated.input_mode,
        mode: validated.mode,
        // Plan 05-01 (D-07): lineage FK set at placeholder INSERT so the safety-net UPDATE
        // (which does not list parent_id) preserves it unedited (T-05-11 / SC#2).
        parent_id: validated.parent_id ?? null,
        has_video: validated.input_mode === "video_upload",
        content_hash: contentHash,
        gemini_model: null,
        latency_ms: null,
        cost_cents: null,
        score_weights: null,
      });

    if (placeholderError) {
      log.error("placeholder insert failed", { error: placeholderError.message });
      // Don't fail the analysis — proceed without GET-stream support for this call.
    }

    // -------------------------------------------------------
    // Phase 03 Plan 02 — Remix decode branch (early-return stream)
    //
    // Branch BEFORE runPredictionPipeline and BEFORE usage_tracking upsert (pitfall C2).
    // The existing placeholder INSERT above already has overall_score:null + mode:'remix'
    // (mode: validated.mode) and does NOT set video_storage_path — reused as-is.
    // Completion marker: variants.remix != null (NOT overall_score — pitfall m3).
    // -------------------------------------------------------
    if (validated.mode === "remix") {
      const decodeEncoder = new TextEncoder();
      const decodeStream = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: unknown) => {
            // Guard: client cancel (navigation) — enqueue after close throws.
            try {
              controller.enqueue(
                decodeEncoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                )
              );
            } catch {
              /* stream already cancelled/closed — drop the frame */
            }
          };
          try {
            await runDecodeStream(controller, send, {
              service,
              validated,
              analysisId,
              userId: user.id,
              log,
            });

            // A decode is engine spend and has always billed like any other Reading (it writes
            // an analysis_results row, which is what the old meter counted) — so it keeps
            // billing, and the ledger does not quietly change what a customer is charged for.
            // Only on success: a throw below means nothing was delivered.
            await recordReading(
              service,
              { userId: user.id, analysisId, mode: "remix", tier: quota.tier },
              log
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Decode failed";
            log.error("decode_stream_error", { error: message, analysisId });
            Sentry.captureException(err, { tags: { stage: "decode_stream", analysisId } });
            send("error", { error: message });
            // Guard: runDecodeStream's finally may have already closed it, or the
            // client cancelled — either way a double-close throws.
            try {
              controller.close();
            } catch {
              /* already closed/cancelled */
            }
          }
        },
      });
      return new Response(decodeStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          Vary: "Accept",
        },
      });
    }

    // -------------------------------------------------------
    // SSE stream setup (default branch — preserves existing client contract)
    // -------------------------------------------------------
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          // Guard: client may have cancelled (navigated away mid-stream) — an
          // enqueue after cancel throws "Controller is already closed".
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            /* stream already cancelled/closed — drop the frame */
          }
        };

        try {
          // Pitfall #6 (Plan 01-02) — emit started FIRST so consumer captures
          // analysisId before any stage / phase / complete frame.
          send("started", { id: analysisId });

          // Phase 1: Run full pipeline (handles Wave 1 + Wave 2 internally).
          // Phase 3 — forward fine-grained stage events to SSE client as `event: stage`.
          send("phase", {
            phase: "analyzing",
            message:
              "Analyzing content with Gemini and loading creator context...",
          });
          const pack = resolvePack("socials");
          const pipelineResult = await pack.run(validated, {
            requestId,
            bypassCache,
            // Thread the row id so the pipeline can fire-and-forget filmstrip
            // keyframe extraction at wave_0_complete (pipeline.ts gates the
            // trigger on opts.analysisId — without this it was ALWAYS undefined,
            // so keyframes were never extracted for ANY analysis).
            analysisId,
            // reading-ux S1 (2026-06-15): owner id so a tiktok_url re-host lands at a
            // signable, owner-prefixed path and is kept on success for the scrubber.
            userId: user.id,
            // R1′b — the active calibrated audience repaints the fold's 10 archetypes.
            audience: activeAudience,
            onStageEvent: (event: StageEvent) => {
              send("stage", event);
            },
          });

          // Phase 2: Aggregate scores — pass onStageEvent so Stage 10/11 stubs forward.
          send("phase", {
            phase: "scoring",
            message: "Calculating predictions and assembling results...",
          });
          // board-fix #1: time aggregateScores — the dominant post-pipeline tail
          // (Stage 10 + ML + post-window). Per-stage breakdown is logged inside
          // the aggregator under module "aggregator". Stage 11 removed (Plan 02, R9).
          const tAgg = performance.now();
          const result = await pack.scoring.run(
            pipelineResult,
            /* onStageEvent: */ (event: StageEvent) => { send("stage", event); },
          );
          const aggregateMs = Math.round(performance.now() - tAgg);
          log.info("stage_timing", {
            stage: "aggregate_scores_total",
            ms: aggregateMs,
          });

          // Plan 03 strip: ruleResult removed from pipeline — rule_contributions empty.
          const ruleContributions: { rule_id: string; rule_name: string; score: number; max_score: number; tier: string }[] = [];

          // Prepend pipeline warnings (partial failures) before DeepSeek warnings.
          // board-fix #2: persist TRUE E2E latency = pipeline + aggregate. result.latency_ms
          // is pipeline-only (set in the aggregator BEFORE Stage 10/11 run), so it undercut
          // the user-visible wall by the ~Stage-11 tail (~46s). The latency budget tracks
          // this number — it must include the aggregate.
          const finalResult: PredictionResult = {
            ...result,
            warnings: [...pipelineResult.warnings, ...result.warnings],
            latency_ms: (result.latency_ms ?? 0) + aggregateMs,
          };

          // board-fix #1: time the 3 serial DB writes (upsert + usage + safety-net
          // UPDATE) as one block — they run before send("complete"), so they extend
          // the user-visible tail. Logged at the close just before send("complete").
          const tDb = performance.now();
          // Persist to DB — UPSERT by id replaces the placeholder row from Pitfall #6
          // Option A. The placeholder INSERT above guarantees the row exists; the
          // UPSERT here populates it with final values (engine_version, latency_ms,
          // overall_score, etc.) without creating a duplicate.
          const { error: insertError } = await service
            .from("analysis_results")
            .upsert(
              { ...buildInsertRow(finalResult, ruleContributions, pipelineResult.video_storage_path), id: analysisId },
              { onConflict: "id" }
            );

          if (insertError) {
            log.error("DB insert failed", { error: insertError.message });
          } else {
            // Phase 3 — hydrate L1 cache after successful INSERT (CONTEXT D-15 symmetric bypass).
            populatePredictionCache(contentHash, user.id, finalResult, {
              bypass: bypassCache,
            });
            // Persist Content-craft signals into variants.craft (no migration).
            // analysisId is the upserted row id (Pitfall #6 placeholder → upsert).
            await persistCraftToVariants(service, analysisId, user.id, finalResult, log);
            // Plan 03-04 (D-04): Persist Apollo §4 output into variants.apollo (read-merge-write).
            // Non-fatal: failure only blanks Apollo frame, never the row itself (T-03-09, T-03-10).
            await persistApolloToVariants(service, analysisId, user.id, finalResult, log);
            // stage11 deferred backfill removed (Plan 02, R9); counterfactuals stays null.

            // BILL THE READING — here, and not at the placeholder INSERT above. The placeholder
            // is written BEFORE the engine runs (Pitfall #6) purely so the reconnect stream has
            // a row to read; a run that dies mid-pipeline leaves it behind. Billing on the
            // placeholder is what made a failed engine run cost the customer a Reading.
            await recordReading(
              service,
              { userId: user.id, analysisId, mode: validated.mode, tier: quota.tier },
              log
            );
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

          // Fix 1 (05-ux): Explicit UPDATE before emitting event:complete.
          // The UPSERT above writes the full row, but if it silently conflicts or
          // falls back to INSERT (unlikely with onConflict:id), overall_score stays
          // null. This targeted UPDATE guarantees the score columns are written even
          // if the UPSERT path had a conflict-resolution anomaly.
          {
            const fr = finalResult as unknown as Record<string, unknown>;
            const { error: updateErr } = await service
              .from("analysis_results")
              .update({
                // Defense-in-depth (CR-02): mode is already persisted at both
                // INSERT sites (placeholder + buildInsertRow), but keep it on the
                // safety-net UPDATE so a remix row can never regress to the
                // DEFAULT 'score' on any conflict-resolution anomaly (guards D-15).
                mode: validated.mode,
                overall_score: finalResult.overall_score,
                confidence: finalResult.confidence,
                factors: (finalResult.factors ?? []) as unknown as null,
                suggestions: (finalResult.suggestions ?? []) as unknown as null,
                reasoning: finalResult.reasoning ?? null,
                warnings: (finalResult.warnings ?? []) as unknown as string[],
                retrieval_evidence: (fr.retrieval_evidence ?? null) as unknown as null,
                retrieval_score: (fr.retrieval_score ?? null) as number | null,
                behavioral_predictions: finalResult.behavioral_predictions as unknown as null,
                feature_vector: finalResult.feature_vector as unknown as null,
                gemini_score: finalResult.gemini_score ?? null,
                rule_score: finalResult.rule_score ?? null,
                trend_score: finalResult.trend_score ?? null,
                ml_score: finalResult.ml_score ?? null,
                score_weights: finalResult.score_weights as unknown as null,
                signal_availability: finalResult.signal_availability as unknown as null,
                // Parity with buildInsertRow — keep the newly-persisted engine columns
                // in sync on the safety-net UPDATE path too (T-2-05: streaming runs use
                // this path; missing verbatim here = per-segment text lost for board default flow).
                emotion_arc: (finalResult.emotion_arc ?? null) as unknown as null,
                // Phase 2 (R1) — full { hook, segments } object on both sites.
                verbatim: (finalResult.verbatim ?? null) as unknown as null,
                persona_behavioral_aggregate:
                  (finalResult.persona_behavioral_aggregate ?? null) as unknown as null,
                optimal_post_window:
                  (finalResult.optimal_post_window ?? null) as unknown as null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", analysisId)
              .eq("user_id", user.id);
            if (updateErr) {
              log.error("Failed to persist analysis result", {
                analysisId,
                error: updateErr,
              });
            }
          }

          log.info("stage_timing", {
            stage: "db_writes_total",
            ms: Math.round(performance.now() - tDb),
          });

          send("complete", finalResult);

          // reading-ux 2026-06-15 (Option A): KEEP the uploaded video on success so the
          // retention scrubber resolves a playable URL on permalink reload (mirrors the
          // JSON branch). Orphan cleanup still runs on the pipeline-error branch below
          // and on the cache-hit / 429 early returns. Former success-path cleanup removed.

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
          log.error("Pipeline error", { error: message });
          // Phase 3 (260528-nsb): cleanup orphan on SSE pipeline throw.
          cleanupUploadedStorage(service, validated, retentionOptedIn, log);
          send("error", { error: message });
        } finally {
          // Guard: client cancel (navigation) may have already closed the stream.
          try {
            controller.close();
          } catch {
            /* already closed/cancelled */
          }
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
