/**
 * Phase 10 Plan 06 — Propose → confirm → decline orchestration (FLYWHEEL-04/05).
 *
 * This is the regression-gate-critical seam of the flywheel. It wires Plan 01's PURE
 * core (evaluateGate + buildOverride) to the Plan 02 repos and the audience object:
 *
 *   getPendingProposals → listReconciliations → evaluateGate → PendingProposalSet | null
 *   confirmProposal     → buildOverride(current weights) → updateAudience(persona_weights)
 *                         → updateProposalState 'confirmed'
 *   declineProposal     → updateProposalState 'declined'  (never re-nag)
 *
 * HARD GUARD (D-03 / Pitfall 5 — the moat's safety): the ONLY legal recalibration target
 * is a NON-GENERAL, NON-PRESET user audience's `persona_weights` (the analysis_override
 * slot). General/preset audiences are refused — confirm throws, getPendingProposals returns
 * null without even querying. DEFAULT_PERSONA_WEIGHT_CONFIG / ARCHETYPE_DEFINITIONS /
 * ENGINE_VERSION are NEVER touched here (buildOverride only ever reads the passed-in
 * current audience weights).
 *
 * Proposal identity: there are NO separate proposal rows. A "proposal" is one gate-passing
 * CALIBRATION disposition; its `proposalId` IS the disposition string. confirm/decline
 * transition the contributing reconciliation rows (those carrying a divergence signal for
 * that disposition, still pending) to 'confirmed'/'declined' — so a declined proposal is
 * not re-surfaced (its rows are excluded from the next gate pass).
 *
 * Determinism note: the gate/delta math is Plan 01's pure code. This module orchestrates
 * I/O only. The only non-deterministic act in the whole flywheel is the human confirm.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Disposition } from "@/lib/audience/audience-types";
import { evaluateGate } from "./confidence-gate";
import type { Proposal } from "./confidence-gate";
import { buildOverride } from "./recalibration";
import {
  listReconciliations,
  updateProposalState,
} from "./reconciliation-repo";
import type { Reconciliation } from "./reconciliation-repo";
import { getAudience, updateAudience } from "@/lib/audience/audience-repo";

// ─── Domain shapes ─────────────────────────────────────────────────────────────

/** Human-readable nudge direction derived from the signed mean divergence. */
export type ProposalDirection = "up" | "down";

/**
 * A surfaced proposal — one gate-passing calibration disposition, enriched with the
 * human-readable direction the nudge will move it. `proposalId` IS the disposition
 * (no DB proposal row exists); the UI passes it back on confirm/decline.
 */
export interface PendingProposal extends Proposal {
  /** stable id the UI echoes back — equals `disposition`. */
  proposalId: string;
  /** human-readable direction (sign of mean) for the nudge copy. */
  direction: ProposalDirection;
}

export interface PendingProposalSet {
  proposals: PendingProposal[];
}

// ─── Guards ────────────────────────────────────────────────────────────────────

/**
 * The recalibration write is legal ONLY on a non-general, non-preset user audience.
 * General + presets are virtual constants that resolve to DEFAULT / goal-bias weights —
 * recalibrating them would corrupt the regression gate (Pitfall 5).
 */
function isRecalibratableAudience(audience: {
  is_general: boolean;
  is_preset: boolean;
} | null): boolean {
  return audience != null && !audience.is_general && !audience.is_preset;
}

/**
 * The reconciliation rows still pending for one disposition (carry a divergence signal
 * for it AND are not yet confirmed/declined). These are the rows confirm/decline transition.
 */
function pendingRowsForDisposition(
  rows: Reconciliation[],
  disposition: Disposition,
): Reconciliation[] {
  return rows.filter(
    (r) =>
      (r.proposal_state === "logged" || r.proposal_state === "proposed") &&
      r.divergence_vector[disposition] != null,
  );
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Surface pending recalibration proposals for one audience, or null if none pass the gate.
 *
 * - General/preset audiences NEVER propose (returns null without querying — regression gate).
 * - Only PENDING reconciliations (logged/proposed) feed the gate, so a previously
 *   confirmed/declined proposal is not re-surfaced.
 * - The gate (Plan 01) enforces ≥N_MIN consistent posts in the same direction; CRAFT
 *   dispositions can never pass (the gate only iterates CALIBRATION dispositions).
 */
export async function getPendingProposals(
  supabase: SupabaseClient,
  audienceId: string,
): Promise<PendingProposalSet | null> {
  // Regression gate: never propose on General/preset (short-circuit, no DB query).
  const audience = await getAudience(supabase, audienceId);
  if (!isRecalibratableAudience(audience)) return null;

  const rows = await listReconciliations(supabase, audienceId);

  // Only pending rows feed the gate — confirmed/declined are excluded (no re-nag).
  const pending = rows.filter(
    (r) => r.proposal_state === "logged" || r.proposal_state === "proposed",
  );

  const gateResult = evaluateGate(
    pending.map((r) => ({ divergenceVector: r.divergence_vector })),
  );
  if (!gateResult) return null;

  const proposals: PendingProposal[] = gateResult.proposals.map((p) => ({
    ...p,
    proposalId: p.disposition,
    direction: p.mean >= 0 ? "up" : "down",
  }));

  return { proposals };
}

/**
 * Confirm a proposal: write the bounded, normalized override onto the audience's
 * `persona_weights` (the analysis_override slot) and mark the contributing rows confirmed.
 *
 * HARD GUARD: refuses any General/preset audience (throws). The ONLY weights touched are
 * the audience's CURRENT persona_weights — DEFAULT/ARCHETYPE_DEFINITIONS/ENGINE_VERSION are
 * never read or written (buildOverride is pure over the passed-in weights).
 */
export async function confirmProposal(
  supabase: SupabaseClient,
  audienceId: string,
  proposalId: string,
): Promise<void> {
  const audience = await getAudience(supabase, audienceId);
  if (!isRecalibratableAudience(audience)) {
    throw new Error(
      `cannot recalibrate audience '${audienceId}': General/preset audiences are never recalibrated (regression gate)`,
    );
  }
  // Non-null asserted by isRecalibratableAudience.
  const aud = audience!;

  const disposition = proposalId as Disposition;
  const rows = await listReconciliations(supabase, audienceId);
  const contributing = pendingRowsForDisposition(rows, disposition);

  // Re-evaluate the gate over the pending rows to recover the proposal's signed mean.
  const pending = rows.filter(
    (r) => r.proposal_state === "logged" || r.proposal_state === "proposed",
  );
  const gateResult = evaluateGate(
    pending.map((r) => ({ divergenceVector: r.divergence_vector })),
  );
  const proposal = gateResult?.proposals.find(
    (p) => p.disposition === disposition,
  );
  if (!proposal) {
    throw new Error(
      `proposal '${proposalId}' for audience '${audienceId}' is no longer above the confidence gate`,
    );
  }

  // Bounded delta against the audience's CURRENT weights (never DEFAULT/ARCHETYPE).
  const nextWeights = buildOverride(proposal, aud.persona_weights);

  // Write ONLY persona_weights (the analysis_override slot) — regression-gate boundary.
  await updateAudience(supabase, audienceId, { persona_weights: nextWeights });

  // Transition the contributing rows to 'confirmed' (audit + no re-nag).
  const confirmedAt = new Date().toISOString();
  for (const r of contributing) {
    await updateProposalState(supabase, r.id, "confirmed", confirmedAt);
  }
}

/**
 * Decline a proposal: mark the contributing rows 'declined' so the same proposal is not
 * re-surfaced. Never writes the audience. Idempotent over already-declined rows.
 */
export async function declineProposal(
  supabase: SupabaseClient,
  audienceId: string,
  proposalId: string,
): Promise<void> {
  const disposition = proposalId as Disposition;
  const rows = await listReconciliations(supabase, audienceId);
  const contributing = pendingRowsForDisposition(rows, disposition);

  for (const r of contributing) {
    await updateProposalState(supabase, r.id, "declined");
  }
}
