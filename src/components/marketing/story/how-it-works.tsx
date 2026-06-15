import * as React from "react";

import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
import {
  ScoreGaugeSkeleton,
  AudienceCloudSkeleton,
  PhoneChrome,
} from "@/components/marketing/story/skeletons";
import { cn } from "@/lib/utils";

/**
 * HowItWorks — STORY-01, the calm opener of the scroll body (CONTEXT D-A noun
 * discipline, 03-RESEARCH § Pattern 3, 03-PATTERNS § how-it-works.tsx).
 *
 * A PURE Server Component (no client directive of any kind) so `/` stays
 * statically prerendered — only the `StaggerReveal` entrance is a client leaf,
 * imported as an island. (We use the named `StaggerRevealItem` export rather
 * than the `StaggerReveal.Item` static prop: a client component's static
 * properties do not survive the RSC→client boundary at prerender, so the
 * static-prop form yields `undefined` and crashes `next build` on `/`.)
 * Explains the loop in three calm beats, mirroring the hero subcopy:
 *   1. Paste a TikTok link
 *   2. The audience reacts (a synthetic audience simulates the reaction)
 *   3. Get your Simulation
 *
 * Each step pairs a small mono numeral + a section-appropriate static product
 * skeleton (03-04) inside an aspect-stable wrapper (no layout shift) + a sans
 * title + one Inter line of copy. The three step visuals hint the loop's shape:
 *   1. Paste a TikTok link   → a PhoneChrome with a faux URL-input row
 *   2. The audience reacts   → AudienceCloudSkeleton
 *   3. Get your Simulation   → ScoreGaugeSkeleton (the prediction shape)
 *
 * Each visual wrapper carries `data-step-visual` (the stable count hook the
 * 03-00 test uses to gate "exactly 3 step visuals", since the skeleton
 * primitives carry no `data-variant`) and an `aspect-[16/10]` box so mount
 * introduces no layout shift.
 *
 * Noun discipline (D-A): the product noun is "Simulation" (verb "simulates").
 * The retired product noun is never used as a user-facing label here.
 *
 * The section heading is SANS `font-semibold` (D-C / A3) — the Newsreader serif
 * stays precious to the hero. Coral is NOT used here (A6 — keep it precious).
 * Reference semantic tokens only — no hardcoded hex, no glass/glow/blur.
 */

interface Step {
  n: string;
  ordinal: string;
  title: string;
  body: string;
  /** The section-appropriate static product skeleton for this step. */
  visual: React.ReactNode;
}

const STEPS: readonly Step[] = [
  {
    n: "1",
    ordinal: "01",
    title: "Paste a TikTok link",
    body: "Drop any TikTok URL — no upload, no waiting.",
    // a small phone bezel with a faux URL-input row hinting the pasted link
    visual: (
      <PhoneChrome className="mx-auto h-full w-1/2 max-w-[120px]">
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="h-6 rounded-md border border-border bg-surface" />
          <div className="h-2 w-3/4 rounded-full bg-foreground-muted/20" />
          <div className="h-2 w-1/2 rounded-full bg-foreground-muted/15" />
        </div>
      </PhoneChrome>
    ),
  },
  {
    n: "2",
    ordinal: "02",
    title: "The audience reacts",
    body: "A synthetic audience watches your video and reacts, frame by frame.",
    visual: <AudienceCloudSkeleton className="w-full px-2" />,
  },
  {
    n: "3",
    ordinal: "03",
    title: "Get your Simulation",
    body: "A score, watch-through %, and where viewers drop — before you post.",
    visual: <ScoreGaugeSkeleton />,
  },
] as const;

export function HowItWorks({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* Section title — SANS font-semibold (D-C / A3); serif reserved to hero. */}
      <h2 className="text-3xl font-semibold text-foreground">How it works</h2>

      {/* Three calm beats, left→right on desktop, stacking on mobile. The only
          motion is the StaggerReveal entrance (client leaf, self-gates reduce). */}
      <StaggerReveal className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
        {STEPS.map((s) => (
          <StaggerRevealItem key={s.n} className="flex flex-col gap-4">
            {/* mono ordinal marker — cream-muted, encodes step order */}
            <span className="font-mono text-sm text-foreground-muted">
              {s.ordinal}
            </span>

            {/* the static product skeleton in an aspect-stable box (no-CLS).
                `data-step-visual` is the stable count hook the 03-00 test gates
                "exactly 3 step visuals" on (skeletons carry no data-variant). */}
            <div
              data-step-visual
              className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[--radius-lg] border border-border bg-surface-elevated p-4"
            >
              {s.visual}
            </div>

            {/* step title — sans, cream */}
            <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>

            {/* one Inter line of copy — cream-secondary */}
            <p className="text-base text-foreground-secondary">{s.body}</p>
          </StaggerRevealItem>
        ))}
      </StaggerReveal>
    </div>
  );
}
