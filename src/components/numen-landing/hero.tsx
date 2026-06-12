"use client";

import Link from "next/link";

import { ReadingLoop } from "@/components/numen-landing/reading-loop";

/**
 * Hero — HERO-01 / CTA-01, the single-h1 text column that mounts the ReadingLoop.
 *
 * Lifted verbatim from the inline page.tsx hero block (the H1/subhead/CTA stack)
 * and now mounts the full-bleed `<ReadingLoop />` artifact (HERO-02). `"use client"`
 * because it mounts the client ReadingLoop.
 *
 * Single-h1 rule (D-10): this renders the page's ONLY `<h1>`. page.tsx places it
 * inside `SectionShell id="hero"` with NO `heading=` prop, so no second heading is
 * emitted. The verdict label / read line are NOT headings.
 *
 * Layout (UI-SPEC §Container): the text column stays in the shared `max-w-6xl`
 * readable gutter; `<ReadingLoop />` is the ONE deliberate full-bleed break (it may
 * extend beyond the gutter — HERO-02).
 *
 * Color by token NAME only. `bg-accent` is reserved for the CTA fill + focus ring
 * ONLY — never the H1, the verdict band, or borders.
 */

// COPY VERBATIM from nav.tsx:30-31 / footer.tsx — the shared focus-visible ring.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function Hero() {
  return (
    <div className="flex flex-col gap-10 md:gap-12">
      {/* Text column — stays in the readable gutter. */}
      <div className="mx-auto flex max-w-2xl flex-col gap-6 text-center md:text-left">
        <h1 className="text-text text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          Know if your content will land — before you post.
        </h1>
        <p className="text-base md:text-lg leading-relaxed text-text-muted">
          Numen reads your video like your sharpest audience would and gives you
          an honest verdict you can act on.
        </p>
        <div>
          <Link
            href="#cta"
            className={`inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-bg transition-opacity hover:opacity-90 ${FOCUS_RING}`}
          >
            Try Numen
          </Link>
        </div>
      </div>

      {/* Full-bleed artifact — the ONE deliberate break from the max-w-6xl gutter. */}
      <ReadingLoop className="w-full" />
    </div>
  );
}
