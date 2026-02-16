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
 * For text mode: uses content_text directly.
 * For tiktok_url mode: content_text is caption/script (optional), video_url set to TikTok URL.
 *   Actual video extraction happens in pipeline via Apify (Phase 5).
 * For video_upload mode: content_text is caption (optional), video_url points to Supabase Storage.
 *   Actual storage URL resolution happens in pipeline (Phase 5).
 */
export function normalizeInput(input: AnalysisInput): ContentPayload {
  const contentText = input.content_text ?? "";

  return {
    content_text: contentText,
    content_type: input.content_type,
    input_mode: input.input_mode,
    video_url: input.tiktok_url ?? input.video_storage_path ?? null,
    hashtags: extractHashtags(contentText),
    duration_hint: extractDurationHint(contentText),
    niche: input.niche ?? null,
    creator_handle: input.creator_handle ?? null,
    society_id: input.society_id ?? null,
  };
}
