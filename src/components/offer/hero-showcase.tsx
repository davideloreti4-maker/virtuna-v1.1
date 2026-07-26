"use client";

/**
 * HeroShowcase — the entry IS the hero (owner call 2026-07-27: "we want traffic
 * actually go into the flow").
 *
 * The previous shape paired the live composer with an always-on room panel in a
 * second column. That panel — however faithful — was an exhibit: a fixture of a
 * surface the visitor reaches FOR REAL two clicks later (§0b: the demo is the
 * platform). Side by side, the exhibit competed with the entry. So the hero is
 * now ONE centered surface — the live composer — and the room demotes to a
 * deliberate pull-up ("See how the room reacts →"), the pattern mobile already
 * used, on every viewport. Proof stays one tap away; the paste/drop is the only
 * thing the fold asks for.
 */

import { HeroEntry } from "@/components/offer/hero-entry";
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
    <div className="mx-auto w-full max-w-[640px]">
      {/* The ONE surface — the live entry. Was ProductRender (a fixture), then a
          two-column pairing with the room; the slot now takes the real input alone. */}
      <HeroEntry />

      {/* The room, demoted to a pull-up on ALL viewports — a deliberate tap, never an
          always-on exhibit beside the entry. */}
      <div className="mt-4">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="mx-auto flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              See how the room reacts
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
