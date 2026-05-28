import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

/**
 * GET /api/cron/sweep-orphan-videos
 *
 * Phase 3 (260528-nsb): Weekly safety-net sweeper that detects and removes orphaned
 * storage objects in the videos/ bucket — storage objects with no matching
 * analysis_results.video_storage_path row. This prevents unbounded storage growth
 * from Mode A failures (cache-hit, pipeline-throw, rate-limit abort, etc.).
 *
 * Algorithm:
 *   1. Query storage.objects WHERE bucket_id = 'videos' AND created_at < cutoff (24h cushion).
 *   2. Anti-join against analysis_results.video_storage_path.
 *   3. Delete orphans from storage.
 *
 * Schedule: weekly at 0 4 * * 0 (Sunday 04:00 UTC) — offset from daily retention cron (03:00).
 * Auth: verifyCronAuth (CRON_SECRET header), same as existing crons.
 * Idempotent: re-running cleans residual orphans; no-op when none exist.
 *
 * Returns: { status, listed, orphaned, deleted }
 */

const log = createLogger({ module: "cron/sweep-orphan-videos" });
const MAX_OBJECTS_PER_RUN = 10_000;
const MIN_AGE_HOURS = 24;

export async function GET(request: Request): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError as NextResponse;

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000);

  try {
    // 1. Query storage.objects directly via .schema("storage") for all video objects
    //    older than the 24h cushion. This avoids pagination complexity with nested folders
    //    (video paths are {user_id}/{nanoid}.mp4 — folder-per-user layout).
    //    TypeScript types don't expose the storage schema in the generated client types,
    //    so we use an 'as any' cast to reach the runtime-available .schema("storage") API.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storageRows, error: sqlError } = await (supabase as any)
      .schema("storage")
      .from("objects")
      .select("name, created_at")
      .eq("bucket_id", "videos")
      .lt("created_at", cutoff.toISOString())
      .limit(MAX_OBJECTS_PER_RUN);

    if (sqlError) {
      log.error("sweep_sql_failed", { error: (sqlError as { message: string }).message });
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const candidatePaths = ((storageRows ?? []) as { name: string; created_at: string }[]).map((r) => r.name);
    const listed = candidatePaths.length;

    if (listed === MAX_OBJECTS_PER_RUN) {
      log.warn("sweep_hard_limit_hit", {
        limit: MAX_OBJECTS_PER_RUN,
        message: "Run again to clean remaining objects",
      });
    }

    if (listed === 0) {
      log.info("sweep_completed_empty", { listed: 0 });
      return NextResponse.json({
        status: "completed",
        listed: 0,
        orphaned: 0,
        deleted: 0,
      });
    }

    // 2. Anti-join: find which candidates have NO matching analysis_results row.
    const { data: matchedRows, error: matchError } = await supabase
      .from("analysis_results")
      .select("video_storage_path")
      .in("video_storage_path", candidatePaths);

    if (matchError) {
      log.error("sweep_match_failed", { error: matchError.message });
      return NextResponse.json({ error: "Match query failed" }, { status: 500 });
    }

    const matched = new Set(
      (matchedRows ?? [])
        .map((r) => r.video_storage_path as string | null)
        .filter((p): p is string => p !== null)
    );

    const orphans = candidatePaths.filter((p) => !matched.has(p));

    log.info("sweep_orphans_found", {
      listed,
      orphaned: orphans.length,
    });

    if (orphans.length === 0) {
      return NextResponse.json({
        status: "completed",
        listed,
        orphaned: 0,
        deleted: 0,
      });
    }

    // 3. Delete orphans from storage.
    const { error: deleteError } = await supabase.storage
      .from("videos")
      .remove(orphans);

    if (deleteError) {
      log.error("sweep_delete_failed", {
        error: deleteError.message,
        orphans_count: orphans.length,
      });
      return NextResponse.json(
        { error: "Storage delete failed" },
        { status: 500 }
      );
    }

    log.info("sweep_completed", {
      listed,
      orphaned: orphans.length,
      deleted: orphans.length,
    });
    return NextResponse.json({
      status: "completed",
      listed,
      orphaned: orphans.length,
      deleted: orphans.length,
    });
  } catch (error) {
    log.error("sweep_cron_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Sweep cron failed" },
      { status: 500 }
    );
  }
}
