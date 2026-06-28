import { cn } from "@/lib/utils";

/**
 * SectionHeading — the shared editorial heading lockup for the marketing story
 * sections (Chunk-3 polish). A small mono uppercase EYEBROW kicker (with a short
 * leading rule) over the section `<h2>`, giving every section a consistent
 * premium rhythm instead of a bare left-aligned title.
 *
 * Pure RSC — no client directive. Flat-warm tokens only:
 *  - eyebrow: cream-muted mono, wide tracking; the leading rule is cream-muted.
 *  - title: cream sans `font-semibold`, bumped to 4xl on md for presence. The
 *    Newsreader serif stays precious to the hero + CTA band (D-13) — NOT used.
 *  - NO coral (accent stays precious to CTAs). NO glass/glow/hex.
 *
 * The eyebrow is a `<p>` (NOT a heading) so it never disturbs the heading-level
 * assertions the section gates rely on (each section keeps exactly one `<h2>`,
 * and per-item `<h3>` counts are unchanged). Callers MUST choose eyebrow copy
 * that does not collide with a section's asserted token (e.g. the Simulation
 * showcase keeps "The Simulation" as its sole /simulat/i node, so its eyebrow
 * must not contain "simulat").
 */
export interface SectionHeadingProps {
  /** Mono uppercase kicker above the title (a category label). */
  eyebrow: string;
  /** The section `<h2>` text. */
  title: string;
  className?: string;
}

export function SectionHeading({ eyebrow, title, className }: SectionHeadingProps) {
  return (
    <div className={cn(className)}>
      <p className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-foreground-muted">
        <span aria-hidden="true" className="h-px w-6 bg-foreground-muted/40" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
    </div>
  );
}
