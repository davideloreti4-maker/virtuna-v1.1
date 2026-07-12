import * as React from "react";
import { Link2 } from "lucide-react";

import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
import { SectionHeading } from "@/components/marketing/section-heading";
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
 * title + one Inter line of copy. The three step visuals hint the loop's shape
 * with LIGHT process-flavoured mocks (deliberately distinct from the full
 * product views in the Simulation/Feature sections so the opener never echoes
 * them):
 *   1. Paste a TikTok link   → PasteLinkRow (a focused URL-input paste moment)
 *   2. The audience reacts   → ReactionRows (a compact viewers-reacting feed)
 *   3. Get your Simulation   → ResultCard (a compact score-report card)
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

/**
 * Step-1 visual — a paste-the-link moment: a focused URL input row holding a
 * mono tiktok.com address + a static text caret, over a dimmed ghost of the
 * previous row. Reads as "drop the URL here" at a glance — the old phone-bezel
 * mock read as a murky charcoal silhouette and said nothing about pasting.
 */
function PasteLinkRow() {
  return (
    <div className="flex w-full max-w-[260px] flex-col gap-2">
      {/* the focused input row — link glyph + mono URL + a static caret bar */}
      <div className="flex items-center gap-2 rounded-md border border-border-hover/40 bg-background px-3 py-2.5">
        <Link2
          className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="truncate font-mono text-[11px] text-foreground-secondary">
          tiktok.com/@you/video/72…
        </span>
        {/* static caret — a thin cream bar, no animation */}
        <span
          className="h-3.5 w-px shrink-0 bg-foreground-secondary/80"
          aria-hidden="true"
        />
      </div>
      {/* dimmed ghost row — yesterday's link, seats the input in a real UI */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5 opacity-45">
        <Link2
          className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="h-1.5 w-2/3 rounded-full bg-foreground-muted/25" />
      </div>
    </div>
  );
}

/**
 * Step-2 visual — a compact "viewers reacting" mini-feed (avatar + two text
 * lines + a reaction pip per row, one row carrying the lone coral pip). A
 * deliberately DIFFERENT shape from the scatter persona-cloud shown in the
 * Simulation showcase below, so the opener doesn't echo the product section.
 */
function ReactionRows() {
  const rows = [
    { w: "w-1/2", accent: false },
    { w: "w-2/3", accent: true },
    { w: "w-2/5", accent: false },
  ];
  return (
    <div className="flex w-full flex-col gap-2.5 px-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span className="h-6 w-6 shrink-0 rounded-full bg-foreground-muted/20" />
          <div className="flex flex-1 flex-col gap-1">
            <span className={cn("h-1.5 rounded-full bg-foreground-muted/25", r.w)} />
            <span className="h-1.5 w-3/4 rounded-full bg-foreground-muted/12" />
          </div>
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              r.accent ? "bg-accent" : "bg-foreground-muted/25"
            )}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Step-3 visual — a compact result card (a score number + band word + three
 * thin result lines). A DIFFERENT shape from the circular score gauge in the
 * showcase/feature sections — reads as "the report you get back", not a repeat
 * of the gauge.
 */
function ResultCard() {
  return (
    <div className="flex w-full max-w-[180px] flex-col gap-2.5 rounded-[--radius-md] border border-border bg-surface px-3.5 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold leading-none text-foreground">
          87
        </span>
        <span className="text-xs font-medium text-foreground-secondary">
          Strong
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {["w-full", "w-4/5", "w-3/5"].map((w) => (
          <div key={w} className="flex items-center gap-2">
            <span className="h-1.5 w-1/4 shrink-0 rounded-full bg-foreground-muted/30" />
            <span className={cn("h-1.5 rounded-full bg-foreground-muted/15", w)} />
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS: readonly Step[] = [
  {
    n: "1",
    ordinal: "01",
    title: "Paste a TikTok link",
    body: "Drop any TikTok URL — no upload, no waiting.",
    // the paste moment: a focused URL-input row + a dimmed ghost row
    visual: <PasteLinkRow />,
  },
  {
    n: "2",
    ordinal: "02",
    title: "The audience reacts",
    body: "A synthetic audience watches your video and reacts, frame by frame.",
    visual: <ReactionRows />,
  },
  {
    n: "3",
    ordinal: "03",
    title: "Get your Simulation",
    body: "A score, watch-through %, and where viewers drop — before you post.",
    visual: <ResultCard />,
  },
] as const;

export function HowItWorks({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* Section heading — eyebrow kicker + SANS h2 (D-C / A3); serif reserved
          to hero. Eyebrow avoids /simulat/ so "Get your Simulation" stays the
          section's sole simulat node. */}
      <SectionHeading eyebrow="Three steps" title="How it works" />

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
