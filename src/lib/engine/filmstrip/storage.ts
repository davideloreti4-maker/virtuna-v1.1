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
 * The subfolder the remix SCRUB frames live in, under the same blueprint prefix as the beat
 * frames: `filmstrips/<blueprintId>/scrub/<i>.jpg`.
 *
 * ⚠️ THIS IS LOAD-BEARING. Beat frames are written FLAT at `<blueprintId>/<beatIndex>.jpg`, and
 * `signAnalysisFrames` parses that integer out of the filename. Writing ~30 scrub frames as
 * `0..29` into the same flat prefix would silently OVERWRITE beat frames 0–7, and the shoot sheet
 * would render a scrub frame where it means a beat frame with nothing erroring anywhere.
 *
 * A subfolder is what keeps the two apart, and it works because Supabase `list()` returns a
 * subfolder as a pseudo-entry named `scrub` — no `.jpg` suffix — which `signAnalysisFrames`
 * filters out. Beat frames therefore keep their existing paths (nothing already written is
 * stranded) and the reader needs no change at all. Pinned by a regression test in
 * `__tests__/storage-scrub-isolation.test.ts`.
 */
export const SCRUB_PREFIX = "scrub";

/**
 * Upload one remix scrub frame and return its signed URL, or null on any failure.
 *
 * Deliberately a sibling of `uploadFrameAndGetSignedUrl` rather than a new argument on it: that
 * function is shared with the analyze/filmstrip path, and widening a shared writer to serve a
 * second keyspace is how the two keyspaces end up one edit away from colliding again.
 */
export async function uploadScrubFrame(
  blueprintId: string,
  index: number,
  jpegBuffer: Buffer,
): Promise<string | null> {
  const supabase = createServiceClient();
  const path = `${blueprintId}/${SCRUB_PREFIX}/${index}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("filmstrips")
    .upload(path, jpegBuffer, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    log.error("scrub frame upload failed", { path, error: uploadError.message });
    return null;
  }

  const { data, error: urlError } = await supabase.storage
    .from("filmstrips")
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  if (urlError || !data) {
    log.error("scrub frame signed URL failed", { path, error: urlError?.message });
    return null;
  }

  return data.signedUrl;
}

/**
 * Re-sign the persisted SCRUB frames for one blueprint as `{ index → signedUrl }`.
 *
 * Same contract as `signAnalysisFrames` — never throws, `{}` on any fault, and the caller must
 * have already ownership-scoped `blueprintId`. The limit is 100, comfortably above the ~30 this
 * lane writes; a strip that silently truncated would read as a short video rather than as a bug.
 */
export async function signScrubFrames(
  blueprintId: string,
  ttlSeconds = 60 * 60,
): Promise<Record<number, string>> {
  try {
    const service = createServiceClient();
    const folder = `${blueprintId}/${SCRUB_PREFIX}`;
    const { data: files, error: listError } = await service.storage
      .from("filmstrips")
      .list(folder, { limit: 100 });
    if (listError || !files || files.length === 0) return {};

    const jpegs = files.filter((f) => f.name.endsWith(".jpg"));
    const paths = jpegs.map((f) => `${folder}/${f.name}`);
    const { data: signed } = await service.storage
      .from("filmstrips")
      .createSignedUrls(paths, ttlSeconds);

    const frames: Record<number, string> = {};
    (signed ?? []).forEach((s, i) => {
      const name = jpegs[i]?.name;
      const idx = name ? Number.parseInt(name.replace(/\.jpg$/u, ""), 10) : NaN;
      if (s.signedUrl && Number.isFinite(idx)) frames[idx] = s.signedUrl;
    });
    return frames;
  } catch (err) {
    log.error("scrub frame re-sign failed", {
      blueprintId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
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
