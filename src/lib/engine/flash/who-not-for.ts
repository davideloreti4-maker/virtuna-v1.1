/**
 * deriveWhoNotFor — the cheap "Scrolls past: {segment}" presentation piece (D-10).
 *
 * Plan 08-05 / READ-03. Pure derivation from the already-emitted CalibratedPersona
 * dispositions — NO model call, NO fabrication risk. The who-it's-NOT-for line is
 * kept in P8 (D-04) precisely BECAUSE the data already exists: the calibrated
 * personas carry a disposition, and the cold/scroll-prone dispositions name the
 * segment that scrolls past.
 *
 * Honesty spine: this is presentation arithmetic over real persona dispositions,
 * not a generated judgment. An all-hot panel has no honest scrolls-past segment,
 * so the function returns "" (the renderer then shows no who-not-for line).
 *
 * Isolation: imports ONLY the audience domain types. No engine pipeline imports.
 */

import type { CalibratedPersona, Disposition } from "@/lib/audience/audience-types";

// ─── Scroll-prone disposition set (D-10) ────────────────────────────────────────
// The "cold" / low-engagement dispositions name who scrolls past. Mirrors the
// TEMPERATURE_DISPOSITION table: skeptic/lurker/scanner are the cold scroll-prone
// dispositions (tough_crowd, lurker, cross_niche_curiosity, niche_deep_scout,
// purposeful_viewer). The hot/warm engaging dispositions (converter, connector,
// collector) are NOT in the scrolls-past set.
const SCROLLS_PAST_DISPOSITIONS: ReadonlySet<Disposition> = new Set<Disposition>([
  "skeptic",
  "lurker",
  "scanner",
]);

// Creator-facing segment labels for each scroll-prone disposition.
const SEGMENT_LABEL: Record<Disposition, string> = {
  scanner: "Scanners",
  skeptic: "Skeptics",
  collector: "Collectors",
  connector: "Connectors",
  converter: "Converters",
  lurker: "Lurkers",
};

/**
 * Derive the "Scrolls past: {segment}" label from the lowest-disposition personas.
 *
 * Selects every persona whose disposition is in the cold scroll-prone set
 * (skeptic/lurker/scanner), maps those dispositions to their creator-facing
 * segment label, and joins the distinct labels. An all-hot/warm panel (no
 * scroll-prone dispositions) returns "" — there is no honest who-not-for to show.
 *
 * Pure + deterministic: same input → same output. No model call (D-10).
 *
 * @param personas - The audience's calibrated personas (carry disposition).
 * @returns A segment label string (e.g. "Skeptics, Lurkers"), or "" when none.
 */
export function deriveWhoNotFor(personas: CalibratedPersona[]): string {
  // Distinct scroll-prone dispositions present in the panel, in canonical order.
  const present = new Set<Disposition>();
  for (const persona of personas) {
    if (SCROLLS_PAST_DISPOSITIONS.has(persona.disposition)) {
      present.add(persona.disposition);
    }
  }

  if (present.size === 0) return "";

  // Stable order: iterate the canonical SCROLLS_PAST set so output is deterministic
  // regardless of persona array order.
  const labels: string[] = [];
  for (const disposition of SCROLLS_PAST_DISPOSITIONS) {
    if (present.has(disposition)) labels.push(SEGMENT_LABEL[disposition]);
  }

  return labels.join(", ");
}
