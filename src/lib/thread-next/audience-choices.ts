/**
 * audience-choices.ts — the rows of the new look's audience sheet (spec 2026-11-23 §4).
 *
 * Pure: no React.
 */

import { groupAudiences } from "@/components/audience/audience-display";
import type { Audience } from "@/lib/audience/audience-types";
import { platformLabel } from "@/lib/platforms";

export interface AudienceChoice { audience: Audience; line: string; selected: boolean }

/** What the audience is modeled on, said plainly under its name. */
function lineOf(a: Audience): string {
  if (a.source_account_id) return platformLabel(a.platform);
  if (a.is_general) return "General viewers";
  if (a.is_preset) return "Preset";
  return "Described by you";
}

/** The audiences the sheet lists (spec 2026-11-23 §4): the creator's own; General and the shipped
 *  presets only when the creator has none of their own, or for the one of them that is in use.
 *  No id selected means General is in use (the composer's `effectiveAudience`). Audiences in
 *  general mode (the authored panels) are never listed. */
export function audienceChoices(audiences: Audience[], selectedId: string | null): AudienceChoice[] {
  const { yours, baseline, templates } = groupAudiences(audiences);
  const inUse = (a: Audience) => (selectedId === null ? Boolean(a.is_general) : a.id === selectedId);
  const shipped = [...baseline, ...templates];
  const listed = yours.length === 0 ? shipped : shipped.filter(inUse);
  return [...yours, ...listed].map((audience) => ({ audience, line: lineOf(audience), selected: inUse(audience) }));
}

/** The platform a run simulates for, as the sheet's control names it. */
const LENS_NAME = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" } as const;

/** Under the sheet's platform control: an audience modeled on one platform, simulated for another,
 *  gives an estimate. Said plainly (the legacy note reads "calibrated on X, extrapolating"). */
export function estimateNote(modeledOn: keyof typeof LENS_NAME | null, lens: keyof typeof LENS_NAME): string | null {
  if (!modeledOn || modeledOn === lens) return null;
  return `Modeled on ${LENS_NAME[modeledOn]}. On ${LENS_NAME[lens]} this is an estimate.`;
}
