/**
 * classify-input.ts — Phase 08, Plan 02, Task 2 (D-14).
 *
 * Pure input classifier for a Discover pull. NO Apify / Supabase imports.
 *
 *   "@handle"  or a tiktok.com/@user URL  → { mode: "profile",     normalized: <handle> }
 *   a non-TikTok link (instagram.com, …)  → { mode: "unsupported", reason: <why> }
 *   anything else (free text)             → { mode: "niche",       normalized: <trimmed/lowercased> }
 *
 * Reuses normalizeHandle from competitor.ts for the profile branch (do NOT hand-roll —
 * it already extracts the handle from a TikTok URL, strips a leading @, and lowercases).
 *
 * Honesty spine: scraping is TikTok-only. A pasted instagram.com / youtube.com / x.com URL
 * must NOT silently degrade into a garbage niche search — it is rejected HONESTLY so callers
 * can tell the user "Only TikTok is supported" instead of returning irrelevant results.
 */
import { normalizeHandle } from "@/lib/schemas/competitor";

export type DiscoverMode = "profile" | "niche" | "unsupported";

export interface ClassifiedInput {
  mode: DiscoverMode;
  /** profile: normalized handle (no @, lowercased). niche: trimmed/lowercased text. unsupported: trimmed raw. */
  normalized: string;
  /** Human-facing rejection reason — present ONLY when mode === "unsupported". */
  reason?: string;
}

/** The honest rejection shown when a non-TikTok link is pasted. */
export const UNSUPPORTED_INPUT_REASON =
  "Only TikTok is supported right now — paste a TikTok @handle or URL.";

/** Platforms we can't pull from (scraping is TikTok-only). Matched as a BARE host too, so
 *  "instagram.com" with no path is still honestly rejected — not just full URLs. */
const NON_TIKTOK_PLATFORMS = new Set([
  "instagram.com", "youtube.com", "youtu.be", "facebook.com", "fb.com", "fb.watch",
  "twitter.com", "x.com", "threads.net", "snapchat.com", "linkedin.com", "twitch.tv",
  "pinterest.com", "reddit.com", "vimeo.com",
]);

/** True when the raw input is a TikTok profile reference (@handle or a tiktok.com URL). */
function isProfileInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.startsWith("@")) return true;
  // A tiktok.com/@user URL is a profile reference (a /video/ URL is a single post, not a
  // Discover handle pull — but the profile-scraper takes the handle either way; we treat
  // any tiktok.com/@user as profile mode).
  if (/tiktok\.com\/@?[a-zA-Z0-9_.]+/i.test(trimmed)) return true;
  return false;
}

/** A TikTok host (tiktok.com or any subdomain) — never rejected as unsupported. */
function isTikTokHost(host: string): boolean {
  return host === "tiktok.com" || host.endsWith(".tiktok.com");
}

/**
 * When `raw` is a link we can't scrape, return the rejection reason; otherwise null.
 * Rejects any non-TikTok URL (it has a scheme or a /path) OR a bare known-platform host.
 * Multi-word free text ("node.js tutorials") is always a niche, never a URL.
 */
function unsupportedReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (/\s/.test(trimmed)) return null; // multi-word free text → niche, never a link
  const m = trimmed.match(/^(?:(https?:\/\/)|(www\.))?([a-z0-9.-]+\.[a-z]{2,})([/?#]\S*)?$/i);
  if (!m) return null;
  const host = m[3]!.toLowerCase();
  if (isTikTokHost(host)) return null;
  const hasSchemeOrPath = Boolean(m[1] || m[2] || m[4]);
  if (hasSchemeOrPath || NON_TIKTOK_PLATFORMS.has(host)) return UNSUPPORTED_INPUT_REASON;
  return null;
}

/**
 * Classify a Discover input string into a profile, niche, or unsupported pull.
 * @param raw the raw user input ("@creator", "https://tiktok.com/@creator", "cooking tips",
 *            or a non-TikTok link like "instagram.com/creator")
 */
export function classifyDiscoverInput(raw: string): ClassifiedInput {
  if (isProfileInput(raw)) {
    return { mode: "profile", normalized: normalizeHandle(raw) };
  }
  const reason = unsupportedReason(raw);
  if (reason) {
    return { mode: "unsupported", normalized: raw.trim(), reason };
  }
  return { mode: "niche", normalized: raw.trim().toLowerCase() };
}
