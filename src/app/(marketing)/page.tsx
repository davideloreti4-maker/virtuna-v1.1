import Link from "next/link";

import { SectionShell } from "@/components/numen-landing/section-shell";

/**
 * HomePage — the Numen landing root marketing page (D-10).
 *
 * Composes the seven kero-ordered section slots. The hero is the ONLY top-level
 * heading (rendered as an explicit child, no `heading=` prop so SectionShell
 * emits no second-level heading); every other slot passes `heading=` → its
 * internal h2. This keeps exactly one h1 with no heading-level skip. Footer + Nav
 * live in the layout.
 * Slots are heading-only skeletons — Phases 2–4 fill the real media/artifacts.
 * Every string obeys .planning/VOICE.md (no hype, no fake precision, no jargon).
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export default function HomePage() {
  return (
    <>
      {/* 1 — Hero: the page's single top-level heading, no heading= prop */}
      <SectionShell id="hero" className="pt-28 pb-24 md:pt-40 md:pb-32">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <h1 className="text-text text-4xl md:text-6xl font-bold tracking-tight">
            Know if your content will land — before you post.
          </h1>
          <p className="text-base md:text-lg leading-relaxed text-text-muted">
            Numen reads your video like your sharpest audience would and gives
            you an honest verdict you can act on.
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
      </SectionShell>

      {/* 2 — How the Reading works */}
      <SectionShell id="how-it-works" heading="How the Reading works" />

      {/* 3 — Honesty moat */}
      <SectionShell id="honesty" heading="An honest verdict, not a hype score." />

      {/* 4 — Real Readings gallery */}
      <SectionShell id="gallery" heading="Real Readings, real creators." />

      {/* 5 — Social proof (neutral placeholder — real assets land in Phase 3 / D-L4) */}
      <SectionShell id="proof" heading="Creators who trust the Reading." />

      {/* 6 — Conversion */}
      <SectionShell
        id="cta"
        heading="See what your next video is really saying."
      />
    </>
  );
}
