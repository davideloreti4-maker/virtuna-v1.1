import * as React from "react";

import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
import {
  ScoreGaugeSkeleton,
  AudienceCloudSkeleton,
  DriverRowsSkeleton,
  RetentionCurveSkeleton,
} from "@/components/marketing/story/skeletons";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

import { FeatureBlock } from "./feature-block";

/**
 * FeatureBlocks — STORY-03, the feature deep-dive section that closes the story
 * body (03-RESEARCH § Pattern 5, 03-PATTERNS § feature-blocks.tsx). It turns the
 * abstract "what you get" into concrete benefits, each shown through a swappable
 * product frame (OpusClip/Linear feature-deep-dive pattern).
 *
 * A PURE Server Component (no client directive of any kind) so `/` stays
 * statically prerendered — only the `StaggerReveal` entrance is a client leaf,
 * imported as an island. (We use the named `StaggerRevealItem` export rather
 * than the `StaggerReveal.Item` static prop: a client component's static
 * properties do not survive the RSC→client boundary at prerender, so the
 * static-prop form yields `undefined` and crashes `next build` on `/` — the
 * 03-01 landmine, carried.)
 *
 * It maps a module-level FEATURES const of four benefits through <FeatureBlock>,
 * flipping the column order on alternate rows (`flip={i % 2 === 1}`) so the
 * visual side alternates left/right down the section. Each block pairs a benefit
 * headline (level-3) with exactly one intentional product skeleton (03-04),
 * framed in BrowserChrome so the visual reads as product set-dressing rather than
 * a flat empty box (GAP-1/GAP-3 component-level). Inter-row spacing is denser
 * (`gap-12 md:gap-16`) so the rows feel connected (GAP-3); page-level outer
 * whitespace is 03-06's job (this section does not touch page.tsx).
 *
 * Noun discipline (D-09 carried): the product noun is "Simulation"; the retired
 * noun is never used. The banned headline words "viral" and "AI" are avoided.
 *
 * The section heading is SANS `font-semibold` (D-C / A3) — the Newsreader serif
 * stays precious to the hero. Coral is NOT used here (A6 — keep it precious).
 * Reference semantic tokens only — no hardcoded hex, no glass/glow/blur. No
 * import from the retired product UI (board/reading/viral-results) or any engine
 * or data hook (anti-pattern guard).
 */

interface Feature {
  /** Benefit headline (renders as a level-3 heading). */
  title: string;
  /** One tight Inter line naming the real benefit. */
  body: string;
  /** The intentional product skeleton shown in this row's framed visual. */
  visual: React.ReactNode;
}

/**
 * Row-1 visual — the score AND the why beside it (the copy promises "a clear
 * score and the why behind it"; a lone gauge only showed the score). Three
 * compact unlabelled-value rows — label + thin bar — deliberately LIGHTER than
 * row-4's full DriverRowsSkeleton (no captions, no coral) so the two rows read
 * as different depths of the same instrument, not a repeat.
 */
function ScoreWithWhy() {
  const why = [
    { label: "Hook", w: "w-[82%]" },
    { label: "Retention", w: "w-[54%]" },
    { label: "Shareability", w: "w-[71%]" },
  ];
  return (
    <div className="flex w-full items-center justify-center gap-8 md:gap-10">
      <ScoreGaugeSkeleton className="shrink-0" />
      <div
        className="flex w-full max-w-[220px] flex-col gap-3"
        aria-hidden="true"
      >
        {why.map((r) => (
          <div key={r.label} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground-muted">
              {r.label}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground-muted/15">
              <div
                className={cn(
                  "h-full rounded-full bg-foreground-secondary/80",
                  r.w
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURES: readonly Feature[] = [
  {
    title: "Know before you post",
    body: "A clear score and the why behind it — so you never gamble on a guess again.",
    visual: <ScoreWithWhy />,
  },
  {
    title: "See exactly where viewers drop",
    body: "Watch-through, frame by frame, with the precise moment attention slips away.",
    visual: <RetentionCurveSkeleton className="px-2" />,
  },
  {
    title: "Understand your audience",
    body: "A synthetic crowd reacts to your video the way real viewers will — before a single real one sees it.",
    visual: <AudienceCloudSkeleton className="w-full px-2" />,
  },
  {
    title: "Fix the weakest lever",
    body: "Hook, Retention, and Shareability scored side by side — so you know what to sharpen first.",
    visual: <DriverRowsSkeleton className="w-full px-2" />,
  },
] as const;

export function FeatureBlocks({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* Section heading — eyebrow kicker + SANS h2 (D-C / A3); serif reserved
          to the hero. */}
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to know before you post"
      />

      {/* The alternating deep-dive rows. The only motion is the StaggerReveal
          entrance (client leaf, self-gates reduced-motion). Denser vertical
          rhythm between rows (gap-12 md:gap-16, GAP-3) so they read connected,
          not stranded; each row stacks on mobile by construction. */}
      <StaggerReveal className="mt-16 flex flex-col gap-12 md:gap-16">
        {FEATURES.map((f, i) => (
          <StaggerRevealItem key={f.title}>
            <FeatureBlock
              title={f.title}
              body={f.body}
              visual={f.visual}
              flip={i % 2 === 1}
            />
          </StaggerRevealItem>
        ))}
      </StaggerReveal>
    </div>
  );
}
