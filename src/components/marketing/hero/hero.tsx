import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL } from "@/lib/routes";

import { HERO_SCORE } from "./hero-constants";
import { ComposedStill } from "./composed-still";
import { SignatureMomentClient } from "./signature-moment-client";

interface HeroProps {
  className?: string;
}

/**
 * Hero — the landing's opening composition (HERO-01 + HERO-02, CONTEXT
 * D-06..D-12, UI-SPEC §Composition).
 *
 * A pure Server Component (no client directive) so `/` stays statically
 * prerendered. Hero renders the `"use client"` <SignatureMomentClient/>
 * boundary as a CHILD — the `dynamic(ssr:false)` call lives inside THAT
 * module, never here (Next.js 16 forbids lazy ssr-disabled imports inside a
 * Server Component; RESEARCH Pitfall 1 / Pattern 1). This file only composes
 * static markup + mounts the SSR floor and the client island.
 *
 * Centered vertical stack (D-06), top → bottom:
 *  1. serif voice H1 — "Know if it'll pop before you post" (verbatim D-09),
 *     Newsreader serif (D-10), the landing's ONE reserved serif slot.
 *  2. Inter mechanism subcopy naming the Simulation + the real outputs (D-11).
 *  3. CTA cluster — dominant coral "Try it free" → SIGNUP_URL (HERO-02) +
 *     a quieter "See how it works ↓" scroll-cue → #how-it-works (D-12).
 *  4. the contained flat-warm STAGE (D-07): tone-step surface, hairline 6%
 *     border, 12px radius, dimension-locked (inline aspect-ratio → no CLS)
 *     so the signature moment mounts later with zero layout shift (Pitfall 3).
 *
 * Coral is the lone accent and appears ONLY on the primary CTA in this plan.
 * Reference semantic tokens only — no hardcoded hex (Pitfall 4).
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
      <p className="max-w-[60ch] text-base text-foreground-secondary md:text-lg">
        Paste a TikTok and a synthetic audience{" "}
        <span className="text-foreground">simulates</span> the reaction —
        watch-through&nbsp;%, Hook, Retention, Shareability, and a virality
        score, before you post.
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
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          See how it works ↓
        </a>
      </div>

      {/* 4 — The contained flat-warm STAGE (D-07): the arena the signature
          "crowd → score" moment coalesces within. Dimension-locked via an
          inline aspect-ratio so the canvas/still mount with no CLS (Pitfall 3).
          Tone-step surface + hairline 6% border + 12px radius — flat-matte
          (no glass/shine/glow). `relative` so the client island overlays the
          still in the SAME box.

          Two layers, stacked in this one dimension-locked box (D-15/D-16):
           • <ComposedStill> — the RSC universal floor (phone + settled dots +
             clean coral arc ring + final score). Paints pre-hydration, zero JS;
             it is also the reduced-motion / mobile / at-rest frame.
           • <SignatureMomentClient> — the "use client" boundary. On desktop +
             motion-OK it lazy-mounts the canvas (its `dynamic(ssr:false)` lives
             inside that module) ABSOLUTELY OVER the still and plays once; under
             reduced-motion / mobile / low-GPU it renders nothing and the still
             stands. The phone now lives INSIDE ComposedStill. Hero stays an RSC. */}
      <div
        className={cn(
          "relative mt-2 flex w-full items-center justify-center overflow-hidden",
          "rounded-[--radius-lg] border border-border bg-surface",
          "p-6 md:p-8"
        )}
        style={{ aspectRatio: "16 / 10" }}
      >
        <ComposedStill score={HERO_SCORE} />
        <SignatureMomentClient score={HERO_SCORE} />
      </div>
    </div>
  );
}
