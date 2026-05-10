// ---------------------------------------------------------------------------
// BehavioralHero.tsx -- Server-rendered behavioral hero composition (Phase 2).
// ---------------------------------------------------------------------------
//
// This is a React Server Component -- the client-boundary directive is
// intentionally absent at the top of this file. It ships only static
// HTML + CSS for the above-fold hero: pre-headline, H1, sub-
// headline, subline, dual CTA, ambient gradient backdrop, and the DOM-
// accessible confidence chip overlay. The single client island is
// `BehavioralCanvas` (Plan 02 output) which hydrates post-paint to drive
// the one-shot 2.2s drift+attract particle animation.
//
// Composition pieces:
//   - HERO_GRADIENT (Plan 02 constants) -- inline `background` on section
//   - BehavioralCanvas (Plan 02 client island) -- right column / above text
//   - CONFIDENCE_CHIP (Plan 02 constants) -- DOM overlay, NOT canvas text
//   - PARTICLE_MOTION.targetOffsetY -- used to compute chip Y so it aligns
//     with the canvas convergence point (0.5 + -0.05 = 45 percent)
//
// Copy strings are locked verbatim per REQUIREMENTS.md HERO-01..05. The
// hero contains zero banned vocabulary (the canvas-2d text APIs are
// intentionally avoided; lint-vocab guards against drift at commit time).
//
// Trust boundaries (per <threat_model>):
//   - Server-rendered HTML -> client DOM: all copy is static marketing
//   - Primary CTA -> middleware: `<Link href="/dashboard">` triggers the
//     existing supabase middleware; no new auth surface in this plan
//   - Secondary CTA -> in-page anchor: `<Link href="#science">` is a same-
//     document fragment; the target ships in Phase 4
//   - DOM chip overlay -> a11y tree: hardcoded "87 percent" illustration
// ---------------------------------------------------------------------------

import Link from "next/link";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

import { BehavioralCanvas } from "./BehavioralCanvas";
import {
  CONFIDENCE_CHIP,
  HERO_GRADIENT,
  PARTICLE_MOTION,
} from "./behavioral-hero-constants";

interface BehavioralHeroProps {
  /** Optional layout/spacing override. Merged via `cn()`. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Chip positioning math
// ---------------------------------------------------------------------------
// Canvas particles converge at canvas.height * (0.5 + PARTICLE_MOTION.targetOffsetY)
// which is 0.5 + (-0.05) = 0.45 (45 percent of canvas height). The chip uses
// the same fraction so its visual center aligns with the converged cluster
// in both motion + reduced-motion paths.
const CHIP_TOP_PERCENT = (0.5 + PARTICLE_MOTION.targetOffsetY) * 100; // 45

/**
 * Server-rendered behavioral hero composition.
 *
 * Layout:
 *   - lg+ (>=1024px): two-column flex, text left ~60 percent, canvas right ~40 percent
 *   - mobile (<lg): stacked, canvas above text
 *
 * Closes the Wave-2 chain: Plan 01 swapped the page import to BehavioralHero,
 * Plan 02 published BehavioralCanvas + the constants module, Plan 03 locked
 * the zero-imports policy. This component is the integration point.
 */
export function BehavioralHero({ className }: BehavioralHeroProps) {
  return (
    <section
      className={cn(
        "relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden",
        className
      )}
      style={{ background: HERO_GRADIENT }}
    >
      <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-24 w-full">
        <div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-12 lg:gap-12">
          {/* Left column: text + dual CTA -- approx 60 percent on desktop */}
          <div className="flex-1 max-w-2xl text-left">
            {/* Pre-headline -- HERO-01 (Numen Machines lockup, small mono uppercase) */}
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-foreground/60 mb-6">
              VIRTUNA &middot; A NUMEN MACHINES PRODUCT
            </p>

            {/* H1 -- HERO-02 / RESEARCH §2 D-23, D-35, D-39 */}
            <h1
              className="font-sans font-light text-foreground"
              style={{
                fontSize: "clamp(2.75rem, 6.5vw, 5rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                textWrap: "balance",
                maxWidth: "14ch",
              }}
            >
              Predict how your audience will respond.
              <br />
              Before you post.
            </h1>

            {/* Sub-headline -- HERO-03 / RESEARCH §2 D-24 */}
            <p
              className="font-sans font-medium text-foreground mt-6"
              style={{
                fontSize: "clamp(1.25rem, 2.2vw, 1.5rem)",
                lineHeight: 1.35,
              }}
            >
              Virtuna simulates your audience to forecast every video before it ships.
            </p>

            {/* Subline -- HERO-04 / RESEARCH §2 D-25 (muted foreground) */}
            <p
              className="font-sans font-normal text-foreground/70 mt-4"
              style={{
                fontSize: "clamp(1rem, 1.4vw, 1.125rem)",
                lineHeight: 1.5,
              }}
            >
              Trained on decades of behavioral research. Self-improving with every outcome.
            </p>

            {/* Dual CTA -- HERO-05 / RESEARCH §2 D-26, D-27, D-28 */}
            {/* asChild composes Radix Slot so the Button styles wrap a Next.js Link */}
            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Button asChild variant="primary" size="lg">
                <Link href="/dashboard">Run a prediction →</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="#science">See the science</Link>
              </Button>
            </div>
          </div>

          {/* Right column: canvas + chip overlay -- approx 40 percent on desktop */}
          {/* On mobile this column stacks ABOVE the text (flex-col-reverse) */}
          <div className="relative flex-1 w-full lg:w-[40%] aspect-square lg:aspect-auto lg:h-[520px]">
            <BehavioralCanvas className="w-full h-full" />

            {/* ----- DOM-accessible confidence chip overlay (HERO-06) ----- */}
            {/* Orchestrator decision #6: chip is a real <div>, NOT canvas text. */}
            {/* role="status" + aria-live="off" -- value is static after mount; */}
            {/* screen readers announce on focus / page scan via aria-label. */}
            {/* pointer-events-none makes the chip decorative (no click target) */}
            {/* per CONTEXT.md Deferred Ideas -- chip is illustration, not interactive. */}
            {/* Positioned at top: 45% (matches PARTICLE_MOTION.targetOffsetY) so */}
            {/* the chip center aligns with the canvas particle convergence point. */}
            <div
              role="status"
              aria-live="off"
              aria-label={`Predicted audience response confidence: ${CONFIDENCE_CHIP.label}`}
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-sans"
              style={{
                top: `${CHIP_TOP_PERCENT}%`,
                paddingInline: `${CONFIDENCE_CHIP.paddingX}px`,
                paddingBlock: `${CONFIDENCE_CHIP.paddingY}px`,
                fontSize: `${CONFIDENCE_CHIP.fontSizePx}px`,
                fontWeight: CONFIDENCE_CHIP.fontWeight,
                color: CONFIDENCE_CHIP.textColor,
                backgroundColor: CONFIDENCE_CHIP.bgColor,
                border: `1px solid ${CONFIDENCE_CHIP.borderColor}`,
                borderRadius: `${CONFIDENCE_CHIP.borderRadius}px`,
              }}
            >
              {CONFIDENCE_CHIP.label}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
