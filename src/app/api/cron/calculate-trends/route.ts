import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

// Vercel route segment config (06-REVIEW.md WR-03):
// The inline D-F4 embedding pipeline runs ~5s per sound (download + upload + describe +
// embed + update). At a 50-sound ceiling per tick that is a ~4-minute worst case — well
// over Vercel's default 10s hobby / 60s pro ceiling. Lifting maxDuration to 300s gives
// the cron headroom; per-row failure isolation in this route prevents one slow sound
// from blocking the whole batch even within the budget.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const log = createLogger({ module: "cron/calculate-trends" });

// =====================================================
// Phase 6 (D-F4) — inline embedding pipeline constants
// =====================================================
//
// Mirrors scripts/backfill-trending-sound-embeddings.ts (Plan 06-04). The cron path
// processes newly-upserted rows where `audio_embedding IS NULL`; the backfill script
// processes existing rows under the same predicate. Both paths share the FULL D-F4
// pipeline semantics (download → upload → describe → embed → update + cleanup).
//
// Cost ceiling per CONTEXT D-F4: ~$0.0005/sound × ~50 sounds/day ≈ $0.025/day.
// All steps are NON-FATAL (Pitfall 4): any per-row failure logs + continues; the
// route response shape is unchanged.

// DEFERRED to M2: entire audio embedding pipeline (download → describe → embed) disabled.
// getGeminiClient returns null; processSoundEmbedding is a no-op.
function getGeminiClient(): null { return null; }

/**
 * FULL D-F4 pipeline for one row (Inline embedding — FAILURE-TOLERANT per Pitfall 4).
 *
 * Idempotency: checks `trending_sounds.audio_embedding` for the row first. If non-null,
 * skips the entire pipeline (the row was already embedded by a prior cron tick or by
 * scripts/backfill-trending-sound-embeddings.ts).
 *
 * Each step is non-fatal. Any failure logs + returns; next cron tick retries.
 */
async function processSoundEmbedding(
  _gemini: null,
  supabase: SupabaseClient,
  row: { sound_name: string; sound_url: string | null },
  alreadyEmbedded?: Set<string>,
): Promise<void> {
  // DEFERRED to M2: audio embedding pipeline disabled. Supabase + row params kept for signature compat.
  void supabase; void row; void alreadyEmbedded;
}

/**
 * GET /api/cron/calculate-trends
 *
 * Aggregates scraped_videos into trending_sounds with velocity scores.
 * Runs hourly via Vercel Cron.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const twentyFourHoursAgo = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    ).toISOString();
    const fortyEightHoursAgo = new Date(
      now.getTime() - 48 * 60 * 60 * 1000
    ).toISOString();

    // Fetch non-archived videos with sound names from the last 48h
    const { data: videos, error: fetchError } = await supabase
      .from("scraped_videos")
      .select(
        "sound_name, sound_url, views, likes, shares, created_at"
      )
      .is("archived_at", null)
      .not("sound_name", "is", null)
      .gte("created_at", fortyEightHoursAgo)
      .order("created_at", { ascending: false });

    if (fetchError) {
      log.error("Fetch error", { error: fetchError.message });
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ processed: 0, message: "No recent videos" });
    }

    // Aggregate by sound_name
    const soundMap = new Map<
      string,
      {
        sound_url: string | null;
        video_count: number;
        total_views: number;
        recent_views: number; // last 24h
        older_views: number; // 24-48h
        first_seen: string;
        last_seen: string;
      }
    >();

    for (const video of videos) {
      const name = video.sound_name!;
      const existing = soundMap.get(name);
      const views = video.views ?? 0;
      const isRecent = video.created_at! >= twentyFourHoursAgo;

      if (existing) {
        existing.video_count++;
        existing.total_views += views;
        if (isRecent) existing.recent_views += views;
        else existing.older_views += views;
        if (video.created_at! < existing.first_seen)
          existing.first_seen = video.created_at!;
        if (video.created_at! > existing.last_seen)
          existing.last_seen = video.created_at!;
        if (!existing.sound_url && video.sound_url)
          existing.sound_url = video.sound_url;
      } else {
        soundMap.set(name, {
          sound_url: video.sound_url,
          video_count: 1,
          total_views: views,
          recent_views: isRecent ? views : 0,
          older_views: isRecent ? 0 : views,
          first_seen: video.created_at!,
          last_seen: video.created_at!,
        });
      }
    }

    // Calculate velocity scores and trend phases, then upsert
    const trendRecords = Array.from(soundMap.entries()).map(
      ([sound_name, data]) => {
        // Growth rate: (recent - older) / max(older, 1) — avoids division by zero
        const growth_rate =
          data.older_views > 0
            ? (data.recent_views - data.older_views) / data.older_views
            : data.recent_views > 0
              ? 1.0
              : 0;

        // Velocity score: combines video count, views, and growth
        const velocity_score =
          Math.log10(Math.max(data.total_views, 1)) *
          data.video_count *
          (1 + Math.max(growth_rate, 0));

        // Determine trend phase based on growth rate, velocity, and absolute volume
        const trend_phase = classifyTrendPhase(growth_rate, velocity_score, data.total_views);

        return {
          sound_name,
          sound_url: data.sound_url,
          video_count: data.video_count,
          total_views: data.total_views,
          growth_rate: Math.round(growth_rate * 1000) / 1000,
          velocity_score: Math.round(velocity_score * 100) / 100,
          trend_phase,
          first_seen: data.first_seen,
          last_seen: data.last_seen,
          metadata: { calculated_at: now.toISOString() },
        };
      }
    );

    // Upsert in batches
    const BATCH_SIZE = 50;
    let upsertedCount = 0;

    // Phase 6 (D-F4) — Gemini client resolved ONCE outside the loop. null when
    // GEMINI_API_KEY is missing → embedding extension is skipped entirely (Test 5
    // contract: response shape preserved). Failure-tolerant: the embedding extension
    // is FIRE-AND-FORGET per Pitfall 4 — any per-row failure logs + continues; the
    // route response shape is unchanged. Idempotent: rows where audio_embedding is
    // already populated skip the pipeline (processSoundEmbedding's IS NULL check).
    const gemini = getGeminiClient();

    for (let i = 0; i < trendRecords.length; i += BATCH_SIZE) {
      const batch = trendRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("trending_sounds")
        .upsert(batch, { onConflict: "sound_name" });

      if (error) {
        log.error("Upsert error", { offset: i, error: error.message });
        // Skip embedding for this batch — the rows weren't upserted.
        continue;
      }

      upsertedCount += batch.length;

      // Phase 6 (D-F4) — inline embedding pipeline per row. Skipped entirely if no
      // Gemini client (missing GEMINI_API_KEY). All step-level failures are logged
      // + swallowed inside processSoundEmbedding; the outer try/catch here is
      // defense-in-depth (an unexpected throw inside processSoundEmbedding must
      // never propagate to the route response — Pitfall 4 fire-and-forget contract).
      if (gemini) {
        // 06-REVIEW.md WR-04: bulk-prefetch already-embedded sound_names for this
        // batch so processSoundEmbedding can skip them without an N+1 SELECT per
        // row. One query per BATCH_SIZE (50) rows instead of BATCH_SIZE separate
        // maybeSingle()s. Failure is non-fatal — fall through to per-row check.
        let alreadyEmbedded: Set<string> | undefined;
        try {
          const batchNames = batch.map((r) => r.sound_name);
          const { data: embedded } = await supabase
            .from("trending_sounds")
            .select("sound_name")
            .in("sound_name", batchNames)
            .not("audio_embedding", "is", null);
          if (embedded) {
            alreadyEmbedded = new Set(embedded.map((r) => r.sound_name));
          }
        } catch (err) {
          log.warn("Bulk idempotency prefetch failed — falling back to per-row check", {
            offset: i,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        for (const row of batch) {
          try {
            await processSoundEmbedding(gemini, supabase, row, alreadyEmbedded);
          } catch (err) {
            log.warn("Inline embedding fatal (unexpected) — continuing", {
              sound_name: row.sound_name,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    log.info("Processed videos into sounds", {
      videoCount: videos.length,
      soundCount: trendRecords.length,
      upsertedCount,
    });

    return NextResponse.json({
      processed: videos.length,
      sounds: trendRecords.length,
      upserted: upsertedCount,
    });
  } catch (error) {
    log.error("Failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function classifyTrendPhase(
  growthRate: number,
  velocityScore: number,
  totalViews: number
): string {
  // High absolute volume with modest growth = peak (not declining) — SIG-02
  if (totalViews >= 500_000 && growthRate >= -0.2) return "peak";
  if (growthRate > 0.5 && velocityScore < 50) return "emerging";
  if (growthRate > 0.3 && velocityScore >= 50) return "rising";
  if (growthRate >= -0.1 && growthRate <= 0.3 && velocityScore >= 100)
    return "peak";
  return "declining";
}
