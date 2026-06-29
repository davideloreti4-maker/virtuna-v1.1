import { cn } from "@/lib/utils";

import { SectionHeading } from "@/components/marketing/section-heading";
import { FaqAccordion } from "./faq-accordion";

/**
 * Faq — CONVERT-03 RSC section wrapper (STORY-02 / 04-RESEARCH § Pattern 2).
 *
 * A PURE Server Component (no "use client") so the page root + this heading
 * stay RSC and / stays statically prerendered (T-04-03-02 / Pitfall 5).
 * The only client subtree is the FaqAccordion island below.
 *
 * - Section heading: sans-serif font-semibold (Newsreader serif stays precious
 *   to the hero + CTA band — D-C / A3).
 * - Mounts FaqAccordion as the lone client island for Radix keyboard a11y.
 * - Flat-warm tokens only: text-foreground / text-foreground-secondary, no coral,
 *   no glass, no hex. (Coral reserved for CTAs.)
 */
export function Faq({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      {/* Section heading — eyebrow kicker + SANS h2; serif + coral reserved elsewhere. */}
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />

      {/* One-line cream-secondary subhead — grounds the section without overselling. */}
      <p className="mt-3 text-base text-foreground-secondary">
        Everything you need to know before your first Simulation.
      </p>

      {/* The lone client island: Radix single-open accordion, 6 objection Q&As. */}
      <FaqAccordion className="mt-10" />
    </div>
  );
}
