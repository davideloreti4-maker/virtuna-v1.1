/**
 * apply-creator-persona.ts — §P step-7 generation wiring (creator voice + steer).
 *
 * applyCreatorPersona(profileRow, audience) → { profileRow, creatorSteer }
 *
 * Wires the PER-AUDIENCE, auto-derived `creator_persona` (frozen at calibration from the
 * real scrape + transcripts + omni-flash watchNotes) into the generation path so outputs
 * sound like the creator on THIS audience's account. Two effects, both FALLBACK-shaped so
 * manual curation always wins (decided 2026-06-24):
 *
 *   1. VOICE (fallback): the manually-curated profile voice (`writing_voice_sample`) wins;
 *      the auto-derived `writing_style_sample` fills the slot ONLY when the profile voice
 *      is absent. Implemented by backfilling `profileRow.writing_voice_sample` so the entire
 *      existing voice machinery (PROFILE_ROLE_MAP voice role → formatVoice → priority/budget)
 *      is reused untouched (assembler stays byte-stable).
 *   2. STEER: `content_description` + `context` (audience · voice · formats · expertise ·
 *      AVOID) folded into a one-line creator steer the runner appends to assembleBundle.overrides.
 *
 * GATE-SAFE BY CONSTRUCTION (D-17): only calibrated, non-general audiences carry a
 * `creator_persona`. General / no-audience / legacy rows → cp is null → returns the inputs
 * unchanged → byte-identical generation (regression gate preserved). No ENGINE_VERSION change.
 *
 * Pure function. No I/O. Deterministic.
 */

import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Audience } from "./audience-types";

export interface CreatorPersonaApplication {
  /** profileRow with writing_voice_sample backfilled from creator_persona when the profile voice is absent. */
  profileRow: ProfileRow | null;
  /** One-line creator steer to append to generation overrides, or undefined (no-op). */
  creatorSteer: string | undefined;
}

/**
 * Apply the active audience's creator_persona to the generation inputs (step-7, fallback mode).
 *
 * @param profileRow Creator profile (null = cold-start). May be voice-backfilled in the result.
 * @param audience   Active audience (null / General / no creator_persona → inputs returned unchanged).
 * @returns { profileRow, creatorSteer } — pass profileRow to assembleBundle; fold creatorSteer into overrides.
 */
export function applyCreatorPersona(
  profileRow: ProfileRow | null,
  audience: Audience | null,
): CreatorPersonaApplication {
  // Only calibrated, non-general audiences carry a creator_persona (gate-safe by construction).
  const cp =
    audience && !audience.is_general && audience.creator_persona
      ? audience.creator_persona
      : null;
  if (!cp) return { profileRow, creatorSteer: undefined };

  // (1) VOICE fallback — manual profile voice wins; auto-derived sample fills only when absent.
  const hasProfileVoice = Boolean(profileRow?.writing_voice_sample?.trim());
  const sample = cp.writing_style_sample?.trim();
  const effectiveProfileRow: ProfileRow | null =
    !hasProfileVoice && sample
      ? { ...(profileRow ?? {}), writing_voice_sample: sample }
      : profileRow;

  // (2) STEER — fold who's writing (content_description leads, then context). Fenced as
  //     USER_CONTENT downstream by the assembler, so it is safe to treat as opaque text.
  const steerParts = [cp.content_description?.trim(), cp.context?.trim()].filter(Boolean);
  const creatorSteer = steerParts.length > 0 ? `Creator — ${steerParts.join(". ")}` : undefined;

  return { profileRow: effectiveProfileRow, creatorSteer };
}
