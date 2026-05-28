import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/delete-retained-videos" });

/**
 * GET /api/cron/delete-retained-videos
 *
 * Phase 11 (INT-05): Auto-delete uploaded videos older than 30 days for users
 * who have NOT opted into video retention.
 *
 * Query: analysis_results rows where:
 *   - created_at < NOW() - 30 days
 *   - video_storage_path IS NOT NULL
 * Then cross-check creator_profiles.storage_retention_opted_in = false before deleting.
 * Videos are removed from the Supabase Storage "videos" bucket.
 *
 * Schedule: daily at 03:00 UTC (vercel.json)
 * Auth: verifyCronAuth (CRON_SECRET header)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError as NextResponse;

  const supabase = createServiceClient();

  try {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch expired video rows, joining creator_profiles to check opt-in status.
    // creator_profiles!inner ensures only rows with a matching profile are returned.
    // Users without a profile row are treated as non-opted-in (default off per D-04).
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
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const ids = (expiredRows ?? [])
      .map((r) => r.id as string)
      .filter(Boolean);
    const paths = (expiredRows ?? [])
      .map((r) => r.video_storage_path as string)
      .filter(Boolean);

    if (paths.length === 0) {
      log.info("No expired videos to delete", { thirtyDaysAgo });
      return NextResponse.json({ status: "completed", deleted: 0, nulled: 0 });
    }

    // Batch delete from Supabase Storage "videos" bucket.
    const { error: deleteError } = await supabase.storage
      .from("videos")
      .remove(paths);

    if (deleteError) {
      log.error("Storage batch delete failed", { error: deleteError.message });
      return NextResponse.json(
        { error: "Storage delete failed" },
        { status: 500 }
      );
    }

    // Phase 3 (260528-nsb) Mode B fix: null out video_storage_path after successful delete.
    // Prevents dangling DB references that cause /api/videos/sign to return 404 indefinitely.
    // If this UPDATE fails, log at ERROR but still return 200 — storage delete succeeded.
    // Next cron run will re-null (idempotent: rows still have non-null video_storage_path).
    const { error: nullError } = await supabase
      .from("analysis_results")
      .update({ video_storage_path: null })
      .in("id", ids);

    if (nullError) {
      log.error("retention_null_failed", {
        error: nullError.message,
        ids_count: ids.length,
      });
      // Don't return 500 — storage delete succeeded. Next cron run will re-null.
    }

    log.info("Retention cron completed", {
      deleted: paths.length,
      nulled: nullError ? 0 : ids.length,
    });
    return NextResponse.json({
      status: "completed",
      deleted: paths.length,
      nulled: nullError ? 0 : ids.length,
    });
  } catch (error) {
    log.error("Retention cron failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Retention cron failed" },
      { status: 500 }
    );
  }
}
