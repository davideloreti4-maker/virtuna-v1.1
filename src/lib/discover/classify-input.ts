/**
 * classify-input.ts — Phase 08, Plan 02, Task 2 (D-14).
 *
 * Pure input classifier for a Discover pull. NO Apify / Supabase imports.
 *
 *   "@handle"  or a tiktok.com/@user URL  → { mode: "profile", normalized: <handle> }
 *   anything else (free text)             → { mode: "niche",   normalized: <trimmed/lowercased> }
 *
 * Reuses normalizeHandle from competitor.ts for the profile branch (do NOT hand-roll —
 * it already extracts the handle from a TikTok URL, strips a leading @, and lowercases).
 */
import { normalizeHandle } from "@/lib/schemas/competitor";

export type DiscoverMode = "profile" | "niche";

export interface ClassifiedInput {
  mode: DiscoverMode;
  /** profile: normalized handle (no @, lowercased). niche: trimmed/lowercased text. */
  normalized: string;
}

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

/**
 * Classify a Discover input string into a profile or niche pull.
 * @param raw the raw user input ("@creator", "https://tiktok.com/@creator", or "cooking tips")
 */
export function classifyDiscoverInput(raw: string): ClassifiedInput {
  if (isProfileInput(raw)) {
    return { mode: "profile", normalized: normalizeHandle(raw) };
  }
  return { mode: "niche", normalized: raw.trim().toLowerCase() };
}
