import { Placeholder } from "@/components/marketing/placeholder";
import { cn } from "@/lib/utils";

/**
 * TestimonialCard — PROOF-02: bespoke flat-warm testimonial card (D-07 anatomy).
 *
 * Anatomy (D-07, 04-RESEARCH verbatim shape):
 *  - <article> outer card: rounded-[--radius-lg], border-border, bg-transparent,
 *    p-6, subtle white-5% inset boxShadow.
 *  - <blockquote> quote in text-foreground-secondary.
 *  - Result metric in text-foreground font-medium with data-testid="testimonial-metric"
 *    (the conversion lever — D-07/D-21).
 *  - Identity row: <Placeholder variant="avatar"> + name (text-foreground) + @handle
 *    (text-foreground-muted) with data-testid="testimonial-handle".
 *
 * Cold-brand LANDMINE (Pitfall 2): DO NOT import or copy from ui/testimonial-card.
 * That component uses oklch, border-border-hover, and a cold-brand anatomy (no @handle/metric).
 *
 * Token discipline: cream tokens only, NO text-white, NO hex, NO glass/glow/blur,
 * coral NOT used (no CTA in this section). Pure RSC — no "use client".
 */
export interface TestimonialCardProps {
  /** The creator's testimonial quote. */
  quote: string;
  /** Creator display name. */
  name: string;
  /** Creator @handle (without the @). */
  handle: string;
  /** Concrete result metric — the conversion lever (D-21). */
  metric: string;
  className?: string;
}

export function TestimonialCard({
  quote,
  name,
  handle,
  metric,
  className,
}: TestimonialCardProps) {
  return (
    <article
      className={cn(
        "rounded-[--radius-lg] border border-border bg-transparent p-6",
        className
      )}
      style={{ boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset" }}
    >
      {/* Quote — cream-secondary, the story the creator tells. */}
      <blockquote className="text-base text-foreground-secondary leading-relaxed">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Result metric — the concrete conversion lever (D-07/D-21). */}
      <p
        className="mt-4 text-sm font-medium text-foreground"
        data-testid="testimonial-metric"
      >
        {metric}
      </p>

      {/* Identity row — avatar + name + @handle. */}
      <div className="mt-6 flex items-center gap-3">
        <Placeholder variant="avatar" className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-none">
            {name}
          </p>
          <p
            className="mt-1 text-xs text-foreground-muted leading-none"
            data-testid="testimonial-handle"
          >
            @{handle}
          </p>
        </div>
      </div>
    </article>
  );
}
