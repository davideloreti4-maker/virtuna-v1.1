import { cn } from "@/lib/utils";
import { GRAIN_URL } from "@/components/offer/atmosphere";

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
      <SectionTexture tone={tone} />
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

/**
 * The behind-content texture layer — a faint tooth so the matte grounds never
 * read dead-flat. Every section gets a whisper of grain; the toned bands
 * additionally get a masked dot-grid + a soft top-edge seam so the tone-zones
 * feel crafted, not just recolored. Painted BELOW the content (both this and the
 * content wrapper are positioned; DOM order puts content on top). Restraint is
 * the point — enough to catch light, never enough to compete with the copy.
 */
function SectionTexture({ tone }: { tone: "default" | "sunken" | "surface" }) {
  const toned = tone !== "default";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* grain — on every section */}
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-soft-light"
        style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: "150px 150px" }}
      />
      {/* dot-grid — on every section (ties back to the hero), faded toward the
          seams so it never hard-edges; a touch stronger on the toned bands */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px,rgba(236,231,222,${
            toned ? "0.045" : "0.03"
          }) 1px,transparent 0)`,
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(125% 78% at 50% 42%,#000 34%,transparent 88%)",
          WebkitMaskImage: "radial-gradient(125% 78% at 50% 42%,#000 34%,transparent 88%)",
        }}
      />
      {toned && (
        /* soft cream top-edge seam — a crafted band edge (matte, no glow) */
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg,transparent,rgba(236,231,222,0.07),transparent)",
          }}
        />
      )}
    </div>
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
