"use client";

import * as React from "react";
import { Info } from "lucide-react";

/**
 * TruthfulnessCallout — subtle surface-elevated reminder rendered on Card 0
 * and Card 6 of the 9-card creator interview (D-04 + UI-SPEC §Copywriting).
 *
 * Exact copy is grep-locked: "Honest answers improve your prediction accuracy by ~30%."
 *
 * UI-SPEC §Color: this is informational, NOT a CTA — no coral, no accent fill.
 * Container uses neutral white/[0.02] surface with a 6% border, matching the
 * Raycast subtle-elevated pattern.
 */
export function TruthfulnessCallout(): React.JSX.Element {
  return (
    <div
      role="note"
      data-testid="truthfulness-callout"
      className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-foreground-secondary"
    >
      <Info
        size={16}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-foreground-muted"
      />
      <p className="leading-snug">
        Honest answers improve your prediction accuracy by ~30%.
      </p>
    </div>
  );
}
