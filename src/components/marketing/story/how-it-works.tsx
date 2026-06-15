import { StaggerReveal } from "@/components/motion";
import { Placeholder } from "@/components/marketing/placeholder";
import { cn } from "@/lib/utils";

/**
 * HowItWorks — STORY-01, the calm opener of the scroll body (CONTEXT D-A noun
 * discipline, 03-RESEARCH § Pattern 3, 03-PATTERNS § how-it-works.tsx).
 *
 * A PURE Server Component (no client directive of any kind) so `/` stays
 * statically prerendered — only the `StaggerReveal` entrance is a client leaf,
 * imported as an island. Explains the loop in three calm beats, mirroring the
 * hero subcopy:
 *   1. Paste a TikTok link
 *   2. The audience simulates
 *   3. Get your Simulation
 *
 * Each step pairs a small mono numeral + a labelled, aspect-locked <Placeholder>
 * product visual (swappable later via `src`, no layout shift) + a sans title +
 * one Inter line of copy.
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
  slot: {
    variant: "image";
    aspect: string;
    label: string;
  };
}

const STEPS: readonly Step[] = [
  {
    n: "1",
    ordinal: "01",
    title: "Paste a TikTok link",
    body: "Drop any TikTok URL — no upload, no waiting.",
    slot: { variant: "image", aspect: "16/10", label: "Paste a link" },
  },
  {
    n: "2",
    ordinal: "02",
    title: "The audience reacts",
    body: "A synthetic audience watches your video and reacts, frame by frame.",
    slot: { variant: "image", aspect: "16/10", label: "Audience reacting" },
  },
  {
    n: "3",
    ordinal: "03",
    title: "Get your Simulation",
    body: "A score, watch-through %, and where viewers drop — before you post.",
    slot: { variant: "image", aspect: "16/10", label: "Your prediction" },
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
          <StaggerReveal.Item key={s.n} className="flex flex-col gap-4">
            {/* mono ordinal marker — cream-muted, encodes step order */}
            <span className="font-mono text-sm text-foreground-muted">
              {s.ordinal}
            </span>

            {/* the swappable product visual — labelled + aspect-locked (no-CLS) */}
            <Placeholder {...s.slot} />

            {/* step title — sans, cream */}
            <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>

            {/* one Inter line of copy — cream-secondary */}
            <p className="text-base text-foreground-secondary">{s.body}</p>
          </StaggerReveal.Item>
        ))}
      </StaggerReveal>
    </div>
  );
}
