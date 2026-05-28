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
