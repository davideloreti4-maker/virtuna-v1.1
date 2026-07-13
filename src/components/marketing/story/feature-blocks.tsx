import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
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
 * headline (level-3) with exactly one REAL capture of the running app, framed in
 * BrowserChrome. Inter-row spacing is denser (`gap-12 md:gap-16`) so the rows
 * feel connected (GAP-3); page-level outer whitespace is 03-06's job (this
 * section does not touch page.tsx).
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
  /** Public path of the app capture shown in this row's framed visual. */
  src: string;
  /** What the capture shows — the accessible name of the frame. */
  alt: string;
}

/**
 * Each row shows a DIFFERENT real surface of the app, so the four frames read
 * as one product seen from four angles rather than the same instrument four
 * times: a scored hook card → the retention curve opened on its drop → the room
 * that reacted → the three levers. All four are 2× crops at 16:10 (the frame's
 * ratio), captured with animations disabled.
 */
const FEATURES: readonly Feature[] = [
  {
    title: "Know before you post",
    body: "A clear score and the why behind it — so you never gamble on a guess again.",
    src: "/images/landing/feature-hook.png",
    alt: "A hook scored Strong — 7 of 10 viewers stopped — with the proven structure it follows and why it works",
  },
  {
    title: "See exactly where viewers drop",
    body: "Watch-through, frame by frame, with the precise moment attention slips away.",
    src: "/images/landing/feature-retention.png",
    alt: "The retention curve, opened on its biggest drop: −24% at 0:06, where cross-niche viewers leave",
  },
  {
    title: "Understand your audience",
    body: "A synthetic crowd reacts to your video the way real viewers will — before a single real one sees it.",
    src: "/images/landing/feature-audience.png",
    alt: "The people in the room and what they said — loyal fans stopped, new viewers said 'momentum stalls'",
  },
  {
    title: "Fix the weakest lever",
    body: "Hook, Retention, and Shareability scored side by side — so you know what to sharpen first.",
    src: "/images/landing/feature-drivers.png",
    alt: "Score drivers side by side: Hook 87, Retention 55 with a drop at 0:08, Shareability 64",
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
              src={f.src}
              alt={f.alt}
              flip={i % 2 === 1}
            />
          </StaggerRevealItem>
        ))}
      </StaggerReveal>
    </div>
  );
}
