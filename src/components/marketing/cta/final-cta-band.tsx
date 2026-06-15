import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL } from "@/lib/routes";
import { ScoreGaugeSkeleton } from "@/components/marketing/story/skeletons";

interface FinalCtaBandProps {
  className?: string;
}

/**
 * FinalCtaBand — full-bleed closing CTA section (CONVERT-02, D-12/D-13/D-14/D-20).
 *
 * Phase 4's single serif moment (D-13): the Newsreader serif voice close-line
 * mirrors the hero headline, bookending the page in the same voice.
 *
 * Structure:
 *  - Full-bleed surface (bg-surface-elevated + hairline border-border) that
 *    breaks the page's inner measure — 04-05 mounts it in a <section> with NO
 *    max-w-5xl, so the band spans the viewport.
 *  - Legal flat-warm warm-seat radial (cream tone-step, NOT a coral glow),
 *    copied verbatim from hero.tsx / simulation-showcase.tsx.
 *  - Inner content mx-auto max-w-3xl text-center.
 *  - ScoreGaugeSkeleton echo (D-14) — the Phase-3 primitive, small + muted;
 *    ties the close back to the instrument without competing with the CTA.
 *  - Newsreader-serif close-line (data-testid="cta-close-line").
 *  - One dominant coral CTA → SIGNUP_URL via Button asChild + Link.
 *  - D-20 risk-reducer microcopy.
 *
 * Pure RSC — no "use client". Coral confined to the CTA; no glass/blur/glow.
 * Token discipline: flat-warm tokens only; the only explicit rgba values are
 * the verbatim legal warm-seat radial + the DARK-shadow depth from the
 * showcase precedent.
 */
export function FinalCtaBand({ className }: FinalCtaBandProps) {
  return (
    <div
      className={cn(
        "relative w-full border-y border-border bg-surface-elevated",
        "py-20 md:py-28",
        // Layered dark-shadow depth (NOT a glow) — same precedent as the
        // showcase frame's `shadow-[0_40px_80px_-24px_rgba(0,0,0,0.72),...]`.
        "shadow-[0_-40px_80px_-24px_rgba(0,0,0,0.48)]",
        className
      )}
    >
      {/* Legal flat-warm warm-seat radial — a low-alpha CREAM tone-step, NOT a
          coral glow. Copied VERBATIM from hero.tsx lines 99-108 / simulation-
          showcase.tsx lines 92-100. rgba(236,231,222,0.07) = 7% cream opacity. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(68% 60% at 50% 36%, rgba(236,231,222,0.07), transparent 70%)",
        }}
      />

      {/* Inner content — centered, max-w-3xl, text-center. */}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 text-center">
        {/* D-14 — ScoreGaugeSkeleton echo: the Phase-3 primitive, small + muted.
            Ties the close back to the score instrument without competing with
            the CTA. Placed above the close-line for visual anchoring. */}
        <ScoreGaugeSkeleton className="opacity-70 scale-75" />

        {/* D-13 — Newsreader-serif voice close-line (Phase 4's single serif
            moment). Mirrors the hero headline's font-serif token so the page
            opens and closes in the same voice. data-testid for the gate. */}
        <h2
          data-testid="cta-close-line"
          className={cn(
            "font-serif tracking-tight text-foreground",
            "max-w-[22ch] text-balance leading-tight",
            "text-3xl sm:text-4xl md:text-5xl"
          )}
        >
          Your audience already knows. Find out before you post.
        </h2>

        {/* One dominant coral CTA (Button asChild → Link → SIGNUP_URL).
            Coral is the lone accent on this surface — confined to the CTA. */}
        <div className="flex flex-col items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href={SIGNUP_URL}>Try it free</Link>
          </Button>

          {/* D-20 risk-reducer microcopy — sits under the CTA, cream-muted,
              zero visual weight so it supports without competing. */}
          <p className="text-sm text-foreground-muted">
            Free to start — no credit card
          </p>
        </div>
      </div>
    </div>
  );
}
