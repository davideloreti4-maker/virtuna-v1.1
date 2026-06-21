/**
 * Phase 10 Plan 01 — PREDICTED signature derivation (FLYWHEEL-02).
 *
 * Pure, deterministic. Collapses the SIM-1 Flash 10-archetype STOP/scroll verdicts
 * into a 6-disposition share vector via the P8-locked TEMPERATURE_DISPOSITION lens.
 *
 * This is the "predicted" half of the signatures-not-scores reconciliation (D-02):
 * the share of STOP verdicts attributable to each disposition is what the SIM forecast
 * for who would engage. It is pinned at SIM time (Pitfall 6) and reconciled later
 * against the realized signature (realized-signature.ts).
 *
 * Determinism guarantee: no Date.now, no Math.random, no I/O. Same FlashPersona[] →
 * byte-identical output. Cache-stable and regression-gate-free by construction.
 *
 * Reference impl: 10-RESEARCH.md §"Code Examples" + §"Disposition → Engagement-Proxy".
 */

import { TEMPERATURE_DISPOSITION } from "@/lib/audience/temperature-disposition";
import type { Disposition } from "@/lib/audience/audience-types";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";

/**
 * The 6 dispositions in canonical order (the P8-locked lens collapses 10 archetypes
 * onto these). Ordering is stable so serialized vectors stay byte-comparable.
 */
export const DISPOSITIONS: readonly Disposition[] = [
  "scanner",
  "skeptic",
  "collector",
  "connector",
  "converter",
  "lurker",
] as const;

/**
 * PREDICTED signature = share of STOP verdicts attributable to each disposition.
 *
 * - Iterate personas; ignore non-"stop" verdicts (only stops are an engagement signal).
 * - Map each stopping archetype through TEMPERATURE_DISPOSITION[archetype].disposition.
 * - An archetype absent from the lens is SKIPPED (honesty — never fabricate a disposition).
 * - Normalize counts to shares. totalStops === 0 → return the all-zero record (no division,
 *   no NaN). An empty array is therefore all-zero.
 *
 * Pure + deterministic: identical input → identical output.
 */
export function predictedSignature(
  personas: FlashPersona[],
): Record<Disposition, number> {
  const stopByDisp = Object.fromEntries(
    DISPOSITIONS.map((d) => [d, 0]),
  ) as Record<Disposition, number>;

  let totalStops = 0;
  for (const p of personas) {
    if (p.verdict !== "stop") continue;
    const arch = p.archetype as keyof typeof TEMPERATURE_DISPOSITION;
    const disp = TEMPERATURE_DISPOSITION[arch]?.disposition;
    if (!disp) continue; // unknown archetype — skip, never fabricate
    stopByDisp[disp] += 1;
    totalStops += 1;
  }

  if (totalStops === 0) return stopByDisp; // all-zero stays all-zero (no NaN)

  for (const d of DISPOSITIONS) {
    stopByDisp[d] = stopByDisp[d] / totalStops;
  }
  return stopByDisp;
}
