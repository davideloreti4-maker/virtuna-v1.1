"use client";

/**
 * HeroShowcase — the probe: what the product looks and feels like, without asking for anything.
 *
 * Was "the live entry, with the product itself underneath" — a composer above a product window.
 * Owner call 2026-07-27, after four rejected "show" concepts (handoff 2026-07-27 §3, all of them
 * abstractions of the product): the composer leaves, because it made a cold visitor do the work
 * before they saw any result, and the window becomes the whole surface — "a preloaded animated
 * demo, 1:1 accurate to the platform, so users get a feel of it". The ask is now a button in the
 * fold above, and the composer inside the window is part of the SHOT, not a real field.
 *
 * Composition:
 *   1. HeroProductWindow — the REAL platform surface at full fidelity: the thread with the real
 *      Test card, the real drilled read rail beside it, and the guided build-motion. Deliberately
 *      NON-interactive (`inert`) — it is a probe, not a control surface;
 *   2. a quiet link into the full v2 read (bottom sheet) — the same fixture the window's rail
 *      renders, so shot and deep-dive agree to the digit.
 */

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
  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1024px]">
        <HeroProductWindow />
      </div>

      <div className="mt-4 text-center">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="mx-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-foreground-muted transition-colors hover:text-foreground"
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
