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
 * ISOLATION: imports only the niche resolver + the NichePanel type + the domain types.
 */

import { resolveNicheKey } from "@/lib/engine/wave3/niche-resolver";
import type { NichePanel } from "@/lib/engine/flash/run-flash-text-mode";
import type { Audience } from "@/lib/audience/audience-types";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

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
  const audienceRepaint: Record<string, string> | undefined =
    audience && !audience.is_general && audience.personas && audience.personas.length > 0
      ? Object.fromEntries(audience.personas.map((p) => [p.archetype, p.repaint]))
      : undefined;

  return { panel, audienceRepaint };
}
