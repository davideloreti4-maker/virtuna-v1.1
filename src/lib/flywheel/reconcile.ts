/**
 * Phase 10 Plan 01 — Reconciliation + calibration-vs-craft classifier (FLYWHEEL-03).
 *
 * Pure, deterministic. Compares a pinned PREDICTED disposition vector against the
 * REALIZED one and produces (a) a per-disposition divergence vector and (b) a
 * classification routing each diverging disposition to calibration OR craft.
 *
 * The classification is the mechanical basis of D-03 — the protection that a content
 * flop (craft) never corrupts the audience object (calibration):
 *
 *   [ASSUMED] A1 (single highest-value owner-confirm — 10-RESEARCH.md §1/§3):
 *     CALIBRATION dispositions = collector / connector / converter  (the "WHO" —
 *       which segment actually showed up vs. the modeled mix). Persistent divergence
 *       here = the audience MIX is wrong → may PROPOSE a PersonaWeights override.
 *     CRAFT dispositions = scanner / lurker / skeptic  (the "HOW-WELL" — whether the
 *       content delivered to whoever showed up: retention, hook survival). Divergence
 *       here = craft → routed to Account Read guidance, NEVER touches the model.
 *
 *   Grounded in the registry semantics: collector/connector/converter are defined by
 *   WHAT ACTION the viewer takes (save/share/buy) = identity of the present segment;
 *   scanner/lurker/skeptic are defined by HOW FAR they watch = a verdict on delivery.
 *
 * Both-diverge case (tie-break, RESEARCH §3): a post may carry BOTH a calibration AND a
 * craft divergence — both are logged, not mutually exclusive. The calibration side feeds
 * the confidence gate; the craft side feeds Account Read.
 *
 * Determinism guarantee: no Date.now, no Math.random, no I/O. Divergence is computed only
 * over the intersection of dispositions present in BOTH vectors (a disposition with no
 * realized signal is excluded — carries the honesty spine from realized-signature.ts).
 */

import type { Disposition } from "@/lib/audience/audience-types";

/**
 * [ASSUMED] A1 — the "WHO" dispositions. Divergence here = the audience MIX is off →
 * calibration error → may feed a PersonaWeights override (confidence-gate.ts).
 */
export const CALIBRATION_DISPOSITIONS: readonly Disposition[] = [
  "collector",
  "connector",
  "converter",
] as const;

/**
 * [ASSUMED] A1 — the "HOW-WELL" dispositions. Divergence here = a craft problem →
 * Account Read guidance only; NEVER reaches the recalibration path (D-03 protection).
 */
export const CRAFT_DISPOSITIONS: readonly Disposition[] = [
  "scanner",
  "lurker",
  "skeptic",
] as const;

/** How a diverging disposition is routed. */
export type DivergenceClass = "calibration" | "craft";

/** Result of reconciling a predicted vector against a realized one. */
export interface Reconciliation {
  /** realized[d] − predicted[d], over dispositions present in BOTH vectors. */
  divergenceVector: Partial<Record<Disposition, number>>;
  /** per-diverging-disposition routing (calibration vs craft), per A1. */
  classification: Partial<Record<Disposition, DivergenceClass>>;
}

/** True if a disposition is a calibration ("WHO") disposition per the A1 split. */
function classify(d: Disposition): DivergenceClass {
  return (CALIBRATION_DISPOSITIONS as readonly Disposition[]).includes(d)
    ? "calibration"
    : "craft";
}

/**
 * Reconcile a predicted disposition vector against a realized one.
 *
 * - div[d] = realized[d] − predicted[d], computed ONLY over dispositions present in
 *   BOTH vectors (a disposition with no realized signal is excluded — honesty spine).
 * - Each disposition appearing in the divergence vector is classified per A1.
 *
 * Pure + deterministic.
 */
export function reconcile(
  predicted: Partial<Record<Disposition, number>>,
  realized: Partial<Record<Disposition, number>>,
): Reconciliation {
  const divergenceVector: Partial<Record<Disposition, number>> = {};
  const classification: Partial<Record<Disposition, DivergenceClass>> = {};

  for (const key of Object.keys(predicted) as Disposition[]) {
    const p = predicted[key];
    const r = realized[key];
    // Intersection only: skip a disposition absent from the realized vector.
    if (p == null || r == null) continue;
    divergenceVector[key] = r - p;
    classification[key] = classify(key);
  }

  return { divergenceVector, classification };
}
