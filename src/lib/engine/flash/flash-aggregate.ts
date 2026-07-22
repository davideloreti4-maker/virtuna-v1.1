/**
 * SIM-1 Flash — Pure deterministic aggregate (Plan 01-03 Task 1).
 *
 * aggregateFlash: FlashPersona[] → {band, fraction}
 *
 * D-02/D-11 honesty spine:
 *   - band: qualitative label only ("Strong" | "Mixed" | "Weak") — NO 0-100 number.
 *   - fraction: audience-fraction string ("N/10 stop") — NO percentile, views, or engagement.
 *
 * Thresholds are ENGINE-01 calibration constants — named and documented as tunable
 * per the inline-scoring spec (winning framing calibrated inside ENGINE-01).
 *
 * Isolation: imports ONLY from flash-schema.ts. No engine (pipeline/aggregator/version/wave3/fold).
 */

import type { FlashPersona } from "./flash-schema";

// ─── D-06 calibration thresholds (niche-aware, 10-persona panel) ─────────────
//
// Empirically calibrated for the niche-aware 10-persona panel introduced in D-05:
//   FYP allocation (6 slots): tough_crowd × ≥2, lurker, high_engager, saver, sharer,
//     purposeful_viewer — tough_crowd-first weighting (~30%) via slot repetition.
//   niche_deep (2 slots): niche_deep_buyer, niche_deep_scout.
//   loyalist (1 slot): loyalist.
//   cross_niche (1 slot): cross_niche_curiosity.
//
// Calibration rationale for STRONG_THRESHOLD = 6, MIXED_THRESHOLD = 3:
//
//   OBVIOUS SLOP (generic hook, no mechanism, no niche relevance):
//     - tough_crowd, niche_deep_scout, niche_deep_buyer, purposeful_viewer → scroll.
//     - sharer, cross_niche_curiosity → scroll.
//     - At most: loyalist + lurker/high_engager (passive or reply-bait) → 0–2 stops.
//     - Expected stop-count: 0–2 → Weak (< MIXED_THRESHOLD = 3). ✓
//
//   KNOWN-GREAT (specific mechanism, niche-true hook, named outcome):
//     - saver, purposeful_viewer, niche_deep_buyer, niche_deep_scout → stop.
//     - loyalist, high_engager, lurker → stop.
//     - Only sharer + cross_niche_curiosity + maybe tough_crowd → scroll.
//     - Expected stop-count: 7–8 → Strong (≥ STRONG_THRESHOLD = 6). ✓
//
//   Discrimination gap: ≥ 5 stops separates slop (≤ 2) from known-great (≥ 7).
//   Gate floor (Plan 03 handoff): band !== "Weak" (i.e., stops ≥ MIXED_THRESHOLD = 3).
//   Drop any idea whose seed hook's Flash stop-count is < 3 (Weak band).
//
// The niche-aware panel (D-05) is what creates real discrimination — without it, the
// flat generic prompts produce ~5–7 stops on everything (the "all Mixed" failure mode).
//
// Phase 14 (14-01 / Pitfall 3) correction to the earlier "no recalibration needed" claim:
//   The niche panel only DISCRIMINATES once `resolveNicheKey` (wave3/niche-resolver.ts) lands
//   at the RUNNER layer. Before that, production `niche_primary` is free text / a sub-slug that
//   fails selectPersonaSlots' exact-slug match and silently falls back to generic — so the panel
//   was niche-blind in production and the gate could not say no. With the resolver wired (14-01
//   Task 1), the panel receives a real top-level instantiation key and the slop/strong margin
//   re-appears. The LIVE half of slop-vs-strong.test.ts now routes its hooks through
//   `resolveNicheKey` to exercise the production resolution path (not a hand-built panel).
//
// KCQ-05 gate (formalized 14-01): the gate floor is `band !== "Weak"` — i.e. an item PASSES iff
//   stops ≥ MIXED_THRESHOLD. STRONG_THRESHOLD/MIXED_THRESHOLD are the named gate contract; the
//   test asserts their exact values so any future drift fails loud. Values stay 6/3 — the pure
//   half holds the slop<MIXED / strong≥STRONG margin, and the LIVE half (DASHSCOPE_API_KEY-gated)
//   re-validates on the resolved-niche path. Adjust ONLY in lockstep with the test assertions.

/** Minimum stop-count for "Strong" band (inclusive). D-06 calibrated for niche-aware 10-persona panel. */
export const STRONG_THRESHOLD = 6;

/** Minimum stop-count for "Mixed" band (inclusive, below STRONG_THRESHOLD). D-06 gate floor: ≥3 passes, <3 = Weak = drop. */
export const MIXED_THRESHOLD = 3;

// ─── A1 weighted-band thresholds (calibrated-audience path) ──────────────────────
//
// When an audience's persona_weights are supplied, the band is computed from a WEIGHTED
// stop-MASS fraction (Σ weight of stop-personas / Σ weight of all personas), not a flat
// stop-count. The fractions mirror the flat thresholds exactly: 6/10 = 0.6, 3/10 = 0.3.
// With EQUAL per-persona weight (every slot present, populations balanced) the weighted
// fraction collapses to stop-count/10 → identical bands to the flat path. The General /
// no-audience path supplies NO weighting → the flat STRONG/MIXED_THRESHOLD path runs →
// byte-identical to today (ENGINE_VERSION 3.19.0 regression gate).

/** Weighted-mass fraction for "Strong" (inclusive). Mirrors STRONG_THRESHOLD 6/10. */
export const WEIGHTED_STRONG_FRACTION = 0.6;

/** Weighted-mass fraction for "Mixed" (inclusive). Mirrors MIXED_THRESHOLD 3/10. */
export const WEIGHTED_MIXED_FRACTION = 0.3;

/**
 * A1: optional per-persona weighting injected by the runner for CALIBRATED audiences.
 *
 * `slotOf(archetype)` returns the weight-bucket key for an archetype (or null if the
 * archetype is unknown — synthetic/test panels). `weights` maps each bucket key to its
 * audience-share weight. flash-aggregate stays leaf-isolated: the registry archetype→slot
 * map and the audience weight resolution both live OUTSIDE this module (see
 * `flash/persona-weighting.ts`); only this minimal shape crosses the boundary.
 */
export interface FlashWeighting {
  weights: Record<string, number>;
  slotOf: (archetype: string) => string | null;
}

// ─── Band type ─────────────────────────────────────────────────────────────────

export type FlashBand = "Strong" | "Mixed" | "Weak";

// ─── Aggregate output shape ───────────────────────────────────────────────────
// D-11: exactly two fields — band + fraction. NO score, percentile, views, engagement, reach.

export interface FlashAggregate {
  band: FlashBand;
  fraction: string; // e.g. "6/10 stop"
}

// ─── Pure aggregator ───────────────────────────────────────────────────────────
// Pure deterministic: same input → same output. No side effects, no randomness.
// Compatible with BandBlock.props (band + fraction fields mirror BandBlockSchema).

/**
 * Roll 10 per-persona stop/scroll verdicts into a qualitative band + audience-fraction.
 *
 * @param personas - Array of FlashPersona entries (typically exactly 10, from FlashResultSchema).
 * @returns { band: "Strong" | "Mixed" | "Weak", fraction: "N/10 stop" }
 *
 * D-11: the return type contains NO numeric score, percentile, view count, or engagement
 * field — qualitative band + fraction ONLY.
 */
export function aggregateFlash(
  personas: FlashPersona[],
  weighting?: FlashWeighting,
): FlashAggregate {
  const stops = personas.filter((p) => p.verdict === "stop").length;
  const total = personas.length;

  // `fraction` is ALWAYS the honest raw persona count ("N/10 stop") — the weighting
  // affects only the qualitative band (the gate), never the displayed count. This keeps
  // the fraction string byte-identical whether or not an audience is weighting the band.
  const fraction = `${stops}/${total} stop`;

  // A1 weighted-band path (calibrated audience). Per-persona weight = slotWeight / (number
  // of personas in that slot in THIS panel) — so a slot's total influence equals its
  // audience-share weight regardless of how many reactor slots represent it. Band uses the
  // weighted stop-MASS fraction. Falls back to the flat path when no archetype resolves to a
  // weight (totalMass === 0) — e.g. synthetic test panels — so it can never divide by zero.
  if (weighting) {
    const slotPop: Record<string, number> = {};
    for (const p of personas) {
      const key = weighting.slotOf(p.archetype);
      if (key != null) slotPop[key] = (slotPop[key] ?? 0) + 1;
    }

    let stopMass = 0;
    let totalMass = 0;
    for (const p of personas) {
      const key = weighting.slotOf(p.archetype);
      if (key == null) continue;
      const pop = slotPop[key]!;
      if (pop === 0) continue;
      const w = (weighting.weights[key] ?? 0) / pop;
      totalMass += w;
      if (p.verdict === "stop") stopMass += w;
    }

    if (totalMass > 0) {
      const frac = stopMass / totalMass;
      const band: FlashBand =
        frac >= WEIGHTED_STRONG_FRACTION ? "Strong"
        : frac >= WEIGHTED_MIXED_FRACTION ? "Mixed"
        : "Weak";
      return { band, fraction };
    }
    // totalMass === 0 → no archetype mapped to a weight → fall through to flat.
  }

  const band: FlashBand =
    stops >= STRONG_THRESHOLD ? "Strong"
    : stops >= MIXED_THRESHOLD ? "Mixed"
    : "Weak";

  return { band, fraction };
}

// ─── Projection band (generation-time estimate — NO SIM panel) ───────────────────
/**
 * Map a raw would-stop count (0–total, total assumed 10) to the qualitative band using the
 * SAME calibrated thresholds as aggregateFlash's flat path.
 *
 * WHY IT EXISTS: the single-call skill runners (the new Qwen call system, 2026-07-22) collapse
 * generation + the persona SIM into ONE generation call. That call self-estimates `personaStops`
 * (/10) instead of running the 10-persona Flash panel — a PROJECTION, not a measurement. Deriving
 * the projected band here (rather than re-implementing the 6/3 cut in each runner) keeps the
 * projected band and any later MEASURED band (aggregateFlash) on ONE calibration SSOT: if the
 * thresholds ever move, the estimate and the verdict move together. Pure + deterministic.
 *
 * Honesty: this is the writer's own guess at its hook's stopping power — the card must label it a
 * projection (provenance:"projected"), never a measured room reaction.
 */
export function bandFromStops(stops: number, total = 10): FlashBand {
  const clamped = Number.isFinite(stops) ? Math.max(0, Math.min(total, Math.round(stops))) : 0;
  return clamped >= STRONG_THRESHOLD
    ? "Strong"
    : clamped >= MIXED_THRESHOLD
      ? "Mixed"
      : "Weak";
}
