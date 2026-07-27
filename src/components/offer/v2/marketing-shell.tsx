/**
 * The /go-v2 grid — one column, one rhythm, one heading scale.
 *
 * Pure RSC (no client directive) so it composes from the server page and from client sections
 * alike, the same way `sections/section-shell.tsx` does for the current /go.
 *
 * ── EVERY NUMBER HERE WAS MEASURED, NOT CHOSEN ────────────────────────────────────────────
 * Desktop, off linear.app / attio.com / cursor.com at 1440x900 (2026-07-27):
 *
 *   content column   Linear 1436 · Attio 1440 · Cursor 1300 · /go today 1180  → 1400
 *   section pad-top  Linear 128  · Attio 152  · Cursor 67    · /go today 115  → 128–152
 *   air above h1     Linear ~370 · /go today ~150                            → 300–370
 *   h1               Linear 64px/510/−0.022em/1.00 · Attio 64px/600/−0.020em/0.95
 *
 * Mobile, at 390x844 @3x with an iPhone UA (2026-07-27 — this pass; the desktop-only handoff
 * had no mobile evidence at all, and mobile is the majority of this page's traffic):
 *
 *   h1 size          Linear 38 · Attio 40 · Cursor 34                        → 38–40
 *   h1 weight        Linear 510 · Attio 600 · Cursor 400
 *   h1 tracking      Linear −0.836px (−0.022em) · Attio −0.4px · Cursor −0.675px
 *   h1 width         Linear 88vw · Attio 88vw · Cursor 90vw                  → ~88vw
 *   air above h1     Linear 196 · Attio 226 · /go today 64                   → ~200
 *   section pad-top  Attio 88 · Cursor 63/105                                → ~88
 *   hero shot        Linear img 100vw r0 border-0 · Cursor img 90vw r0 border-0
 *
 * 🔑 The mobile fold is NOT a scaled desktop fold. Air above the headline is 196–226px on a
 * phone against /go's current 64 — the single largest geometric miss on the surface most of
 * the traffic actually sees.
 *
 * ⚠️ The "r0 border-0" row above is MOBILE ONLY, and reading it as a general rule is a mistake
 * this rebuild already made once: on desktop both references FRAME the shot (Linear a radius +
 * hairline, Attio a full macOS window), and shipping it unframed left the fold looking like a
 * text block on a grey slab. See `hero-shot.tsx`.
 *
 * Two references are LIGHT (Attio, Cursor) and only Linear is dark. Linear is therefore the
 * VISUAL reference; Attio and Cursor are GRAMMAR references — logo wall, metrics band,
 * case-study-with-a-number. Take structure from them, never colour.
 */

import { cn } from "@/lib/utils";
import { ambientLoop } from "./ambient";

type Tone = "floor" | "sunken" | "lifted";

interface MarketingSectionProps {
  id?: string;
  className?: string;
  tone?: Tone;
  /** Hairline at the top edge, with a slow travelling highlight. */
  seam?: boolean;
  /**
   * This section's position in the page, used ONLY to desynchronise its seam.
   *
   * Not cosmetic bookkeeping: the motion probe caught eight seams all running at the shared
   * 14.23s base period, which is a visible ripple travelling down the page in lockstep — the
   * exact phase-lock `ambient.ts` exists to prevent, reintroduced by the one loop that repeats
   * across sections rather than within one. Every section that sets `seam` must pass a
   * distinct value; `__tests__/ambient.test.ts` pins the rule, the probe measures the result.
   */
  seamIndex?: number;
  /** Tighter rhythm for bands that sit flush against a neighbour. */
  compact?: boolean;
  /** Opt out of the column to run full-bleed (the logo marquee, the hero shot). */
  bleed?: boolean;
  children: React.ReactNode;
}

export function MarketingSection({
  id,
  className,
  tone = "floor",
  seam = false,
  seamIndex = 0,
  compact = false,
  bleed = false,
  children,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative",
        id && "scroll-mt-24 md:scroll-mt-28",
        tone === "sunken" && "mk-tone-sunken",
        tone === "lifted" && "mk-tone-lifted",
      )}
    >
      {seam && <SectionSeam index={seamIndex} />}
      <div
        className={cn(
          "relative",
          // ~88px on a phone (Attio), 128 on desktop (Linear). Attio's 152 was tried and
          // reverted: they fill that space with dense bordered panels, so it reads as rhythm.
          // On a sparser page the same number reads as dead air between text blocks.
          compact ? "py-14 md:py-20" : "py-[88px] md:py-28 lg:py-32",
          !bleed && "mx-auto w-full max-w-[1400px] px-5 md:px-8",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * A hairline band edge with a highlight travelling along it — 12.8–24.5s, per `index`.
 *
 * This is the matte answer to Linear's `shine`. Their version is a specular sweep; ours moves
 * an EDGE, because the design system forbids glow and glass outright. It is one of the loops
 * that keeps the mid-page animation count from collapsing between product surfaces — measured
 * on all three references, the count never drops as you scroll (Linear 180→179, Attio 12→11,
 * Cursor 37→36), and dead space between sections is where ours used to fall to zero.
 */
export function SectionSeam({ index = 0 }: { index?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
      <div className="absolute inset-0" style={{ background: "var(--mk-hairline)" }} />
      <div
        className="mk-seam-travel absolute inset-y-0 w-1/3"
        style={{
          background:
            "linear-gradient(90deg,transparent,rgba(236,231,222,0.34),transparent)",
          // A wide, slow band (12.8–24.5s) so neighbouring seams are visibly independent
          // rather than a wave rolling down the page.
          ...ambientLoop(index, { base: 12.8, spread: 11.7 }),
        }}
      />
    </div>
  );
}

interface MarketingHeadingProps {
  eyebrow?: string;
  /** A numbered section marker — "1.0", "2.0", "3.0". Attio/Linear grammar. */
  index?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}

export function MarketingHeading({
  eyebrow,
  index,
  title,
  sub,
  align = "center",
  className,
}: MarketingHeadingProps) {
  const left = align === "left";

  const eyebrowRow = (eyebrow || index) && (
    <div className={cn("flex items-baseline gap-2.5 text-[11.5px] font-semibold uppercase tracking-[0.16em]", !left && "justify-center")}>
      {index && <span className="font-mono text-[#6d6961]">{index}</span>}
      {eyebrow && <span className="text-[#8a857c]">{eyebrow}</span>}
    </div>
  );

  // Inter, never serif — the serif is reserved for the h1's voice moment. Tracking matches the
  // measured hero value, so headings and headline read as one type system.
  const heading = (
    <h2
      className="text-balance text-[clamp(1.75rem,3.4vw,2.6rem)] font-semibold leading-[1.08] text-[#ece7de]"
      style={{ letterSpacing: "-0.022em" }}
    >
      {title}
    </h2>
  );

  /*
    LEFT-ALIGNED HEADINGS RUN AS TWO COLUMNS: title left, supporting line right.
    A left-aligned title stacked above its own subhead leaves the right HALF of a 1400px column
    empty, and a row that is half empty reads as a document, not a designed page — which was a
    large part of why the first pass looked unfinished at desktop width. Linear pairs a left
    heading with a paragraph opposite it for exactly this reason. Centred headings are
    unaffected: they stack, because a centred column is not leaving a side empty.
  */
  if (left) {
    return (
      <div className={cn("grid gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end", className)}>
        <div>
          {eyebrowRow}
          <div className="mt-3.5">{heading}</div>
        </div>
        {sub && (
          <p className="max-w-[46ch] text-[16px] leading-[1.55] text-[#c2bdb4] lg:pb-1.5">{sub}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      {eyebrowRow}
      <div className="mt-3.5">{heading}</div>
      {sub && (
        <p className="mx-auto mt-4 max-w-[52ch] text-[16px] leading-[1.55] text-[#c2bdb4]">{sub}</p>
      )}
    </div>
  );
}
