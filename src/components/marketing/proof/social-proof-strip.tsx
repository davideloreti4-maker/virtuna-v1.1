import { Marquee } from "@/components/ui/marquee";
import { Placeholder } from "@/components/marketing/placeholder";
import { cn } from "@/lib/utils";

/**
 * SocialProofStrip — PROOF-01: thin trust bar that rides directly under the hero.
 *
 * Composition (D-02/D-03/D-04):
 *  - A cream peer-count trust stat ("Join 2,000+ creators") — the accessible name
 *    of the strip. Swappable placeholder number per D-04.
 *  - A <Marquee> of 6 <Placeholder variant="logo"> slots — neutral creator/brand
 *    swap slots, NOT real platform marks, NOT press logos (D-03).
 *
 * A11y LANDMINE (Pitfall 4): Marquee renders its children `repeat=4` times. The
 * entire marquee region is wrapped in `aria-hidden="true"` so a screen reader reads
 * the decorative logo wall at most once. The trust stat carries the strip's
 * accessible meaning.
 *
 * Token discipline: cream tokens only (text-foreground / text-foreground-secondary),
 * NO coral (strip has no CTA — coral stays precious to CTA band/pricing), NO
 * glass/glow/blur, NO serif (serif reserved to hero + band close-line, D-13),
 * NO <h2> (this is a thin trust bar, not a titled section).
 *
 * Pure RSC — no "use client".
 */
export function SocialProofStrip({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      {/* Peer-count trust stat — the strip's one accessible text node. */}
      <p className="text-center text-sm font-medium text-foreground-secondary tracking-wide">
        Join 2,000+ creators already running Numen Simulations
      </p>

      {/* Logo marquee — decorative, hidden from a11y tree (Pitfall 4). */}
      <div aria-hidden="true" className="mt-6 overflow-hidden">
        <Marquee
          pauseOnHover
          className="[--duration:40s] [--gap:1.5rem]"
          repeat={4}
        >
          <Placeholder
            variant="logo"
            aspect="3/1"
            className="h-10 w-28 shrink-0"
          />
          <Placeholder
            variant="logo"
            aspect="3/1"
            className="h-10 w-28 shrink-0"
          />
          <Placeholder
            variant="logo"
            aspect="3/1"
            className="h-10 w-28 shrink-0"
          />
          <Placeholder
            variant="logo"
            aspect="3/1"
            className="h-10 w-28 shrink-0"
          />
          <Placeholder
            variant="logo"
            aspect="3/1"
            className="h-10 w-28 shrink-0"
          />
          <Placeholder
            variant="logo"
            aspect="3/1"
            className="h-10 w-28 shrink-0"
          />
        </Marquee>
      </div>
    </div>
  );
}
