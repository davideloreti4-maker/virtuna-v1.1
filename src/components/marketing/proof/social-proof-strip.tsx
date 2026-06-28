import { Marquee } from "@/components/ui/marquee";
import { cn } from "@/lib/utils";

/**
 * SocialProofStrip — PROOF-01: thin trust bar that rides directly under the hero.
 *
 * Composition (D-02/D-03/D-04):
 *  - A cream peer-count trust stat ("Join 2,000+ creators") — the accessible name
 *    of the strip. Swappable placeholder number per D-04.
 *  - A <Marquee> of grayscale creator/studio WORDMARKS — neutral swap slots, NOT
 *    real platform marks, NOT press logos (D-03). Rendered as muted wordmarks (the
 *    standard "trusted by" logo-wall pattern) rather than empty bordered boxes, so
 *    the strip reads as a finished roster instead of broken image slots. Each slot
 *    carries data-variant="logo" and is swapped for a real `<img>` logo later
 *    (the one-asset swap, FOUND-03).
 *
 * A11y LANDMINE (Pitfall 4): Marquee renders its children `repeat=4` times. The
 * entire marquee region is wrapped in `aria-hidden="true"` so a screen reader reads
 * the decorative logo wall at most once. The trust stat carries the strip's
 * accessible meaning.
 *
 * Token discipline: cream tokens only (text-foreground / text-foreground-secondary
 * / text-foreground-muted), NO coral (strip has no CTA — coral stays precious to
 * CTA band/pricing), NO glass/glow/blur, NO serif (serif reserved to hero + band
 * close-line, D-13), NO <h2> (this is a thin trust bar, not a titled section).
 *
 * Pure RSC — no "use client".
 */

/**
 * Neutral wordmark roster — fictional creator/studio names (D-21 placeholder
 * convention, mirrors the Testimonials' drafted handles). Each becomes a real
 * grayscale logo `<img>` post-launch; the wordmark is the until-then stand-in.
 */
const LOGOS = [
  "Maya Chen",
  "Loop Studio",
  "Jordan Ellis",
  "Hightide",
  "Priya Sharma",
  "Northbound",
  "Verve Media",
] as const;

/** Edge-fade mask so wordmarks dissolve at the rail edges (flat-warm-legal — a
 *  CSS mask, NOT a glow/blur). Applied inline so Lightning CSS never strips it. */
const EDGE_FADE: React.CSSProperties = {
  WebkitMaskImage:
    "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
  maskImage:
    "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
};

export function SocialProofStrip({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      {/* Peer-count trust stat — the strip's one accessible text node. */}
      <p className="text-center text-sm font-medium text-foreground-secondary tracking-wide">
        Join 2,000+ creators already running Numen Simulations
      </p>

      {/* Wordmark roster — decorative, hidden from a11y tree (Pitfall 4). */}
      <div
        aria-hidden="true"
        className="mt-6 overflow-hidden"
        style={EDGE_FADE}
      >
        <Marquee pauseOnHover className="[--duration:44s] [--gap:3rem]" repeat={4}>
          {LOGOS.map((name) => (
            <span
              key={name}
              data-variant="logo"
              className={cn(
                "flex h-10 shrink-0 items-center whitespace-nowrap px-1",
                "text-lg font-semibold tracking-tight text-foreground-muted/70",
                "transition-colors duration-200 hover:text-foreground-secondary"
              )}
            >
              {name}
            </span>
          ))}
        </Marquee>
      </div>
    </div>
  );
}
