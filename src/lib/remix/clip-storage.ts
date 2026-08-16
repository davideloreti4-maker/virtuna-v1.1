/**
 * clip-storage.ts — the `clips` bucket writer/signer (remix phase 4).
 *
 * Deliberately NOT added to `src/lib/engine/filmstrip/storage.ts`: that module's own
 * `SCRUB_PREFIX` comment records what happened last time a shared writer was widened to serve a
 * second keyspace. Clips get their own bucket (a different media type with a different retention
 * policy — the reaper must never be ambiguous about what it may delete) and their own module.
 *
 * One deviation from `signScrubFrames`, which lists a prefix and signs what it finds:
 * `signClips` takes THE PATHS and signs exactly those. The row already carries them
 * (`remix_blueprints.clip_uris`) and the route has already read the row, so listing would be a
 * second storage round-trip to rediscover something in hand.
 *
 * Graceful-degradation contract throughout: never throws; null / {} on any fault. A sheet with
 * no clips is exactly the pre-lane sheet, which is a complete product.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "remix.clip-storage" });

export const CLIPS_BUCKET = "clips";

/**
 * Upload one clip to `clips/<blueprintId>/<beatIndex>.mp4` and return the STORAGE PATH, or null
 * on any failure. Never a signed URL: paths are what the row stores — a signed URL in a durable
 * column is a dead link on day 31 and a live credential in a shared row.
 */
export async function uploadClip(
  blueprintId: string,
  beatIndex: number,
  mp4: Buffer,
): Promise<string | null> {
  const supabase = createServiceClient();
  const path = `${blueprintId}/${beatIndex}.mp4`;

  const { error } = await supabase.storage
    .from(CLIPS_BUCKET)
    .upload(path, mp4, { contentType: "video/mp4", upsert: true });

  if (error) {
    log.error("clip upload failed", { path, error: error.message });
    return null;
  }
  return path;
}

/**
 * Re-sign the given clip paths as `{ beatIndex → signedUrl }`. The beat index comes from the
 * filename (`<blueprintId>/<beatIndex>.mp4`), exactly as the frame signers parse theirs.
 *
 * `paths` arrives from a jsonb column read without a zod parse, so the non-array guard is not
 * paranoia — a pre-lane row or a manually-edited row must degrade to {}, never throw.
 */
export async function signClips(
  paths: string[],
  ttlSeconds = 60 * 60,
): Promise<Record<number, string>> {
  try {
    if (!Array.isArray(paths) || paths.length === 0) return {};
    const service = createServiceClient();
    const { data: signed } = await service.storage
      .from(CLIPS_BUCKET)
      .createSignedUrls(paths, ttlSeconds);

    const clips: Record<number, string> = {};
    (signed ?? []).forEach((s, i) => {
      const name = paths[i]?.split("/").pop() ?? "";
      const idx = Number.parseInt(name.replace(/\.mp4$/u, ""), 10);
      if (s.signedUrl && Number.isFinite(idx)) clips[idx] = s.signedUrl;
    });
    return clips;
  } catch (err) {
    log.error("clip re-sign failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}
