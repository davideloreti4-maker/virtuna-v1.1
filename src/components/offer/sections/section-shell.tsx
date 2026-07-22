import { cn } from "@/lib/utils";

/**
 * Shared section primitives for the /go offer page — one grid, one spacing
 * system, one heading rhythm so every section below the hero reads as a set,
 * while `tone` + `align` give each section its own silhouette (so the arc never
 * reads as one flat, repeating block).
 *
 * Pure RSC (no client directive) — safe to compose inside client section
 * components or render directly from the server page. Flat-warm tokens only:
 * matte, cream text, NO coral (accent stays precious to the hero + the one lit
 * pricing destination). Serif stays reserved for the hero + the final
 * close-line — section headings are Inter, matching the app chrome.
 */

interface SectionProps {
  id?: string;
  className?: string;
  /** A faint hairline divider at the top, to separate tone-zones. */
  divider?: boolean;
  /**
   * Full-bleed background band. "sunken"/"surface" paint the whole viewport
   * width behind the contained content, so alternating sections read as
   * distinct tone-zones instead of one continuous scroll. Content stays in the
   * shared max-w-6xl measure regardless.
   */
  tone?: "default" | "sunken" | "surface";
  /** Tighten the vertical rhythm (bands that sit flush against a neighbour). */
  compact?: boolean;
  children: React.ReactNode;
}

export function Section({
  id,
  className,
  divider = false,
  tone = "default",
  compact = false,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative",
        // keep an anchored heading clear of the fixed floating nav
        id && "scroll-mt-24 md:scroll-mt-28",
        divider && "border-t border-border",
        tone === "sunken" && "bg-surface-sunken",
        tone === "surface" && "bg-surface",
      )}
    >
      <div
        className={cn(
          "relative mx-auto max-w-6xl px-5",
          compact ? "py-14 md:py-20" : "py-20 md:py-28",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}

interface SectionHeadingProps {
  /** Mono-free uppercase kicker in the HERO style, for tonal match. */
  eyebrow: string;
  /** The section `<h2>`. Inter, never serif. */
  title: React.ReactNode;
  /** Optional supporting line under the title. */
  sub?: React.ReactNode;
  /** Center (default) or left-align — left pairs with split/asymmetric layouts. */
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
  className,
}: SectionHeadingProps) {
  const left = align === "left";
  return (
    <div className={cn(left ? "max-w-2xl text-left" : "mx-auto max-w-2xl text-center", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-[clamp(1.7rem,3.6vw,2.4rem)] font-semibold leading-[1.1] tracking-tight text-foreground text-balance">
        {title}
      </h2>
      {sub && (
        <p
          className={cn(
            "mt-4 max-w-[48ch] text-[16px] leading-relaxed text-foreground-secondary",
            !left && "mx-auto",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
