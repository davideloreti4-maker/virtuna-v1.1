/**
 * PROFILE_ROLE_MAP — semantic-role to column lookup (D-05 by-role constraint).
 *
 * All knowledge of the current creator_profiles column layout is isolated here.
 * When the v6.1 profile redesign changes column names or shapes, ONLY THIS FILE
 * needs to update — every consumer references by semantic ROLE, not by column.
 *
 * Seven roles (GROUND-02 / RESEARCH 3C + N1 voice sample):
 *   niche      — niche_primary + niche_sub
 *   audience   — target_audience JSON (age_range, gender_skew, geo, language)
 *   goals      — primary_goal + creator_stage
 *   wins       — past_wins (creator-reported, directional — no scraped content in v1)
 *   flops      — past_flops (same caveat as wins)
 *   platform   — the per-request platform param wins over target_platforms[0] (D-07)
 *                 (per-request param is injected externally; this map only covers the
 *                  profile-stored default fallback portion of the platform role)
 *
 * Each formatter receives the full creator_profiles row (typed narrowly to the
 * fields it actually reads) and returns a formatted string or null when the field
 * is absent / empty. Null → role is silently omitted (per creator.ts:299-353).
 *
 * Does NOT import from the engine module or the scoring core (DDD bounded-context isolation, D-08).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Semantic roles that the generative KC assembler understands.
 * Adding a new role here + a formatter is the ONLY change needed when a new
 * profile concept is introduced.
 */
export type Role = "niche" | "audience" | "goals" | "wins" | "flops" | "platform" | "voice";

/**
 * Narrow profile row type — only the columns the role-map reads.
 * Keeps the surface isolated: if the column shapes change, TypeScript
 * surfaces the mismatch here, not across every consumer.
 */
export interface ProfileRow {
  niche_primary?: string | null;
  niche_sub?: string | null;
  target_audience?: {
    age_range?: string | null;
    gender_skew?: string | null;
    geo?: string | null;
    language?: string | null;
  } | null;
  primary_goal?: string | null;
  creator_stage?: string | null;
  past_wins?: Array<{ url: string }> | null;
  past_flops?: Array<{ url: string }> | null;
  target_platforms?: string[] | null;
  writing_voice_sample?: string | null;
}

// ─── Role formatters ──────────────────────────────────────────────────────────

/**
 * Format niche: "niche_primary > niche_sub" or just niche_primary.
 * Returns null if niche_primary is absent (niche_sub alone has no value without the primary).
 */
function formatNiche(row: ProfileRow): string | null {
  if (!row.niche_primary) return null;
  const sub = row.niche_sub ? ` > ${row.niche_sub}` : "";
  return `Niche: ${row.niche_primary}${sub}`;
}

/**
 * Format audience: structured target_audience JSON → human-readable parts.
 * Returns null if all sub-fields are absent/empty.
 */
function formatAudience(row: ProfileRow): string | null {
  const ta = row.target_audience;
  if (!ta) return null;
  const parts: string[] = [];
  if (ta.age_range) parts.push(`age ${ta.age_range}`);
  if (ta.gender_skew) parts.push(`${ta.gender_skew}-skewed`);
  if (ta.geo) parts.push(ta.geo);
  if (ta.language) parts.push(ta.language);
  if (parts.length === 0) return null;
  return `Target audience: ${parts.join(", ")}`;
}

/**
 * Format goals: primary_goal + optional creator_stage.
 * Returns null if primary_goal is absent.
 */
function formatGoals(row: ProfileRow): string | null {
  if (!row.primary_goal) return null;
  const stage = row.creator_stage ? ` (${row.creator_stage} stage)` : "";
  return `Primary goal: ${row.primary_goal}${stage}`;
}

/**
 * Format wins: past_wins count + honest "creator-reported, directional" caveat.
 *
 * v1 caveat: only URLs are stored, no scraped content. Surfaced as directional
 * signal only — do NOT fabricate a mechanism behind a URL (honesty spine, RESEARCH 4B).
 * Full content enrichment deferred to v6.1 (PROFILE-01 / RAG).
 *
 * Returns null if past_wins is absent or empty.
 */
function formatWins(row: ProfileRow): string | null {
  if (!row.past_wins || row.past_wins.length === 0) return null;
  const count = row.past_wins.length;
  return `Past wins (creator-reported, directional): ${count} video${count === 1 ? "" : "s"} — steer toward patterns that worked for this creator`;
}

/**
 * Format flops: past_flops count + honest "creator-reported, directional" caveat.
 *
 * Same v1 limitation as wins — URL only, no content. Surfaces as negative grounding:
 * steer AWAY from patterns this creator reports as failures (D-04 flops-as-negative-grounding).
 * Do NOT fabricate the mechanism (honesty spine, RESEARCH 4B).
 *
 * Returns null if past_flops is absent or empty.
 */
function formatFlops(row: ProfileRow): string | null {
  if (!row.past_flops || row.past_flops.length === 0) return null;
  const count = row.past_flops.length;
  return `Past flops (creator-reported, directional): ${count} video${count === 1 ? "" : "s"} — avoid patterns this creator reports as failures`;
}

/**
 * Format platform: target_platforms[0] as the profile-stored default.
 *
 * D-07 note: the per-request platform param (composer chip) OVERRIDES this default.
 * The assembler is responsible for applying D-07 — it passes the winning value here.
 * This formatter is only called when the per-request param is not provided (fallback).
 *
 * Returns null if target_platforms is absent or empty.
 */
function formatPlatform(row: ProfileRow): string | null {
  if (!row.target_platforms || row.target_platforms.length === 0) return null;
  return `Target platform: ${row.target_platforms[0]}`;
}


/**
 * Format voice: wraps the creator's verbatim writing sample in an injection
 * fence with an instruction header that explicitly restricts emulation to
 * STYLE/rhythm/tone — never content or claims (honesty-spine aligned, D-04).
 *
 * Returns null when writing_voice_sample is absent or blank (graceful cold-start).
 * The fence uses the same <<<USER_CONTENT>>> sentinels as all other user-supplied
 * content in the assembler (GROUND-02 injection-guard parity).
 *
 * The instruction header is OUTSIDE the fence (assembler-controlled, trusted)
 * so the LLM sees it as a system directive, not user-supplied text.
 */
function formatVoice(row: ProfileRow): string | null {
  const sample = row.writing_voice_sample?.trim();
  if (!sample) return null;
  return [
    "Writing voice — emulate the STYLE, rhythm, and tone only; do NOT reuse specific content or claims:",
    "<<<USER_CONTENT>>>",
    sample,
    "<<<END_USER_CONTENT>>>",
  ].join("\n");
}

// ─── PROFILE_ROLE_MAP ─────────────────────────────────────────────────────────

/**
 * Maps each semantic role to its formatting function.
 *
 * Usage:
 *   const text = PROFILE_ROLE_MAP.niche(profileRow);   // string | null
 *
 * Column knowledge lives ONLY here (D-05 by-role, not by-card). A null return
 * means the role is absent for this profile — the assembler silently omits it.
 */
export const PROFILE_ROLE_MAP: Record<Role, (row: ProfileRow) => string | null> = {
  niche: formatNiche,
  audience: formatAudience,
  goals: formatGoals,
  wins: formatWins,
  flops: formatFlops,
  platform: formatPlatform,
  voice: formatVoice,
};
