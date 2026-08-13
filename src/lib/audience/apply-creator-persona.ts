/**
 * apply-creator-persona.ts — §P step-7 generation wiring (creator steer).
 *
 * applyCreatorPersona(profileRow, audience) → { creatorSteer }
 *
 * Wires the PER-AUDIENCE, auto-derived `creator_persona` (frozen at calibration from the
 * real scrape + transcripts + omni-flash watchNotes) into the generation path so outputs
 * sound like the creator on THIS audience's account.
 *
 *   STEER: `content_description` + `context` (audience · voice · formats · expertise · AVOID)
 *   folded into a one-line creator steer the runner appends to assembleBundle.overrides.
 *
 * ─── 🔴 THE VOICE HALF WAS REMOVED 2026-08-12, AND IT WAS THE EXEMPLAR-COPYING DEFECT ────────
 *
 * This function used to also backfill `profileRow.writing_voice_sample` from
 * `creator_persona.writing_style_sample`, so the voice role would render it as "write in this
 * voice". `enrich-signature.ts:207` specifies that field as "<verbatim transcript/caption of the
 * top video>" — a single quoted line. A single line cannot carry style, so CONTENT is what the
 * generator copied.
 *
 * Measured — 3 arms × 6 seeds, real loop, one field different (`.scratch/probe-voice-is-the-source.ts`):
 *
 *     prod       "Btw this dance took me hours to learn"   13/30 cards about a dance · 43%
 *     voiceless  the same audience, sample blanked          0/30 · 0%
 *     neutral    a 17-word line in the creator's register   0/30 dance — but 13% of cards WERE
 *                                                           the sample, reproduced verbatim
 *
 * p ≈ 2.3e-5. The role leaked at every sample length; only the direction changed. A short caption
 * donated its TOPIC while sharing none of its words (which is why an echo/n-gram guard on the
 * OUTPUT cannot see this — it would have caught 0 of the 13). The fence has to be on the input,
 * and this is it.
 *
 * ⚠️ It reads as a corpus problem and it is not. The retrieved exemplars for that subject contain
 * zero mentions of a dance (`.scratch/probe-corpus-block.ts`); so does the profile. This one field
 * was the only source. `docs/CONTEXT-AUDIT-2026-08-10.md` finding 3 attributes it to the corpus and
 * is wrong; its finding-4 control arm, labelled "no voice", was never voiceless — the backfill
 * below always ran, because `creator_profiles.writing_voice_sample` does not exist as a column, so
 * `hasProfileVoice` was false every time.
 *
 * What survives is the STEER, and it is the better anchor: `context` already DESCRIBES the voice
 * ("hyper-energetic, direct, and inclusive ('we', 'boys')") instead of quoting a video. The
 * voiceless arm keeps it and produced the best cards of the three.
 *
 * Design: `docs/superpowers/specs/2026-08-12-exemplar-fence-design.md`.
 * ⚠️ Do NOT reintroduce a verbatim sample here, and do not ship the `writing_voice_sample`
 * migration as a quality win — it trades dance hooks for parroted hooks.
 *
 * GATE-SAFE BY CONSTRUCTION (D-17): only calibrated, non-general audiences carry a
 * `creator_persona`. General / no-audience / legacy rows → cp is null → no steer → byte-identical
 * generation (regression gate preserved). No ENGINE_VERSION change.
 *
 * Pure function. No I/O. Deterministic.
 */

import type { ProfileRow } from "@/lib/kc/profile-role-map";
import type { Audience } from "./audience-types";

export interface CreatorPersonaApplication {
  /** One-line creator steer to append to generation overrides, or undefined (no-op). */
  creatorSteer: string | undefined;
}

/**
 * Apply the active audience's creator_persona to the generation inputs (step-7).
 *
 * @param profileRow Creator profile (null = cold-start). Read-only — never modified, never returned.
 * @param audience   Active audience (null / General / no creator_persona → no steer).
 * @returns { creatorSteer } — fold into assembleBundle.overrides. Pass the caller's own
 *          `profileRow` to assembleBundle; this function no longer designates one, deliberately
 *          (a returned row is what carried the voice, and a vestigial pass-through would invite it
 *          back).
 */
export function applyCreatorPersona(
  profileRow: ProfileRow | null,
  audience: Audience | null,
): CreatorPersonaApplication {
  void profileRow;
  // Only calibrated, non-general audiences carry a creator_persona (gate-safe by construction).
  const cp =
    audience && !audience.is_general && audience.creator_persona
      ? audience.creator_persona
      : null;
  if (!cp) return { creatorSteer: undefined };

  // STEER — fold who's writing (content_description leads, then context). Fenced as
  // USER_CONTENT downstream by the assembler, so it is safe to treat as opaque text.
  const steerParts = [cp.content_description?.trim(), cp.context?.trim()].filter(Boolean);
  const creatorSteer = steerParts.length > 0 ? `Creator — ${steerParts.join(". ")}` : undefined;

  return { creatorSteer };
}
