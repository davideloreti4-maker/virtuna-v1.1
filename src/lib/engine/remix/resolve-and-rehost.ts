/**
 * Phase 03 Plan 01 — Resolve and Rehost Helper.
 *
 * Extracted from src/lib/engine/pipeline.ts:529-609 (inline tiktok_url hop).
 * Preserves ALL security invariants from the source:
 *
 *   T-03-01 (token non-leak): Apify download token appended ONLY to the server-side
 *     fetch URL, NEVER to the Omni-facing URL (which is a Supabase signed URL).
 *   T-03-02 (derive-and-drop): cleanup() unconditionally removes the temp mp4 object.
 *     NEVER sets video_storage_path. cleanup() must be called in a finally block.
 *
 * NOTE: This helper extracts the existing inline code. It does NOT refactor pipeline.ts
 * to use it — that is intentionally left for Plan 02 (the decode route) to consume first,
 * avoiding any score-path regression this plan.
 *
 * Usage:
 *   const { signedUrl, cleanup } = await resolveAndRehost(tiktokUrl, requestId);
 *   try {
 *     // ... use signedUrl with analyzeVideoWithOmni ...
 *   } finally {
 *     await cleanup(); // unconditional delete of temp mp4
 *   }
 */
import { createLogger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import { IngestError } from "@/lib/scraping/types";

const log = createLogger({ module: "engine.remix.resolve-and-rehost" });

export interface ResolveAndRehostResult {
  /** Supabase signed URL (no token — safe to pass to Omni/DashScope). T-03-01. */
  signedUrl: string;
  /**
   * Source video cover thumbnail (resolveVideoUrl → clockworks videoMeta.coverUrl). An
   * ephemeral TikTok-CDN image, display-only (the Remix card's source thumbnail). NOT a
   * media reference — never fetched/rehosted; undefined when the rehost item had no cover.
   */
  coverUrl?: string;
  /**
   * Who made the source post and how it did (resolveVideoUrl → clockworks `authorMeta.name`,
   * `playCount`, `webVideoUrl`). Display-only attribution for the Remix card's receipt — the
   * cover alone showed the post without ever naming its creator. Undefined when the actor
   * item carried no author block; the card then renders with no receipt at all rather than an
   * unattributed one.
   */
  handle?: string;
  views?: number;
  sourceUrl?: string;
  /**
   * Unconditionally deletes the temp mp4 object from the videos bucket.
   * MUST be called in a finally block (derive-and-drop, T-03-02 / pitfall C4).
   * Failure to call this leaves a temp object in the bucket — treat as a bug.
   */
  cleanup: () => Promise<void>;
}

/**
 * Resolves a TikTok URL to a short-lived Supabase signed URL by:
 *   1. Resolving to an mp4 URL via ApifyScrapingProvider (SSRF-validated)
 *   2. Downloading mp4 bytes server-side with the Apify token (token NEVER leaves server)
 *   3. Re-hosting bytes to videos bucket at a temp path
 *   4. Minting a 1-hour signed URL from the temp path
 *
 * The returned cleanup() MUST be called unconditionally in a finally block.
 * NEVER sets video_storage_path (derive-and-drop — source media is not owned).
 *
 * @param tiktokUrl - The TikTok URL to resolve and re-host
 * @param requestId - Unique ID for the temp path (prevents concurrent collision)
 * @throws Error/IngestError on resolve, download, upload, or sign failure
 */
export async function resolveAndRehost(
  tiktokUrl: string,
  requestId: string,
): Promise<ResolveAndRehostResult> {
  const supabase = createServiceClient();

  // Step 1: Resolve URL via ApifyScrapingProvider.resolveVideoUrl (SSRF-validated).
  // The returned mp4Url is a private api.apify.com KV-store URL — requires token to access.
  const resolver = new ApifyScrapingProvider();
  const resolved = await resolver.resolveVideoUrl(tiktokUrl);

  // Step 2: Download mp4 bytes SERVER-SIDE with the Apify token.
  // T-03-01: Token is ONLY used for this server-side fetch.
  // The token NEVER appears in the signedUrl returned from this function.
  const tokenedUrl = `${resolved.mp4Url}?token=${process.env.APIFY_TOKEN ?? ""}`;
  const fetchResp = await fetch(tokenedUrl);
  if (!fetchResp.ok) {
    throw new IngestError(
      "scrape_failed",
      tiktokUrl,
      new Error(`mp4 download failed: HTTP ${fetchResp.status}`),
    );
  }
  const mp4Bytes = await fetchResp.arrayBuffer();

  // Step 3: Re-host bytes to the videos bucket at a temp path.
  // Path uses the requestId so concurrent requests never collide.
  // NEVER sets video_storage_path — this is a derive-and-drop temp object.
  const rehostPath = `remix-temp/${requestId}.mp4`;
  const { error: uploadError } = await supabase
    .storage
    .from("videos")
    .upload(rehostPath, mp4Bytes, { contentType: "video/mp4", upsert: true });
  if (uploadError) {
    throw new Error(`re-host upload failed: ${uploadError.message}`);
  }

  // Step 4: Mint a short-lived signed URL (1 hour).
  // This is the URL safe to hand to analyzeVideoWithOmni (Supabase signed URL, no token).
  // T-03-01: signedUrl contains NO Apify token.
  const { data: signedData, error: signedError } = await supabase
    .storage
    .from("videos")
    .createSignedUrl(rehostPath, 3600);
  if (signedError || !signedData?.signedUrl) {
    // Upload succeeded but sign failed — set up cleanup before throwing
    const pathToClean = rehostPath;
    void supabase
      .storage
      .from("videos")
      .remove([pathToClean])
      .catch((err: unknown) => {
        log.warn("rehost_cleanup_on_sign_failure", {
          err: err instanceof Error ? err.message : String(err),
          path: pathToClean,
        });
      });
    throw new Error(
      `re-host signed URL failed: ${signedError?.message ?? "no URL returned"}`,
    );
  }

  const signedUrl = signedData.signedUrl;

  // Step 5: Return cleanup function (MUST be called in finally — derive-and-drop).
  // T-03-02: cleanup unconditionally removes the temp object.
  // Does NOT consult storage_retention_opted_in — non-owned media never persists.
  const cleanup = async (): Promise<void> => {
    await supabase
      .storage
      .from("videos")
      .remove([rehostPath])
      .catch((err: unknown) => {
        log.warn("rehost_cleanup_failed", {
          err: err instanceof Error ? err.message : String(err),
          path: rehostPath,
        });
      });
  };

  return {
    signedUrl,
    cleanup,
    coverUrl: resolved.coverUrl,
    handle: resolved.handle,
    views: resolved.views,
    sourceUrl: resolved.videoUrl,
  };
}
