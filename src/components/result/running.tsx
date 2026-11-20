"use client";

import { Card } from "@/components/ui/card";

/**
 * A run still in flight (slice A: one quiet line; the staged running state is slice B). The row
 * keeps polling (useSimulationRow); when the run finishes the page turns into its result.
 * Same frame as the no-audience state: the mock's `noaudP` card.
 */
export function Running() {
  return (
    <div className="px-4 pt-[9px] md:mx-auto md:max-w-[588px] md:px-0 md:pt-8">
      <Card data-result="running" className="flex items-center gap-3 px-3.5 pb-3 pt-3.5">
        <div className="aspect-[9/16] w-[124px] shrink-0 rounded-2xl bg-surface-sunken" />
        <p role="status" className="min-w-0 flex-1 pl-1.5 text-title font-[560] text-foreground-secondary">
          Simulating…
        </p>
      </Card>
    </div>
  );
}
