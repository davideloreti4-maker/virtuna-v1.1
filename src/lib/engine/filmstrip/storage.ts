/**
 * Filmstrip Supabase Storage upload + signed URL minting (D-10).
 *
 * Writes JPEG frames to the `filmstrips` bucket (private, created in Plan 03).
 * Graceful-degradation contract: never throws, returns null on any error.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "engine.filmstrip.storage" });

/**
 * Upload a JPEG buffer to `filmstrips/<analysisId>/<segmentIdx>.jpg` and
 * return a 30-day signed URL, or null on any failure.
 */
export async function uploadFrameAndGetSignedUrl(
  analysisId: string,
  segmentIdx: number,
  jpegBuffer: Buffer,
): Promise<string | null> {
  const supabase = createServiceClient();
  const path = `${analysisId}/${segmentIdx}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("filmstrips")
    .upload(path, jpegBuffer, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    log.error("filmstrip upload failed", { path, error: uploadError.message });
    return null;
  }

  const { data, error: urlError } = await supabase.storage
    .from("filmstrips")
    .createSignedUrl(path, 60 * 60 * 24 * 30); // 30-day TTL in seconds

  if (urlError || !data) {
    log.error("filmstrip signed URL failed", { path, error: urlError?.message });
    return null;
  }

  return data.signedUrl;
}

/**
 * Re-sign the persisted keyframe JPEGs for one analysis as `{ segmentIdx → signedUrl }`.
 *
 * Signed URLs are ephemeral and not persisted, so any surface that renders a real frame after
 * the live run must re-sign on read. Extracted from GET /api/analyze/[id]/filmstrips so the
 * in-thread Test card (frame-by-frame craft teardown) can resolve THEIR frames server-side and
 * embed them in the block, rather than depending on the /analyze route's `useParams`-keyed hook.
 *
 * Graceful-degradation: never throws — returns {} on any list/sign failure, and the renderer then
 * shows a play-tile per frame (a keyframe slot is never a broken box). The bucket is private, so
 * this uses the service client; the CALLER must have already ownership-scoped `analysisId`.
 */
export async function signAnalysisFrames(
  analysisId: string,
  ttlSeconds = 60 * 60,
): Promise<Record<number, string>> {
  try {
    const service = createServiceClient();
    const { data: files, error: listError } = await service.storage
      .from("filmstrips")
      .list(analysisId, { limit: 100 });
    if (listError || !files || files.length === 0) return {};

    const jpegs = files.filter((f) => f.name.endsWith(".jpg"));
    const paths = jpegs.map((f) => `${analysisId}/${f.name}`);
    const { data: signed } = await service.storage.from("filmstrips").createSignedUrls(paths, ttlSeconds);

    const frames: Record<number, string> = {};
    (signed ?? []).forEach((s, i) => {
      const name = jpegs[i]?.name;
      const idx = name ? Number.parseInt(name.replace(/\.jpg$/, ""), 10) : NaN;
      if (s.signedUrl && Number.isFinite(idx)) frames[idx] = s.signedUrl;
    });
    return frames;
  } catch (err) {
    log.error("filmstrip re-sign failed", {
      analysisId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}
