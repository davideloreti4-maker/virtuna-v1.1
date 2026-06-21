"use client";

/**
 * use-recalibration-proposals.ts — react-query hook for the recalibration flywheel
 * (10-06 Task 2, FLYWHEEL-04).
 *
 * Queries the SERVER-evaluated pending proposal for one audience and exposes
 * confirm/decline mutations. The gate is enforced server-side (propose.ts) — this hook
 * surfaces a proposal ONLY when the route returns one, so the nudge NEVER renders
 * speculatively (UI-SPEC §Interaction Contracts).
 *
 * Mirrors the use-bookmarks idiom: useQuery for the read, useMutation for the writes,
 * invalidate on settle so a confirmed/declined proposal stops re-surfacing.
 *
 * NOTE: `enabled` is false for General/preset/null audiences — the server would return
 * null anyway, but skipping the request avoids a pointless round-trip and keeps the nudge
 * provably absent for the regression-gate audiences.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

/** One surfaced proposal — mirrors PendingProposal in propose.ts. */
export interface RecalibrationProposal {
  disposition: string;
  proposalId: string;
  direction: "up" | "down";
  mean: number;
  n: number;
  agree: number;
}

interface ProposalsResponse {
  proposal: { proposals: RecalibrationProposal[] } | null;
}

/** Audience ids that never recalibrate — skip the query entirely (regression gate). */
function isRecalibratableId(audienceId: string | null | undefined): boolean {
  return (
    audienceId != null &&
    audienceId !== "general" &&
    !audienceId.startsWith("preset-")
  );
}

/**
 * QUERY: the pending recalibration proposal for one audience (null below the gate).
 * Disabled for General/preset/null audiences.
 */
export function useRecalibrationProposals(audienceId: string | null | undefined) {
  const enabled = isRecalibratableId(audienceId);

  return useQuery({
    queryKey: queryKeys.recalibration.proposals(audienceId ?? "none"),
    enabled,
    queryFn: async () => {
      const res = await fetch(
        `/api/flywheel/proposals?audience_id=${encodeURIComponent(audienceId!)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch recalibration proposals");
      return res.json() as Promise<ProposalsResponse>;
    },
  });
}

/**
 * MUTATION: confirm OR decline a proposal.
 * - confirm → server writes the bounded override on the audience's persona_weights.
 * - decline → server marks the contributing rows declined (no re-nag).
 * Invalidates the proposals query on settle so the nudge dismisses.
 */
export function useRecalibrationAction(audienceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      action,
    }: {
      proposalId: string;
      action: "confirm" | "decline";
    }) => {
      const res = await fetch("/api/flywheel/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience_id: audienceId,
          proposal_id: proposalId,
          action,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to apply recalibration");
      }
      return { proposalId, action };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.recalibration.proposals(audienceId ?? "none"),
      });
    },
  });
}
