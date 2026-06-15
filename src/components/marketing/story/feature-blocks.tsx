import * as React from "react";

import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
import {
  ScoreGaugeSkeleton,
  AudienceCloudSkeleton,
  DriverRowsSkeleton,
} from "@/components/marketing/story/skeletons";
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

const FEATURES: readonly Feature[] = [
  {
    title: "Know before you post",
    body: "A clear score and the why behind it — so you never gamble on a guess again.",
    visual: <ScoreGaugeSkeleton />,
  },
  {
    title: "See exactly where viewers drop",
    body: "Watch-through, frame by frame, with the precise moment attention slips away.",
    visual: <DriverRowsSkeleton className="w-full px-2" />,
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
      {/* Section title — SANS the serif (D-C / A3); serif reserved to the hero. */}
      <h2 className="text-3xl font-semibold text-foreground">
        Everything you need to know before you post
      </h2>

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
