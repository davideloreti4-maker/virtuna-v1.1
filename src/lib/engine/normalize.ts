import type { AnalysisInput, ContentPayload } from "./types";

/**
 * Extract hashtags from text content.
 * Matches #word patterns, returns lowercase unique list.
 */
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((h) => h.toLowerCase())));
}

/**
 * Estimate video duration from content text hints.
 * Looks for patterns like "30s", "1 min", "60 seconds" in the text.
 * Returns null if no hint found.
 */
function extractDurationHint(text: string): number | null {
  // Match "Xs" or "X seconds"
  const secMatch = text.match(/(\d+)\s*(?:s|sec|seconds?)\b/i);
  if (secMatch) return parseInt(secMatch[1]!, 10);

  // Match "X min" or "X minutes"
  const minMatch = text.match(/(\d+)\s*(?:min|minutes?)\b/i);
  if (minMatch) return parseInt(minMatch[1]!, 10) * 60;

  return null;
}

/**
 * Normalize AnalysisInput into ContentPayload for pipeline consumption.
 *
 * For text mode: uses content_text directly. Both video_url and video_storage_path are null.
 * For tiktok_url mode: content_text is caption/script (optional), video_url set to TikTok URL.
 *   Actual video extraction happens in pipeline via Apify (Phase 5).
 * For video_upload mode: content_text is caption (optional), video_storage_path carries the
 *   Supabase Storage object key. video_url is explicitly null (Phase 4 GAP-04-01 fix — Option A).
 *   Pre-fix, video_url was aliased to the storage key, which made fetch(payload.video_url) throw
 *   TypeError in production (the storage key is not a URL). The detector now reads
 *   video_storage_path explicitly — re-introducing the alias here would revive the bug.
 */
export function normalizeInput(input: AnalysisInput): ContentPayload {
  const contentText = input.content_text ?? "";

  return {
    content_text: contentText,
    content_type: input.content_type,
    input_mode: input.input_mode,
    // Phase 4 GAP-04-01 fix (Option A — eliminate alias at source):
    //   - tiktok_url mode: input.tiktok_url (proper URL — used by Apify scrape, etc.)
    //   - video_upload mode: null (the detector reads video_storage_path explicitly; aliasing
    //     the storage key into video_url is what caused fetch(payload.video_url) to throw
    //     TypeError in production)
    //   - text mode: null
    video_url: input.tiktok_url ?? null,
    // NEW Phase 4 gap-closure: explicit field for the storage key. The Wave 0
    // content-type detector reads THIS field (not video_url) to call
    // supabase.storage.from("videos").download(...) — fixes GAP-04-01.
    video_storage_path: input.video_storage_path ?? null,
    hashtags: extractHashtags(contentText),
    duration_hint: extractDurationHint(contentText),
    niche: input.niche ?? null,
    creator_handle: input.creator_handle ?? null,
    society_id: input.society_id ?? null,
  };
}
