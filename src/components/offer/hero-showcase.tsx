"use client";

/**
 * HeroShowcase — the live entry with the product demonstrating itself below
 * (owner call 2026-07-27: "I like the composer on the hero, but we need some
 * sort of demo… when you go on the page freshly, you don't know exactly what
 * to do").
 *
 * Composition, one centered column:
 *   1. the live composer (HeroEntry) — the ONE ask of the fold;
 *   2. HeroDemo — the three beats on loop (a link types itself → the read
 *      sweeps → the verdict lands), teaching the action by performing it.
 *      It FREEZES the moment focus enters the composer: a demo must never
 *      compete with a visitor who has already started;
 *   3. a quiet link into the full v2 room (bottom sheet) — the same fixture
 *      the demo's verdict quotes, so teaser and deep-dive agree to the digit.
 */

import { useState } from "react";
import { HeroEntry } from "@/components/offer/hero-entry";
import { HeroDemo } from "@/components/offer/hero-demo";
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
  // demo freezes on its verdict and stays out of the way. One-way on purpose —
  // resuming choreography under someone mid-thought is noise.
  const [engaged, setEngaged] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div onFocusCapture={() => setEngaged(true)}>
        <HeroEntry />
      </div>

      <div className="mt-4">
        <HeroDemo paused={engaged} />
      </div>

      <div className="mt-3 text-center">
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
