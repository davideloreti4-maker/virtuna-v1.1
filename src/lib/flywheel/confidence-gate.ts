/**
 * Phase 10 Plan 01 — Confidence gate (FLYWHEEL-04).
 *
 * Pure aggregate over a creator's last K reconciliation rows for ONE audience. The gate
 * is the noise-resistance guarantee of D-05: a single viral/flop post can never yank the
 * weights — a recalibration is PROPOSED only when the SAME calibration disposition
 * diverges in the SAME direction, consistently, across >= N_MIN posts (Pitfall 4).
 *
 * Per CALIBRATION disposition d, over the rows where d had a realized signal:
 *   n[d]     = count of posts with a divergence signal for d            (presence)
 *   mean[d]  = (1/n[d]) Σ div_post[d]                                   (signed mean)
 *   agree[d] = fraction of posts with sign(div) == sign(mean[d])        (consistency)
 *
 * PROPOSE for d iff:
 *   n[d] >= N_MIN  AND  |mean[d]| >= DIV_THRESHOLD  AND  agree[d] >= AGREE_THRESHOLD
 *   AND d is a CALIBRATION disposition (craft dispositions can NEVER propose — D-03).
 *
 * Determinism guarantee: no Date.now, no Math.random, no I/O. The only non-deterministic
 * act in the whole flywheel is the human confirm downstream. General audiences are excluded
 * at the call site (Plan 05), so the regression gate is satisfied by construction.
 */

import type { Disposition } from "@/lib/audience/audience-types";
import { CALIBRATION_DISPOSITIONS } from "./reconcile";

// ─── Gate constants ([ASSUMED] A2 — owner-tunable; chosen for noise-resistance) ──

/** Minimum posts with a realized signal for that disposition before a proposal is possible. */
export const N_MIN = 5;

/** |mean[d]| must exceed 12 percentage-points of share to matter. */
export const DIV_THRESHOLD = 0.12;

/** >= 70% of posts must diverge in the SAME direction (directional consistency). */
export const AGREE_THRESHOLD = 0.7;

// ─── Types ───────────────────────────────────────────────────────────────────────

/**
 * One reconciliation row's contribution to the gate: the per-disposition divergence
 * vector (realized − predicted). A disposition absent from the vector had no signal
 * for that post and is excluded from its aggregate (presence-aware).
 */
export interface ReconciliationRow {
  divergenceVector: Partial<Record<Disposition, number>>;
}

/** A single proposed recalibration for one calibration disposition. */
export interface Proposal {
  disposition: Disposition;
  /** signed mean divergence — its sign drives the bounded nudge direction. */
  mean: number;
  /** number of posts with a realized signal for this disposition. */
  n: number;
  /** directional-consistency fraction (0..1). */
  agree: number;
}

/** The set of proposals that passed the gate (non-empty by construction when returned). */
export interface ProposalSet {
  proposals: Proposal[];
}

// ─── Gate ─────────────────────────────────────────────────────────────────────────

/** sign helper: 0 maps to 0 so a zero divergence is neither up nor down. */
function sign(x: number): -1 | 0 | 1 {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/**
 * Evaluate the confidence gate over K reconciliation rows for one audience.
 * Returns a ProposalSet (one entry per passing calibration disposition) or null if
 * nothing passes. Pure + deterministic.
 */
export function evaluateGate(rows: ReconciliationRow[]): ProposalSet | null {
  const proposals: Proposal[] = [];

  for (const d of CALIBRATION_DISPOSITIONS) {
    // Collect this disposition's divergences across rows where it had a signal.
    const divs: number[] = [];
    for (const row of rows) {
      const v = row.divergenceVector[d];
      if (v == null) continue; // no realized signal for d on this post — exclude
      divs.push(v);
    }

    const n = divs.length;
    if (n < N_MIN) continue;

    const mean = divs.reduce((a, b) => a + b, 0) / n;
    if (Math.abs(mean) < DIV_THRESHOLD) continue;

    const meanSign = sign(mean);
    const agreeing = divs.filter((v) => sign(v) === meanSign).length;
    const agree = agreeing / n;
    if (agree < AGREE_THRESHOLD) continue;

    proposals.push({ disposition: d, mean, n, agree });
  }

  return proposals.length > 0 ? { proposals } : null;
}
