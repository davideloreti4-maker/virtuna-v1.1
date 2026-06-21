/**
 * propose.test.ts — TDD RED/GREEN for the propose→confirm→decline orchestration
 * (10-06 Task 1, FLYWHEEL-04/05).
 *
 * propose.ts wires Plan 01's pure gate (evaluateGate) + bounded delta (buildOverride)
 * to the Plan 02 repos. It is the regression-gate-critical seam: confirm writes ONLY
 * the analysis_override slot on a NON-GENERAL user audience; General/preset are refused.
 *
 * Covers:
 *  - gate-pass → a PendingProposal is returned (with disposition + human-readable direction)
 *  - below-gate → null (no proposal surfaced before ≥N consistent posts)
 *  - is_general / preset audience → getPendingProposals returns null (never proposes)
 *  - confirmProposal on a non-general audience writes a normalized override (updateAudience)
 *    and marks the contributing reconciliations 'confirmed'
 *  - REGRESSION ANCHOR: confirm on General is rejected; General weights provably unchanged
 *  - declineProposal marks 'declined' and the same proposal is not re-surfaced
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPendingProposals,
  confirmProposal,
  declineProposal,
} from "../propose";
import { N_MIN } from "../confidence-gate";
import type { Reconciliation } from "../reconciliation-repo";
import { GENERAL_AUDIENCE, PRESET_AUDIENCES } from "@/lib/audience/audience-repo";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const listReconciliations = vi.fn();
const updateProposalState = vi.fn();
const getAudience = vi.fn();
const updateAudience = vi.fn();

vi.mock("../reconciliation-repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../reconciliation-repo")>();
  return {
    ...actual,
    listReconciliations: (...a: unknown[]) => listReconciliations(...a),
    updateProposalState: (...a: unknown[]) => updateProposalState(...a),
  };
});

vi.mock("@/lib/audience/audience-repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audience/audience-repo")>();
  return {
    ...actual,
    getAudience: (...a: unknown[]) => getAudience(...a),
    updateAudience: (...a: unknown[]) => updateAudience(...a),
  };
});

// A reconciliation row with a single-disposition divergence vector.
function row(
  id: string,
  divergence: Record<string, number>,
  proposal_state: Reconciliation["proposal_state"] = "logged",
): Reconciliation {
  return {
    id,
    user_id: "u1",
    outcome_signature_id: null,
    audience_id: "aud-1",
    niche: null,
    goal_intent: null,
    follower_tier: null,
    predicted_vector: {},
    realized_vector: {},
    divergence_vector: divergence,
    classification: {},
    proposal_state,
    proposed_delta: null,
    confirmed_at: null,
    created_at: "2026-06-19T00:00:00Z",
  };
}

// A user (non-general) audience with even weights.
const USER_AUDIENCE = {
  id: "aud-1",
  user_id: "u1",
  name: "My Buyers",
  type: "personal" as const,
  platform: "tiktok" as const,
  goal_label: null,
  goal_intent: null,
  is_general: false,
  is_preset: false,
  persona_weights: { fyp: 0.25, niche: 0.25, loyalist: 0.25, cross_niche: 0.25 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-06-19T00:00:00Z",
  updated_at: "2026-06-19T00:00:00Z",
};

const supabase = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  updateProposalState.mockResolvedValue(undefined);
  updateAudience.mockResolvedValue(undefined);
});

describe("getPendingProposals", () => {
  it("returns a pending proposal when the confidence gate passes", async () => {
    // N_MIN consistent +0.2 collector divergences → gate passes for collector.
    const rows = Array.from({ length: N_MIN }, (_, i) =>
      row(`r${i}`, { collector: 0.2 }),
    );
    listReconciliations.mockResolvedValue(rows);
    getAudience.mockResolvedValue(USER_AUDIENCE);

    const result = await getPendingProposals(supabase, "aud-1");
    expect(result).not.toBeNull();
    expect(result!.proposals.length).toBeGreaterThanOrEqual(1);
    const p = result!.proposals[0]!;
    expect(p.disposition).toBe("collector");
    // human-readable direction is exposed
    expect(p.direction).toBe("up");
    expect(typeof p.proposalId).toBe("string");
  });

  it("returns null below the gate (fewer than N_MIN posts)", async () => {
    const rows = Array.from({ length: N_MIN - 1 }, (_, i) =>
      row(`r${i}`, { collector: 0.2 }),
    );
    listReconciliations.mockResolvedValue(rows);
    getAudience.mockResolvedValue(USER_AUDIENCE);

    const result = await getPendingProposals(supabase, "aud-1");
    expect(result).toBeNull();
  });

  it("returns null for a General audience (never proposes — regression gate)", async () => {
    getAudience.mockResolvedValue(GENERAL_AUDIENCE);
    const result = await getPendingProposals(supabase, GENERAL_AUDIENCE.id);
    expect(result).toBeNull();
    // never even queries reconciliations for General
    expect(listReconciliations).not.toHaveBeenCalled();
  });

  it("returns null for a preset audience (never proposes)", async () => {
    getAudience.mockResolvedValue(PRESET_AUDIENCES[0]);
    const result = await getPendingProposals(supabase, PRESET_AUDIENCES[0]!.id);
    expect(result).toBeNull();
    expect(listReconciliations).not.toHaveBeenCalled();
  });
});

describe("confirmProposal", () => {
  it("writes a normalized override on a non-general audience + marks rows confirmed", async () => {
    const rows = Array.from({ length: N_MIN }, (_, i) =>
      row(`r${i}`, { collector: 0.2 }),
    );
    listReconciliations.mockResolvedValue(rows);
    getAudience.mockResolvedValue(USER_AUDIENCE);

    await confirmProposal(supabase, "aud-1", "collector");

    // updateAudience called with a normalized persona_weights override
    expect(updateAudience).toHaveBeenCalledTimes(1);
    const [, audId, patch] = updateAudience.mock.calls[0]!;
    expect(audId).toBe("aud-1");
    const w = patch.persona_weights;
    const sum = w.fyp + w.niche + w.loyalist + w.cross_niche;
    expect(sum).toBeCloseTo(1.0, 2);
    // collector → fyp slot nudged up
    expect(w.fyp).toBeGreaterThan(0.25);

    // contributing rows transitioned to 'confirmed'
    expect(updateProposalState).toHaveBeenCalled();
    const confirmedStates = updateProposalState.mock.calls.map((c) => c[2]);
    expect(confirmedStates.every((s) => s === "confirmed")).toBe(true);
  });

  it("REGRESSION: refuses to confirm on General — General weights unchanged", async () => {
    getAudience.mockResolvedValue(GENERAL_AUDIENCE);

    await expect(
      confirmProposal(supabase, GENERAL_AUDIENCE.id, "collector"),
    ).rejects.toThrow();

    // the audience write NEVER happened — General is untouched
    expect(updateAudience).not.toHaveBeenCalled();
    // General's canonical weights are still the DEFAULT mix
    expect(GENERAL_AUDIENCE.persona_weights).toEqual({
      fyp: 0.65,
      niche: 0.2,
      loyalist: 0.1,
      cross_niche: 0.05,
    });
  });

  it("REGRESSION: refuses to confirm on a preset audience", async () => {
    getAudience.mockResolvedValue(PRESET_AUDIENCES[0]);
    await expect(
      confirmProposal(supabase, PRESET_AUDIENCES[0]!.id, "collector"),
    ).rejects.toThrow();
    expect(updateAudience).not.toHaveBeenCalled();
  });
});

describe("declineProposal", () => {
  it("marks contributing rows 'declined' and the proposal is not re-surfaced", async () => {
    const rows = Array.from({ length: N_MIN }, (_, i) =>
      row(`r${i}`, { collector: 0.2 }),
    );
    listReconciliations.mockResolvedValue(rows);
    getAudience.mockResolvedValue(USER_AUDIENCE);

    await declineProposal(supabase, "aud-1", "collector");

    const declinedStates = updateProposalState.mock.calls.map((c) => c[2]);
    expect(declinedStates.length).toBeGreaterThan(0);
    expect(declinedStates.every((s) => s === "declined")).toBe(true);

    // After decline, those rows are 'declined' → excluded from the next gate pass.
    listReconciliations.mockResolvedValue(
      rows.map((r) => ({ ...r, proposal_state: "declined" as const })),
    );
    const next = await getPendingProposals(supabase, "aud-1");
    expect(next).toBeNull();
  });
});
