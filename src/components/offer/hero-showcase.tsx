"use client";

/**
 * HeroShowcase — the live entry, with the product itself underneath.
 *
 * Composition (owner feedback trail, handoff 2026-07-27 §3 — three "show"
 * concepts rejected, all abstractions of the product):
 *   1. the live composer (HeroEntry), centered — the ONE ask of the fold;
 *   2. HeroProductWindow — the REAL platform surface at full fidelity in one
 *      large app window: the thread with the real Test card, the real drilled
 *      read rail beside it, the guided build-motion playing ONCE on scroll.
 *      Focus entering the composer jumps it to the finished shot: a demo must
 *      never keep performing under a visitor who has already started;
 *   3. a quiet link into the full v2 read (bottom sheet) — the same fixture
 *      the window's rail renders, so shot and deep-dive agree to the digit.
 *      Below lg the window hides its rail pane, so the sheet is the only path
 *      to the read there — keep it.
 */

import { useState } from "react";
import { HeroEntry } from "@/components/offer/hero-entry";
import { HeroProductWindow } from "@/components/offer/hero-product-window";
import { AmbientPanel } from "@/components/offer/ambient-panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function HeroShowcase() {
  // Focus anywhere inside the composer block = the visitor has started; the
  // window's choreography yields to them. One-way on purpose — resuming
  // choreography under someone mid-thought is noise.
  const [engaged, setEngaged] = useState(false);

  return (
    <div className="w-full">
      {/* id="test": the shared FREE_ENTRY anchor (cta-config.tsx) — every
          below-fold entry CTA scrolls back to this composer. scroll-mt clears
          the floating nav island. */}
      <div
        id="test"
        className="mx-auto w-full max-w-[640px] scroll-mt-28"
        onFocusCapture={() => setEngaged(true)}
      >
        <HeroEntry />
      </div>

      <div className="mx-auto mt-12 w-full max-w-[1024px] md:mt-14">
        <HeroProductWindow skip={engaged} />
      </div>

      <div className="mt-4 text-center">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="mx-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-foreground-muted transition-colors hover:text-foreground"
            >
              See the full sample read — the brain, and the room
              <span aria-hidden>→</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[86vh] border-border bg-background p-0"
          >
            <SheetTitle className="sr-only">
              The simulated audience room
            </SheetTitle>
            <SheetDescription className="sr-only">
              How your simulated audience reads a video — the brain, and the
              audience.
            </SheetDescription>
            <div className="mx-auto h-full w-full max-w-[520px] px-3 pb-3 pt-2">
              <AmbientPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
