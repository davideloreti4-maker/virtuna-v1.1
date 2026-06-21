/**
 * grounding-line.ts — GROUND-03 by-role human-facing grounding-line extractor (D-09/D-14).
 *
 * PURPOSE: Produce human-facing card copy from creator_profiles fields by semantic role.
 * This is NOT the LLM-facing assembler (assembler.ts) — the assembler produces prompt
 * instruction text WITH honesty caveats ("(creator-reported, directional)", "steer toward").
 * This module strips all caveat phrasing and renders clean, scannable card copy.
 *
 * HONESTY SPINE (RESEARCH Pitfall 1):
 *  - past_wins stores ONLY {url} in v1 — no mechanism/content is known.
 *    The honest v1 line is "your last N videos overperformed" (count only).
 *    NEVER fabricate "your myth-busts" or any mechanism from a URL alone.
 *  - Cold-start line is honest: platform baselines + profile-add nudge (D-14).
 *    NEVER produce "because your audience is…" from a thin/null profile.
 *
 * FUNCTION SIGNATURE:
 *   buildGroundingLine(profileRow: ProfileRow | null, platform: string)
 *     → { line: string; coldStart: boolean }
 *
 * Used server-side by the Plan 03 Ideas API route; pure function (no I/O).
 *
 * Does NOT import from assembler.ts or profile-role-map.ts formatters
 * (those emit LLM-facing text; this module renders card-facing text).
 * Reads ProfileRow fields by semantic role directly.
 *
 * Thinness check: replicates assembler.ts:isProfileThin (lines ~166-175) semantics
 * without importing to avoid circular risk. Semantics are identical: null row OR
 * all null fields = thin.
 */

import type { ProfileRow } from "./profile-role-map";

// ─── Thinness check ───────────────────────────────────────────────────────────

/**
 * Determine if a profile row is thin (provides no useful grounding data).
 * Semantics mirror assembler.ts:isProfileThin — kept local to avoid circular imports
 * and to give this module a clear, isolated dependency surface.
 */
export function isThin(profileRow: ProfileRow | null): boolean {
  if (profileRow === null) return true;
  const hasNiche = Boolean(profileRow.niche_primary);
  const hasAudience = Boolean(profileRow.target_audience);
  const hasGoals = Boolean(profileRow.primary_goal);
  const hasWins = Boolean(profileRow.past_wins?.length);
  const hasFlops = Boolean(profileRow.past_flops?.length);
  const hasPlatform = Boolean(profileRow.target_platforms?.length);
  return !hasNiche && !hasAudience && !hasGoals && !hasWins && !hasFlops && !hasPlatform;
}

// ─── Fragment builders ────────────────────────────────────────────────────────
// Each returns a human-facing string or null when the data is absent.
// These are card-copy renderers — NOT prompt formatters.

/**
 * Audience fragment: "18-25" or "18-25 female-skewed" from target_audience.age_range.
 * Omits geo/language — too verbose for the card's grounding line.
 * Returns null when age_range is absent.
 */
function audienceFragment(profileRow: ProfileRow): string | null {
  const ta = profileRow.target_audience;
  if (!ta || !ta.age_range) return null;
  const parts = [ta.age_range];
  if (ta.gender_skew) parts.push(ta.gender_skew);
  return parts.join(" ");
}

/**
 * Niche fragment: just the niche slug or sub-niche, human-readable.
 * Returns null when niche_primary is absent.
 */
function nicheFragment(profileRow: ProfileRow): string | null {
  if (!profileRow.niche_primary) return null;
  const primary = profileRow.niche_primary.replace(/-/g, " ");
  const sub = profileRow.niche_sub
    ? ` · ${profileRow.niche_sub.replace(/-/g, " ")}`
    : "";
  return `${primary}${sub}`;
}

/**
 * Wins fragment: COUNT-only honest claim.
 * "your last N videos overperformed" — no mechanism (URLs only in v1).
 * Returns null when past_wins is absent or empty.
 *
 * HONESTY: The GROUND-03 example copy aspirationally says "last 3 myth-busts
 * overperformed" — that implies content-level knowledge we do NOT have (only URLs
 * stored). v1 uses count only. This is the documented honesty-spine trade (RESEARCH
 * §Pattern 5 / §Pitfall 1).
 */
function winsFragment(profileRow: ProfileRow): string | null {
  if (!profileRow.past_wins || profileRow.past_wins.length === 0) return null;
  const count = profileRow.past_wins.length;
  return `your last ${count} video${count === 1 ? "" : "s"} overperformed`;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Build the human-facing grounding line for an idea card (D-09/GROUND-03).
 *
 * @param profileRow  The creator_profiles row, or null for no profile.
 * @param platform    The request platform ("tiktok" | "instagram" | "youtube").
 * @returns           { line: string; coldStart: boolean }
 *
 * Examples:
 *   Full profile:    { line: "Because: 18-25 · fitness · your last 3 videos overperformed", coldStart: false }
 *   Thin profile:    { line: "Based on TikTok baselines — add your profile for tailored ideas", coldStart: true }
 *   Audience only:   { line: "Because: 25-35 · fitness", coldStart: false }
 */
export function buildGroundingLine(
  profileRow: ProfileRow | null,
  platform: string,
): { line: string; coldStart: boolean } {
  // Cold-start path (D-14): thin/null profile → honest fallback, never fabricated
  if (isThin(profileRow)) {
    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    return {
      line: `Based on ${platformLabel} baselines — add your profile for tailored ideas`,
      coldStart: true,
    };
  }

  // Full/partial profile: compose fragments by semantic role, include only what the
  // data supports. Order: audience → niche → wins (decreasing specificity fallback).
  const row = profileRow as ProfileRow; // isThin guarantees non-null here
  const fragments: string[] = [];

  const audience = audienceFragment(row);
  if (audience) fragments.push(audience);

  const niche = nicheFragment(row);
  if (niche) fragments.push(niche);

  const wins = winsFragment(row);
  if (wins) fragments.push(wins);

  // Edge: all fragments empty (profile row exists but all relevant fields are null)
  // Treat as cold-start rather than emitting an empty "Because:" line.
  if (fragments.length === 0) {
    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    return {
      line: `Based on ${platformLabel} baselines — add your profile for tailored ideas`,
      coldStart: true,
    };
  }

  return {
    line: `Because: ${fragments.join(" · ")}`,
    coldStart: false,
  };
}
