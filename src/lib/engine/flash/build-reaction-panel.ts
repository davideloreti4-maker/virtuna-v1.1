/**
 * build-reaction-panel.ts — shared niche-panel + audience-repaint construction (Plan 13-01, Task 1).
 *
 * buildReactionPanel(profileRow, audience) → { panel, audienceRepaint }
 *
 * WHY THIS EXISTS (RESEARCH Open Q1 + Pitfall 2 — the moat-credibility fix):
 *   ideas-runner.ts (L284-300) and hooks-runner.ts (L313-326) each built the Flash niche panel
 *   + audience repaint INLINE, byte-for-byte identically, right before their `runFlashTextMode`
 *   call. Phase 13's type-to-room reaction route (POST /api/tools/react) must fire the SAME
 *   discriminating reaction — if it hand-rolls a generic panel instead, every typed thought comes
 *   back "all Mixed" (niche-blind), and the moat reads as fake (Pitfall 2). Lifting the construction
 *   into one helper guarantees all three call sites discriminate by niche identically.
 *
 * BYTE-IDENTICAL CONTRACT: this helper reproduces the runners' inline logic EXACTLY so refactoring
 *   them onto it changes nothing the model sees:
 *     panel          = { niche: resolveNicheKey(profileRow?.niche_primary ?? null), contentType: null }
 *     audienceRepaint = (audience && !audience.is_general && audience.personas?.length)
 *                         ? Object.fromEntries(audience.personas.map((p) => [p.archetype, p.repaint]))
 *                         : undefined
 *   When audienceRepaint is undefined the runner omits the arg to runFlashTextMode → byte-identical
 *   no-op (General / no-audience regression gate, D-17). No ENGINE_VERSION change — text path only.
 *
 * NICHE LAYER (D-02 / Pitfall 2): resolveNicheKey lives at the RUNNER layer (14-01). It normalizes
 *   free-text / sub-slug `niche_primary` to a top-level NICHE_INSTANTIATION key BEFORE the panel
 *   reaches Flash. It is NEVER called inside the shared engine `selectPersonaSlots` (which the SIM-1
 *   Max video path imports) — keeping the Max-path bytes untouched and ENGINE_VERSION at 3.19.0.
 *
 * SCOPE: resolveAudienceWeights is intentionally NOT included here — in the runners it is
 *   `void resolvedWeights` (dead-wired for the future Max path), not part of the Flash reaction path.
 *
 * ISOLATION: imports only the niche resolver, the archetype vocabulary, the NichePanel type +
 *   the domain types (plus logger/Sentry for the unbindable-archetype warning — see
 *   buildAudienceRepaint). No behaviour change to the prompt bytes.
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { resolveNicheKey } from "@/lib/engine/wave3/niche-resolver";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import type { NichePanel } from "@/lib/engine/flash/run-flash-text-mode";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

const log = createLogger({ module: "engine.flash.reaction-panel" });

/** The 10 slugs the engine's slots are keyed by — the only keys a repaint can bind to. */
const ARCHETYPE_SET = new Set<string>(ARCHETYPES);

// ─── Return shape ──────────────────────────────────────────────────────────────

export interface ReactionPanel {
  /** Niche panel fed to runFlashTextMode (niche resolved at the runner layer; contentType always null). */
  panel: NichePanel;
  /**
   * Per-audience archetype → repaint map (deterministic, stored at calibration — Pitfall 2).
   * undefined for General / no-audience / empty-personas → runFlashTextMode omits the arg
   * → byte-identical no-op (regression gate preserved, D-17).
   */
  audienceRepaint: Record<string, string> | undefined;
}

// ─── buildAudienceRepaint ────────────────────────────────────────────────────────

/**
 * Project an Audience into its archetype-slug → repaint map (the deterministic,
 * calibration-stored reaction text — Pitfall 2, D-17 cache safety).
 *
 * THE SINGLE SOURCE OF TRUTH for the repaint projection: both the text SIM (via
 * buildReactionPanel below) AND the video Read fold (R1′b — pipeline.ts threads this
 * into runFold) build their per-archetype repaint from THIS function, so the two skills
 * simulate the same calibrated audience IDENTICALLY (the moat-credibility guarantee —
 * the whole reason this helper was lifted out of the runners' inline copies).
 *
 * @param audience Active audience (null / is_general / empty personas → undefined).
 * @returns Record<archetype, repaint> for a calibrated audience, else undefined →
 *          every consumer omits the arg → byte-identical no-op (General regression gate, D-17).
 */
export function buildAudienceRepaint(
  audience: Audience | null,
): Record<string, string> | undefined {
  if (!(audience && !audience.is_general && audience.personas && audience.personas.length > 0)) {
    return undefined;
  }

  // A persona whose archetype is outside the 10-slug vocabulary matches NO engine slot in ANY
  // niche (the prompt builders look this map up BY SLOT archetype), so its repaint reaches the
  // model never. Pre-MODE-01 that was invisible: the key simply never hit, the slot fell back to
  // its stock text, and the run looked healthy. Say it out loud instead — a calibrated audience
  // quietly losing a slice of its own weight is the exact class of bug that let the Read compare
  // General to General for its entire life. The write boundary now rejects these
  // (CalibratedPersonaSchema), so this fires only for rows written before it, or straight to the DB.
  const unbindable = audience.personas.filter((p) => !ARCHETYPE_SET.has(p.archetype));
  if (unbindable.length > 0) {
    const lostShare = unbindable.reduce((s, p) => s + (p.share ?? 0), 0);
    log.warn("audience personas cannot bind to any engine slot — their repaint is ignored", {
      audience_id: audience.id,
      audience_name: audience.name,
      unbindable_archetypes: unbindable.map((p) => p.archetype),
      lost_share: Number(lostShare.toFixed(3)),
    });
    Sentry.captureMessage("audience persona archetype does not bind to an engine slot", {
      level: "warning",
      extra: {
        audience_id: audience.id,
        unbindable_archetypes: unbindable.map((p) => p.archetype),
        lost_share: Number(lostShare.toFixed(3)),
      },
    });
  }

  // The unbindable entries are still projected: they cannot collide with a slot key, so the
  // prompt bytes are identical either way. Filtering them would only hide them from a debugger.
  return Object.fromEntries(audience.personas.map((p) => [p.archetype, p.repaint]));
}

// ─── buildReactionPanel ─────────────────────────────────────────────────────────

/**
 * Build the Flash niche panel + audience-repaint map for a text-mode reaction.
 *
 * Lifts the EXACT inline construction shared by ideas-runner / hooks-runner so the
 * type-to-room reaction route reuses the same niche-discriminating path (RESEARCH Open Q1).
 *
 * @param profileRow Creator profile (null = cold-start; niche resolves to null → honest generic).
 * @param audience   Active audience (null / is_general / empty personas → no repaint, no-op).
 * @returns { panel, audienceRepaint } — pass both straight into runFlashTextMode.
 */
export function buildReactionPanel(
  profileRow: ProfileRow | null,
  audience: Audience | null,
): ReactionPanel {
  // Phase 14 (14-01): resolve free-text / sub-slug niche_primary to a top-level
  // NICHE_INSTANTIATION key BEFORE building the panel — otherwise the exact-slug match
  // in selectPersonaSlots silently falls back to generic ("all Mixed").
  const niche = resolveNicheKey(profileRow?.niche_primary ?? null);
  const panel: NichePanel = { niche, contentType: null };

  // archetype-slug → repaint map (undefined for General/no audience → byte-identical Flash no-op).
  // The repaint is stored at calibration (not generated per-request — Pitfall 2).
  // Shared projection (R1′b) so the fold simulates the same audience identically.
  return { panel, audienceRepaint: buildAudienceRepaint(audience) };
}
