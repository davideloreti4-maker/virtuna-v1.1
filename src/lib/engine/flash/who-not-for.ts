/**
 * deriveWhoNotFor — the cheap "Scrolls past: {segment}" presentation piece (D-10).
 *
 * Plan 08-05 / READ-03. Pure derivation from the already-emitted CalibratedPersona
 * data — NO model call, NO fabrication risk. The who-it's-NOT-for line is kept in
 * P8 (D-04) precisely BECAUSE the data already exists: the calibrated personas
 * carry an archetype + disposition, and the COLD-temperature personas (looked up
 * via TEMPERATURE_DISPOSITION) name the segment that scrolls past.
 *
 * CR-01: selection is by TEMPERATURE (cold), NOT by disposition string. Disposition
 * is ambiguous — `scanner` is warm for purposeful_viewer (engaged) and cold for
 * cross_niche_curiosity (drive-by). Keying off disposition mislabeled the warm
 * segment as "scrolls past", an honesty-spine violation.
 *
 * Honesty spine: this is presentation arithmetic over real persona dispositions,
 * not a generated judgment. An all-hot panel has no honest scrolls-past segment,
 * so the function returns "" (the renderer then shows no who-not-for line).
 *
 * Isolation: imports ONLY the audience domain types. No engine pipeline imports.
 */

import type { CalibratedPersona, Disposition } from "@/lib/audience/audience-types";
import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { TEMPERATURE_DISPOSITION } from "@/lib/audience/temperature-disposition";

// ─── Scroll-prone selection by TEMPERATURE, not disposition (D-10, CR-01) ────────
// Who-scrolls-past is a COLD-temperature property, NOT a disposition property.
// A disposition string alone is ambiguous: per TEMPERATURE_DISPOSITION, `scanner`
// is the disposition of BOTH `purposeful_viewer` (temperature WARM — engaged,
// high-intent) AND `cross_niche_curiosity` (temperature COLD — drive-by). Keying
// the scrolls-past set on disposition therefore mislabels the warm, engaged
// purposeful_viewer segment as "Scrolls past: Scanners" — an honesty-spine
// violation. The fix: select scroll-prone personas by looking up each persona's
// archetype temperature and keeping ONLY temperature === "cold".

// Creator-facing segment labels for each disposition (a cold persona surfaces under
// its disposition's label).
const SEGMENT_LABEL: Record<Disposition, string> = {
  scanner: "Scanners",
  skeptic: "Skeptics",
  collector: "Collectors",
  connector: "Connectors",
  converter: "Converters",
  lurker: "Lurkers",
};

/**
 * Stable label order — iterate dispositions in a canonical order so the joined
 * output is deterministic regardless of persona array order.
 */
const DISPOSITION_ORDER: readonly Disposition[] = [
  "skeptic",
  "lurker",
  "scanner",
  "collector",
  "connector",
  "converter",
];

/**
 * Derive the "Scrolls past: {segment}" label from the COLD-temperature personas.
 *
 * Selects every persona whose ARCHETYPE maps to temperature `cold` in the
 * TEMPERATURE_DISPOSITION lens (NOT by disposition string — disposition is
 * ambiguous, see CR-01), maps each cold persona's disposition to its creator-facing
 * segment label, and joins the distinct labels in canonical order. An all-hot/warm
 * panel (no cold personas) returns "" — there is no honest who-not-for to show.
 *
 * Honesty spine: a warm `purposeful_viewer` (disposition `scanner`) is NEVER
 * surfaced here — it is an engaged segment, not a scrolls-past one.
 *
 * Pure + deterministic: same input → same output. No model call (D-10).
 *
 * @param personas - The audience's calibrated personas (carry archetype + disposition).
 * @returns A segment label string (e.g. "Skeptics, Lurkers"), or "" when none.
 */
export function deriveWhoNotFor(personas: CalibratedPersona[]): string {
  // Distinct dispositions of the COLD-temperature personas present in the panel.
  const present = new Set<Disposition>();
  for (const persona of personas) {
    // Look up temperature by archetype — only cold personas scroll past.
    const temperature = TEMPERATURE_DISPOSITION[persona.archetype as Archetype]?.temperature;
    if (temperature === "cold") {
      present.add(persona.disposition);
    }
  }

  if (present.size === 0) return "";

  // Stable order: iterate the canonical disposition order so output is deterministic
  // regardless of persona array order.
  const labels: string[] = [];
  for (const disposition of DISPOSITION_ORDER) {
    if (present.has(disposition)) labels.push(SEGMENT_LABEL[disposition]);
  }

  return labels.join(", ");
}
