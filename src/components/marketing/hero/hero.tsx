import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL } from "@/lib/routes";

import { Placeholder } from "@/components/marketing/placeholder";
import {
  ScoreGaugeSkeleton,
  AudienceCloudSkeleton,
  DriverRowsSkeleton,
  RetentionCurveSkeleton,
} from "@/components/marketing/story/skeletons";

interface HeroProps {
  className?: string;
}

/**
 * Hero — the landing's opening composition (HERO-01..04, CONTEXT D-06..D-12,
 * UI-SPEC §Composition).
 *
 * A pure Server Component (no client directive) so `/` stays statically
 * prerendered — the whole hero is static markup, no client island.
 *
 * Centered vertical stack (D-06), top → bottom:
 *  1. serif voice H1 — "Know if it'll pop before you post" (verbatim D-09),
 *     Newsreader serif (D-10), the landing's ONE reserved serif slot.
 *  2. Inter mechanism subcopy naming the Simulation + the real outputs (D-11).
 *  3. CTA cluster — dominant coral "Try it free" → SIGNUP_URL (HERO-02) +
 *     a quieter "See how it works ↓" scroll-cue → #how-it-works (D-12).
 *  4. the product-shot SHOWCASE (HERO-03/04): a flat-warm desktop browser
 *     window (the Maven Simulation = the OUTPUT) with a phone in front (the
 *     TikTok you paste = the INPUT), reading left→right as paste → prediction.
 *     Both screens are swappable <Placeholder> slots (FOUND-03) — real
 *     desktop/mobile screenshots or video drop in via the one `src` prop later;
 *     the device chrome, layered shadows, and warm seat are permanent dressing.
 *
 * NOTE: this replaced the original bespoke canvas "crowd → score" signature
 * moment (the 02-02/02-03 plans). That direction read as a tech-demo, not a
 * premium product hero; per live craft review it was retired in favour of
 * showing the product itself (OpusClip/Vercel pattern). The canvas, the
 * ssr:false client boundary, ComposedStill, and hero-constants were removed.
 *
 * Coral is the lone accent and appears ONLY on the primary CTA.
 * Reference semantic tokens only — no hardcoded hex.
 */
export function Hero({ className }: HeroProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col items-center text-center",
        "gap-6 md:gap-8",
        className
      )}
    >
      {/* 1 — Serif voice headline (D-09 verbatim / D-10 Newsreader serif). */}
      <h1
        className={cn(
          "font-serif tracking-tight text-foreground",
          "max-w-[18ch] text-balance leading-tight",
          "text-4xl sm:text-hero md:text-display"
        )}
      >
        Know if it&apos;ll pop before you post
      </h1>

      {/* 2 — Inter mechanism subcopy (D-11): names the Simulation + the real
          outputs. Cream-secondary so it sits under the H1. No coral here. */}
      <p className="max-w-[52ch] text-base text-foreground-secondary md:text-lg">
        Paste any TikTok and a synthetic audience{" "}
        <span className="text-foreground">simulates</span> the reaction — your
        virality score, watch-through, and the exact moment viewers drop, before
        you post.
      </p>

      {/* 3 — CTA cluster (D-12): dominant coral primary + a subordinate
          scroll-cue. The cue must NOT compete with the primary. */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <Button variant="primary" size="lg" asChild>
          <Link href={SIGNUP_URL}>Try it free</Link>
        </Button>

        <a
          href="#how-it-works"
          className={cn(
            // ≥44px tappable area on mobile (a11y floor) without competing
            // with the primary: cream-muted text, no fill, no coral.
            "inline-flex min-h-[44px] items-center justify-center px-2",
            "text-sm text-foreground-muted transition-colors hover:text-foreground-secondary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          See how it works ↓
        </a>
      </div>

      {/* 4 — Hero showcase: the product, shown. desktop window = the Maven
          SIMULATION (output) · phone in front = the TikTok you paste (input).
          Reads left→right as paste → prediction. The window body renders the
          03-04 skeleton dashboard until a real screenshot exists; the phone
          stays a swappable <Placeholder> slot (FOUND-03). Device chrome,
          depth, and seating are permanent set-dressing. */}
      <div className="relative mt-6 w-full max-w-5xl pb-6 sm:pb-10">
        {/* Soft warm seat — a faint matte pool that floats the composition off
            the flat page (cream at very low alpha; NOT a glow). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-20 -inset-y-12 -z-10"
          style={{
            background:
              "radial-gradient(68% 60% at 50% 36%, rgba(236,231,222,0.07), transparent 70%)",
          }}
        />

        {/* Desktop window — the Simulation (output). Inset from the left so the
            phone overlaps the lower-right without crowding. Frame is the
            lightest surface so it reads as a window floating on the page. */}
        <div className="mr-auto w-[88%] sm:w-[84%]">
          <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-[0_40px_80px_-24px_rgba(0,0,0,0.72),0_14px_30px_-12px_rgba(0,0,0,0.5)]">
            {/* window chrome — slim browser bar (inherits the frame surface) */}
            <div className="flex items-center border-b border-border px-4 py-2.5">
              <span className="flex gap-2" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
              </span>
              <span className="mx-auto rounded-md bg-background px-4 py-1 font-mono text-[11px] tracking-wide text-foreground-muted">
                maven.app
              </span>
              {/* spacer keeps the address pill optically centered vs the dots */}
              <span className="w-[42px]" aria-hidden="true" />
            </div>
            {/* window body — filled with the 03-04 product-skeleton primitives
                so the FOLD shows the product's shape, not an empty 16/10 void
                (same GAP-2 rationale as simulation-showcase.tsx, different
                composition: a dashboard with a main chart column + a score/
                audience side rail, so the hero and the showcase don't read as
                the same frame twice). Height-capped + overflow-hidden so the
                mobile stack crops instead of towering. Still swappable for a
                real desktop screenshot later (FOUND-03) — this block is the
                `src` slot. */}
            <div className="flex max-h-[520px] flex-col gap-6 overflow-hidden bg-surface p-6 md:flex-row md:gap-8 md:p-8">
              {/* side rail — the hero number + the crowd. First in DOM so the
                  mobile crop keeps gauge + drivers visible; md pushes it right. */}
              <div className="flex shrink-0 flex-col items-center gap-6 md:order-2 md:w-[220px]">
                <ScoreGaugeSkeleton />
                {/* cloud is md+ only: at full mobile width it grows ~270px tall
                    and eats the whole capped window. */}
                <AudienceCloudSkeleton className="hidden w-full md:flex" />
              </div>
              {/* main column — the three levers + where viewers drop. */}
              <div className="flex min-w-0 flex-1 flex-col gap-6 md:order-1">
                <DriverRowsSkeleton />
                <RetentionCurveSkeleton />
              </div>
            </div>
          </div>
        </div>

        {/* Phone — your TikTok (input), in front of the window's lower-right.
            Sibling of the window (not a child) so it overflows cleanly; its own
            deeper shadow + a hairline ring read as "in front". */}
        <div className="absolute bottom-0 right-0 w-[16.5%] min-w-[104px] sm:right-4">
          <div className="overflow-hidden rounded-[1.8rem] border-[5px] border-background-elevated bg-background-elevated shadow-[0_28px_52px_-14px_rgba(0,0,0,0.85)] ring-1 ring-border">
            <Placeholder
              variant="video"
              aspect="9/16"
              label="Your TikTok"
              className="rounded-[1.55rem] border-0 bg-surface"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
