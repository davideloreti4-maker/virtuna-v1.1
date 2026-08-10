import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Section — the page's structural unit, and the thing that keeps fourteen
 * blocks from reading as fourteen unrelated blocks.
 *
 * It owns three decisions so no individual section can drift from them:
 *   · the FULL-BLEED top hairline, with the content measure sitting inside it —
 *     the device that makes the page read as architected rather than as a stack
 *     of centred cards;
 *   · the vertical rhythm (`--lp-section-y`, fluid);
 *   · the heading block's internal spacing and its eyebrow → title → lead order.
 *
 * `tone="alt"` steps the band one shade down (#1a1a19). Alternation is by TONE
 * only, never by hue — a marketing page that changes colour between sections
 * stops feeling like one surface.
 */

interface SectionProps {
  id?: string;
  /** Mono kicker above the title. */
  eyebrow?: string;
  /** The section headline. Pass a fragment to place a `.lp-em` phrase inside. */
  title?: React.ReactNode;
  /** One supporting line under the title. */
  lead?: React.ReactNode;
  children: React.ReactNode;
  tone?: "base" | "alt";
  /** Centre the heading block. Defaults to left, which is the page's grain. */
  align?: "left" | "center";
  /** Use the wider measure — for bento grids and card walls. */
  wide?: boolean;
  /** Suppress the top hairline (for a section that follows a full-bleed band). */
  flush?: boolean;
  /**
   * Vertical breath. "compact" is for the quick sections — the problem jab,
   * the founder note — so the page's rhythm varies instead of every section
   * exhaling at the same rate.
   */
  density?: "default" | "compact";
  className?: string;
}

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  tone = "base",
  align = "left",
  wide,
  flush,
  density = "default",
  className,
}: SectionProps) {
  const hasHeading = Boolean(eyebrow || title || lead);

  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-24",
        !flush && "lp-rule",
        tone === "alt" && "lp-band-alt",
        className,
      )}
      style={{
        paddingBlock:
          density === "compact"
            ? "var(--lp-section-y-compact)"
            : "var(--lp-section-y)",
      }}
    >
      <div className={wide ? "lp-measure-wide" : "lp-measure"}>
        {hasHeading && (
          <Reveal
            className={cn(
              "flex flex-col",
              align === "center" && "items-center text-center",
            )}
          >
            {eyebrow && <p className="lp-eyebrow mb-5">{eyebrow}</p>}
            {title && <h2 className="lp-h2 max-w-[20ch]">{title}</h2>}
            {lead && (
              <p
                className={cn(
                  "lp-lead mt-5 max-w-[54ch]",
                  align === "center" && "mx-auto",
                )}
              >
                {lead}
              </p>
            )}
          </Reveal>
        )}

        <div className={cn(hasHeading && "mt-14 md:mt-16")}>{children}</div>
      </div>
    </section>
  );
}

/**
 * Card — the one card treatment on the page. Every bordered surface uses it so
 * radius, tone and hover behave identically everywhere; a page whose cards
 * disagree about their own corner radius is the single most common tell that a
 * layout was assembled rather than designed.
 */
export function Card({
  children,
  className,
  interactive,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[color:var(--lp-line)] bg-[color:var(--lp-card)]",
        // Hover = tone + a one-pixel lift. Matte: the card raises, nothing glows.
        interactive &&
          "transition-[transform,background-color,border-color] duration-200 hover:-translate-y-px hover:border-[color:var(--lp-line-strong)] hover:bg-[color:var(--lp-card-lift)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
