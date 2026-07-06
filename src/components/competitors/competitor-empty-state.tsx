"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Constellation, buildLoadingDots } from "@/components/brand/constellation";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { AddCompetitorDialog } from "@/components/competitors/add-competitor-dialog";
import { SurfaceEmptyState } from "@/components/ui/surface-empty-state";

/**
 * Calm informational empty state shown when the user tracks no competitors yet.
 *
 * Uses the house-style <SurfaceEmptyState> quiet tile (flat-warm SSOT) carrying
 * the Constellation brand motif, semibold title, muted subline, and a single CTA.
 */
export function CompetitorEmptyState() {
  const reducedMotion = usePrefersReducedMotion();
  const dots = useMemo(() => buildLoadingDots(120, 32, 8), []);

  return (
    <SurfaceEmptyState
      icon={
        <Constellation
          dots={dots}
          reducedMotion={reducedMotion}
          width={140}
          height={38}
          vbW={120}
          vbH={32}
          ariaLabel="No competitors tracked yet"
        />
      }
      title="No competitors tracked yet"
      action={
        <AddCompetitorDialog
          trigger={<Button variant="primary">Add Competitor</Button>}
        />
      }
    >
      Add your first TikTok competitor to start tracking their growth,
      engagement, and content strategy.
    </SurfaceEmptyState>
  );
}
