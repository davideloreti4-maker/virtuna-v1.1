import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { CLIPS_BUCKET } from "@/lib/remix/clip-storage";

const log = createLogger({ module: "cron/delete-retained-videos" });

/**
 * The remix-clip retention window (phase 4, owner ruling D2 2026-08-15). This TTL IS the
 * "clips die with the thread" mitigation, resolved to a mechanism that exists — exported so a
 * test can assert it, because a TTL living only as a literal in a query is a mitigation nobody
 * can find.
 */
export const CLIP_TTL_DAYS = 7;

interface VideoSweep { deleted: number; nulled: number; error?: string }
interface ClipSweep { deleted: number; emptied: number; error?: string }

/**
 * GET /api/cron/delete-retained-videos — daily 03:00 UTC (vercel.json), CRON_SECRET auth.
 *
 * TWO independent sweeps, each in its own try/catch — a failure (or an empty night) in one must
 * never skip the other. The original single-body version early-returned when the video sweep
 * found nothing, which is the NORMAL night; anything appended after it would have been dead code.
 *
 *   1. videos: uploaded videos >30d for non-opted-in users (unchanged behaviour, Phase 11/INT-05)
 *   2. clips:  remix_blueprints rows past CLIP_TTL_DAYS — remove clip_uris paths from the
 *              `clips` bucket, then empty the column (the idempotency marker: a failed empty
 *              leaves the row re-sweepable tomorrow).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError as NextResponse;

  const supabase = createServiceClient();
  const videos = await sweepRetainedVideos(supabase);
  const clips = await sweepExpiredClips(supabase);

  const failed = Boolean(videos.error || clips.error);
  return NextResponse.json(
    { status: failed ? "partial" : "completed", videos, clips },
    { status: failed ? 500 : 200 },
  );
}

/** The pre-phase-4 body, verbatim in behaviour: query, batch delete, null-out, same logging. */
async function sweepRetainedVideos(supabase: SupabaseClient): Promise<VideoSweep> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredRows, error: queryError } = await supabase
      .from("analysis_results")
      .select(
        "id, video_storage_path, user_id, creator_profiles!inner(storage_retention_opted_in)"
      )
      .lt("created_at", thirtyDaysAgo)
      .not("video_storage_path", "is", null)
      .eq("creator_profiles.storage_retention_opted_in", false);

    if (queryError) {
      log.error("Retention query failed", { error: queryError.message });
      return { deleted: 0, nulled: 0, error: queryError.message };
    }

    const ids = (expiredRows ?? []).map((r) => r.id as string).filter(Boolean);
    const paths = (expiredRows ?? [])
      .map((r) => r.video_storage_path as string)
      .filter(Boolean);

    if (paths.length === 0) {
      log.info("No expired videos to delete", { thirtyDaysAgo });
      return { deleted: 0, nulled: 0 };
    }

    const { error: deleteError } = await supabase.storage.from("videos").remove(paths);
    if (deleteError) {
      log.error("Storage batch delete failed", { error: deleteError.message });
      return { deleted: 0, nulled: 0, error: deleteError.message };
    }

    // Null out video_storage_path after successful delete (Mode B fix): prevents dangling
    // references. A failed UPDATE logs at ERROR and is NOT a sweep error — the storage delete
    // succeeded and the next run re-nulls (idempotent).
    const { error: nullError } = await supabase
      .from("analysis_results")
      .update({ video_storage_path: null })
      .in("id", ids);

    if (nullError) {
      log.error("retention_null_failed", { error: nullError.message, ids_count: ids.length });
    }

    log.info("Video retention sweep completed", {
      deleted: paths.length,
      nulled: nullError ? 0 : ids.length,
    });
    return { deleted: paths.length, nulled: nullError ? 0 : ids.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Video retention sweep threw", { error: msg });
    return { deleted: 0, nulled: 0, error: msg };
  }
}

/** Phase 4: remove expired remix clips and empty their rows' worklist column. */
async function sweepExpiredClips(supabase: SupabaseClient): Promise<ClipSweep> {
  try {
    const cutoff = new Date(Date.now() - CLIP_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error: queryError } = await supabase
      .from("remix_blueprints")
      .select("id, clip_uris")
      .lt("created_at", cutoff);

    if (queryError) {
      log.error("clip retention query failed", { error: queryError.message });
      return { deleted: 0, emptied: 0, error: queryError.message };
    }

    // Filtered in JS, not PostgREST: jsonb emptiness predicates over the wire are fragile, and
    // the table holds single-digit rows. Thousands of rows would want a partial index or a
    // generated has_clips boolean (spec §5's scale caveat) — not now.
    const rows = (data ?? []).filter(
      (r): r is { id: string; clip_uris: string[] } =>
        Array.isArray(r.clip_uris) && r.clip_uris.length > 0,
    );
    if (rows.length === 0) {
      log.info("No expired clips to delete", { cutoff });
      return { deleted: 0, emptied: 0 };
    }

    const paths = rows.flatMap((r) => r.clip_uris);
    const { error: deleteError } = await supabase.storage.from(CLIPS_BUCKET).remove(paths);
    if (deleteError) {
      // clip_uris deliberately NOT emptied — the rows stay on tomorrow's worklist.
      log.error("clip storage delete failed", { error: deleteError.message });
      return { deleted: 0, emptied: 0, error: deleteError.message };
    }

    const { error: emptyError } = await supabase
      .from("remix_blueprints")
      .update({ clip_uris: [] })
      .in("id", rows.map((r) => r.id));

    if (emptyError) {
      // Storage delete succeeded; a failed empty is re-swept tomorrow (remove([]) of already
      // deleted objects is not an error). ERROR log, not a sweep error.
      log.error("clip_uris empty failed — rows re-swept next run", {
        error: emptyError.message,
        ids_count: rows.length,
      });
    }

    log.info("Clip retention sweep completed", {
      deleted: paths.length,
      emptied: emptyError ? 0 : rows.length,
    });
    return { deleted: paths.length, emptied: emptyError ? 0 : rows.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Clip retention sweep threw", { error: msg });
    return { deleted: 0, emptied: 0, error: msg };
  }
}
