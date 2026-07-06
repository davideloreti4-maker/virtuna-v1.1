"use client";

/**
 * recalibration-nudge.tsx — the propose→confirm recalibration nudge
 * (10-06 Task 2, FLYWHEEL-04 + FLYWHEEL-06).
 *
 * ONE component, TWO triggers (D-01 "folded in, not built separately"): `source`
 * discriminates the outcome-driven vs drift-driven copy; BOTH run the SAME
 * confirm→override path. Renders ONLY when the server-evaluated confidence gate has
 * passed (use-recalibration-proposals returns a pending proposal) — NEVER speculatively
 * (UI-SPEC §Interaction Contracts, hard rule D-05).
 *
 * Honesty spine + interaction contract:
 *  - ALWAYS propose→confirm. NO auto-apply, NO single-post trigger, NO silent mutation.
 *  - Confirm "Recalibrate" is the ONLY accent (coral) CTA; Decline "Not now" is secondary.
 *  - Honesty footnote is always present.
 *  - Decline = dismiss + log 'declined' server-side; the same proposal is not re-nagged.
 *  - Post-confirm success: "Recalibrated. Future Reads use the updated audience."
 *  - Keyboard-operable confirm/decline (native <button>s via the Button primitive).
 *
 * Flat-warm SSOT (THEME-06): charcoal-composer container, cream text, accent only on the
 * Recalibrate CTA + focus ring. No coral on body/footnote/headline.
 */

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import {
  useRecalibrationProposals,
  useRecalibrationAction,
  type RecalibrationProposal,
} from "@/hooks/queries/use-recalibration-proposals";

/** Which trigger surfaced this nudge — selects the copy, shares the confirm path. */
export type RecalibrationSource = "outcome" | "drift";

interface RecalibrationNudgeProps {
  /** The non-general audience this proposal targets. */
  audienceId: string;
  /** Display name of the audience (rendered into the copy). */
  audienceName: string;
  /** Trigger: 'outcome' (post-outcome divergence) or 'drift' (fresh re-scrape). */
  source: RecalibrationSource;
}

/** Human-readable disposition labels for the outcome copy. */
const DISPOSITION_LABEL: Record<string, string> = {
  collector: "savers",
  connector: "sharers",
  converter: "buyers",
  scanner: "scanners",
  lurker: "lurkers",
  skeptic: "skeptics",
};

function dispositionLabel(disposition: string): string {
  return DISPOSITION_LABEL[disposition] ?? disposition;
}

/** Outcome headline — disposition- AND direction-aware (never a hardcoded disposition). */
function outcomeHeadline(p: RecalibrationProposal): string {
  const who = dispositionLabel(p.disposition);
  return p.direction === "up"
    ? `Your ${who} ran warmer than we modeled.`
    : `Your ${who} ran cooler than we modeled.`;
}

function outcomeBody(p: RecalibrationProposal, audienceName: string): string {
  const moreLess = p.direction === "up" ? "more" : "less";
  return `Across your last ${p.n} posts, ${dispositionLabel(
    p.disposition,
  )} showed up ${moreLess} than your audience predicted. Want to recalibrate "${audienceName}" to match?`;
}

function driftBody(audienceName: string): string {
  return `A fresh look at your account shows your audience mix has moved since we calibrated "${audienceName}". Recalibrate to match?`;
}

export function RecalibrationNudge({
  audienceId,
  audienceName,
  source,
}: RecalibrationNudgeProps) {
  const { data } = useRecalibrationProposals(audienceId);
  const action = useRecalibrationAction(audienceId);

  // Below-gate state: the server returned no proposal → render NOTHING (never speculative).
  const proposal = data?.proposal?.proposals?.[0] ?? null;

  // Post-confirm success (UI-SPEC) — shown after a successful confirm action.
  if (action.isSuccess && action.variables?.action === "confirm") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-charcoal-composer)] p-4">
        <Text size="sm" className="text-[var(--color-cream-primary)]">
          Recalibrated. Future Reads use the updated audience.
        </Text>
      </div>
    );
  }

  // After a decline (or no proposal), dismiss — render nothing.
  if (!proposal) return null;

  const headline =
    source === "drift"
      ? "Your audience has shifted."
      : outcomeHeadline(proposal);
  const body =
    source === "drift"
      ? driftBody(audienceName)
      : outcomeBody(proposal, audienceName);

  const handle = (act: "confirm" | "decline") => {
    action.mutate({ proposalId: proposal.proposalId, action: act });
  };

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-charcoal-composer)] p-4 space-y-3"
      role="region"
      aria-label="Recalibration proposal"
    >
      <Text
        size="base"
        className="font-semibold text-[var(--color-cream-primary)]"
      >
        {headline}
      </Text>

      <Text size="sm" className="text-[var(--color-cream-secondary)]">
        {body}
      </Text>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          onClick={() => handle("confirm")}
          disabled={action.isPending}
        >
          Recalibrate
        </Button>
        <Button
          variant="secondary"
          onClick={() => handle("decline")}
          disabled={action.isPending}
        >
          Not now
        </Button>
      </div>

      {/* Honesty footnote — always present; never coral. */}
      <Text size="sm" className="text-[var(--color-cream-muted)]">
        This only adjusts this audience — it never changes your scores or the
        General audience.
      </Text>
    </div>
  );
}
