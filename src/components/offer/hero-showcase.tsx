"use client";

/**
 * HeroShowcase — the two-surface story, side by side: the Test card (craft) and
 * the ambient room (reception). This is the landing's core promise made visible
 * — Maven both reads the craft AND simulates how the room reacts.
 *
 *   • Desktop (lg+): the room sits BESIDE the card, always on (the brain
 *     auto-plays its neural read).
 *   • Mobile: the card leads; the room is a Sheet the visitor pulls up on tap
 *     ("See how the room reacts →") — NOT always open, so it never buries the
 *     card on a small screen.
 */

import { ProductRender } from "@/components/offer/product-render";
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
    <div className="mx-auto w-full max-w-[1000px]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,560px)_minmax(340px,420px)] lg:items-start">
        {/* Surface 1 — the Test card (craft), with the guided build-motion */}
        <ProductRender />

        {/* Surface 2 — the room (reception). Beside on desktop, a Sheet on mobile. */}
        <div className="hidden lg:block lg:h-[620px]">
          <AmbientPanel />
        </div>
      </div>

      {/* Mobile-only opener for the room — a deliberate pull-up, never always open */}
      <div className="mt-4 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-surface-elevated/80"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              See how the room reacts
              <span aria-hidden className="text-foreground-muted">
                →
              </span>
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
              How a simulated room of 1,000 viewers reacts to your video — the
              brain, the people, and the population.
            </SheetDescription>
            <div className="h-full px-3 pb-3 pt-2">
              <AmbientPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
