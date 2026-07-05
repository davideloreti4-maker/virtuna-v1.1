"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Constellation, buildLoadingDots } from "@/components/brand/constellation";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { AddCompetitorDialog } from "@/components/competitors/add-competitor-dialog";

/**
 * Calm informational empty state shown when the user tracks no competitors yet.
 *
 * Echoes the Library saved-shelf empty state (flat-warm SSOT): bordered container
 * carrying the Constellation brand motif, font-semibold title, muted subline, and
 * a single CTA. The old Raycast icon-in-rounded-box convention is retired.
 */
export function CompetitorEmptyState() {
  const reducedMotion = usePrefersReducedMotion();
  const dots = useMemo(() => buildLoadingDots(120, 32, 8), []);

  return (
    <div className="elev-rest flex min-h-[360px] flex-col items-center justify-center gap-5 rounded-[var(--radius-lg)] border border-white/[0.06] bg-background-elevated px-6 py-16 text-center">
      <Constellation
        dots={dots}
        reducedMotion={reducedMotion}
        width={140}
        height={38}
        vbW={120}
        vbH={32}
        ariaLabel="No competitors tracked yet"
      />
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-foreground">
          No competitors tracked yet
        </p>
        <p className="max-w-md text-sm text-foreground-muted">
          Add your first TikTok competitor to start tracking their growth,
          engagement, and content strategy.
        </p>
      </div>
      <AddCompetitorDialog
        trigger={<Button variant="primary">Add Competitor</Button>}
      />
    </div>
  );
}
