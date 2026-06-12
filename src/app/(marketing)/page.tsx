import { Hero } from "@/components/numen-landing/hero";
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

export default function HomePage() {
  return (
    <>
      {/* 1 — Hero: the page's single top-level heading, no heading= prop.
          The Hero component owns the h1/subhead/CTA column + full-bleed ReadingLoop. */}
      <SectionShell id="hero" className="pt-28 pb-24 md:pt-40 md:pb-32">
        <Hero />
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
