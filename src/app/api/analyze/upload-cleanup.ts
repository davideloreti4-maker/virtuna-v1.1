/**
 * Which uploaded video POST /api/analyze may work on, and which it may delete.
 *
 * The route reaches the `videos` bucket with the service client, which bypasses the bucket's
 * policies: the pipeline signs the path the request names, and the orphan cleanup deletes it.
 * Two rules keep that safe.
 *
 * 1. The path must be the caller's own (`ownsVideoPath`, shared with /api/videos/sign).
 * 2. A file is an orphan only while no stored run plays from it. A run of an already stored
 *    video (the result page's "Simulate again") that is refused, answered from the cache or
 *    fails must leave the file where it is.
 *
 * When the cleanup cannot tell, or does not hear back in time, it keeps the file. The weekly
 * sweep (/api/cron/sweep-orphan-videos) removes what is left behind.
 */

import { ownsVideoPath } from "@/lib/storage/own-video-path";
import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

interface CleanupLog {
  warn(event: string, data?: Record<string, unknown>): void;
}

export type OrphanCleanupOutcome =
  | "removed"
  | "kept-not-owned"
  | "kept-referenced"
  | "kept-check-failed"
  | "remove-failed"
  | "timed-out";

/** The request that runs the cleanup waits for it; a storage call that hangs must not hold it. */
const CLEANUP_TIMEOUT_MS = 3000;

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Delete an uploaded video that no run ended up using. Never throws, and answers within
 * `timeoutMs`: a cleanup that fails or hangs must not change the answer of the request it runs
 * in, nor hold it.
 */
export async function removeOrphanUpload(
  service: ServiceClient,
  args: { path: string; userId: string; log: CleanupLog },
  { timeoutMs = CLEANUP_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<OrphanCleanupOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<OrphanCleanupOutcome>((resolve) => {
    timer = setTimeout(() => {
      args.log.warn("storage_cleanup_timed_out", { path: args.path, timeoutMs });
      resolve("timed-out");
    }, timeoutMs);
  });
  try {
    return await Promise.race([removeIfOrphan(service, args), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function removeIfOrphan(
  service: ServiceClient,
  { path, userId, log }: { path: string; userId: string; log: CleanupLog }
): Promise<OrphanCleanupOutcome> {
  if (!ownsVideoPath(path, userId)) {
    log.warn("storage_cleanup_refused_not_owned", { userId });
    return "kept-not-owned";
  }

  // A lookup or a delete that answers with an error is handled like one that throws.
  try {
    const { data, error } = await service
      .from("analysis_results")
      .select("id")
      .eq("user_id", userId)
      .eq("video_storage_path", path)
      .limit(1);
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return "kept-referenced";
  } catch (err) {
    log.warn("storage_cleanup_check_failed", { err: messageOf(err), path });
    return "kept-check-failed";
  }

  try {
    const { error } = await service.storage.from("videos").remove([path]);
    if (error) throw new Error(error.message);
  } catch (err) {
    log.warn("storage_cleanup_failed", { err: messageOf(err), path });
    return "remove-failed";
  }
  return "removed";
}
