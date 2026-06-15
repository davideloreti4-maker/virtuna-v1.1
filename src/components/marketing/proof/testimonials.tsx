import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
import { cn } from "@/lib/utils";

import { TestimonialCard } from "./testimonial-card";

/**
 * Testimonials — PROOF-02: static 3-card testimonials grid (D-06/D-07, 04-RESEARCH).
 *
 * Composition:
 *  - Sans-serif <h2> section heading (serif reserved to hero + band close-line, D-13).
 *  - Static 3-card grid (grid-cols-1 md:grid-cols-3) — NOT a carousel (D-06).
 *  - EXACTLY 3 TESTIMONIALS entries mapped through TestimonialCard inside
 *    StaggerRevealItem (named export — StaggerReveal.Item is the RSC-boundary
 *    landmine, Pitfall 1).
 *
 * Token discipline: cream tokens only, NO coral (no CTA here), NO glass/glow/blur,
 * NO text-white, NO hardcoded hex. Pure RSC — no "use client".
 *
 * The TESTIMONIALS data uses drafted/fictional placeholder copy per D-21 (FICTIONAL
 * placeholders — no real PII; swapped for real assets post-launch, T-04-01-01).
 */

interface Testimonial {
  quote: string;
  name: string;
  handle: string;
  metric: string;
}

const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "I ran my last three TikToks through Numen before posting. The one with the highest Simulation score pulled 2.3M views in 48 hours. I don't post without it now.",
    name: "Maya Chen",
    handle: "mayachen.creates",
    metric: "+2.3M views on the first verified post",
  },
  {
    quote:
      "My hook rate was quietly killing me — Numen showed me exactly where viewers were tapping away at second four. Fixed that, tripled my follow-throughs overnight.",
    name: "Jordan Ellis",
    handle: "jordanellis",
    metric: "3× hook completion rate after one fix",
  },
  {
    quote:
      "OpusClip told me what performed. Numen tells me WHY — and what to change before I even film. That's a different product entirely.",
    name: "Priya Sharma",
    handle: "priyacreates",
    metric: "First 100k-view post within two weeks",
  },
] as const;

export function Testimonials({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* Section heading — SANS font-semibold (D-13 / A3); serif reserved to hero. */}
      <h2 className="text-3xl font-semibold text-foreground">
        What creators say
      </h2>

      {/* Static 3-card grid — the only motion is the StaggerReveal entrance. */}
      <StaggerReveal
        className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3"
      >
        {TESTIMONIALS.map((t) => (
          <StaggerRevealItem key={t.handle}>
            <TestimonialCard
              quote={t.quote}
              name={t.name}
              handle={t.handle}
              metric={t.metric}
            />
          </StaggerRevealItem>
        ))}
      </StaggerReveal>
    </div>
  );
}
