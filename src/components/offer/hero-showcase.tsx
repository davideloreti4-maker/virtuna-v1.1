"use client";

/**
 * HeroShowcase — the hero object reads ASK → GET → PROOF (owner call 2026-07-27:
 * "for fresh traffic the page is unclear").
 *
 * A bare composer was a mystery box: it asked for input while showing nothing of
 * what comes back. So the hero is now one column with three connected pieces:
 *
 *   1. ASK   — the live composer (HeroEntry): heading + free badge + input.
 *   2. GET   — the sample-read strip: the three deliverables (would-stop %, the
 *              scroll second, the fix), figures VERBATIM from the room's own
 *              fixture (`CREATOR_TEMPLATE`, detail-fixture.ts) and labeled
 *              "sample read" — never presented as the visitor's own numbers.
 *   3. PROOF — the strip's footer opens the full v2 room (AmbientDetail) in a
 *              bottom sheet. Same fixture, so the teaser and the full read agree
 *              to the digit.
 *
 * No side panel: an always-on exhibit beside the entry competed with it
 * (previous owner call — "we want traffic actually go into the flow").
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

/** The three deliverables, figures verbatim from CREATOR_TEMPLATE (the same
 *  fixture the sheet's full read renders) — change them THERE, not here. */
const SAMPLE_READ = [
  { value: "38.2%", label: "would stop scrolling" },
  { value: "0:04", label: "the second they leave" },
  { value: "“Cut to the payoff before 0:03”", label: "the fix" },
] as const;

export function HeroShowcase() {
  return (
    <div className="mx-auto w-full max-w-[640px]">
      {/* ASK — the live entry */}
      <HeroEntry />

      {/* GET — what comes back, shown before anything is asked of them */}
      <div className="mt-4 rounded-[12px] border border-white/[0.06] bg-[#181817] px-5 pb-2 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-foreground-muted">
            What you get back
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground-muted/70">
            Sample read
          </span>
        </div>

        <div className="mt-3.5 grid gap-4 sm:grid-cols-3">
          {SAMPLE_READ.map((cell) => (
            <div key={cell.label}>
              <div className="text-[17px] font-medium leading-snug tracking-[-0.01em] text-foreground tabular-nums">
                {cell.value}
              </div>
              <div className="mt-1 text-[12px] text-foreground-muted">{cell.label}</div>
            </div>
          ))}
        </div>

        {/* PROOF — the full read behind this strip, one tap away */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-between border-t border-white/[0.06] py-3 text-[12.5px] text-foreground-muted transition-colors hover:text-foreground"
            >
              <span>See the full sample read — the brain, and the room</span>
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
