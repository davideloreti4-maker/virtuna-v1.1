import { Hero } from "@/components/numen-landing/hero";
import { HowItWorks } from "@/components/numen-landing/how-it-works";
import { SectionShell } from "@/components/numen-landing/section-shell";
import { ProofStrip } from "@/components/numen-landing/proof-strip";
import { HonestyComparison } from "@/components/numen-landing/honesty-comparison";
import { ReadingGallery } from "@/components/numen-landing/reading-gallery";
import { SocialProof } from "@/components/numen-landing/social-proof";
import { CtaSection } from "@/components/numen-landing/cta-section";
import { getWaitlistCount } from "@/lib/waitlist-count";

/**
 * HomePage — the Numen landing root marketing page (D-10).
 *
 * Composes the seven kero-ordered section slots plus the early proof strip. The hero
 * is the ONLY top-level heading (rendered as an explicit child, no `heading=` prop so
 * SectionShell emits no second-level heading); every other slot passes `heading=` →
 * its internal h2. This keeps exactly one h1 with no heading-level skip. Footer + Nav
 * live in the layout. Every string obeys .planning/VOICE.md.
 *
 * Async (Plan 03-05): reads the live waitlist count ONCE via the cached
 * `getWaitlistCount()` (unstable_cache — never `createClient()` in the page body, see
 * RESEARCH Target 3 caching caveat) and threads it to BOTH proof surfaces — the early
 * `ProofStrip` (mounted as a thin band between #hero and #how-it-works) and the
 * `#proof` `SocialProof` block. One source, two surfaces (D-10).
 */

export default async function HomePage() {
  // Single cached read — threaded to both proof surfaces (one source, two surfaces).
  const waitlistCount = await getWaitlistCount();

  return (
    <>
      {/* 1 — Hero: the page's single top-level heading, no heading= prop.
          The Hero component owns the h1/subhead/CTA column + full-bleed ReadingLoop. */}
      <SectionShell id="hero" className="pt-28 pb-24 md:pt-40 md:pb-32">
        <Hero />
      </SectionShell>

      {/* D-10 early proof strip — a thin credibility band, NOT a SectionShell.
          Mounted between #hero and #how-it-works; reads the SAME count as #proof. */}
      <ProofStrip count={waitlistCount} />

      {/* 2 — How the Reading works */}
      <SectionShell id="how-it-works" heading="How the Reading works">
        <HowItWorks />
      </SectionShell>

      {/* 3 — Honesty moat */}
      <SectionShell id="honesty" heading="An honest verdict, not a hype score.">
        <HonestyComparison />
      </SectionShell>

      {/* 4 — Real Readings gallery */}
      <SectionShell id="gallery" heading="Real Readings, real creators.">
        <ReadingGallery />
      </SectionShell>

      {/* 5 — Social proof (live count is the primary proof; testimonials placeholder-ready) */}
      <SectionShell id="proof" heading="Creators who trust the Reading.">
        <SocialProof count={waitlistCount} />
      </SectionShell>

      {/* 6 — Conversion: the real waitlist form (footer placement) */}
      <SectionShell
        id="cta"
        heading="See what your next video is really saying."
      >
        <CtaSection />
      </SectionShell>
    </>
  );
}
