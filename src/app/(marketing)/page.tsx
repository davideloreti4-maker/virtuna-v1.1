import type { Metadata } from "next";
import { Header, Footer } from "@/components/layout";
import {
  Hero,
  HowItWorks,
  SimulationShowcase,
  FeatureBlocks,
  MotionConfigShell,
  SocialProofStrip,
  Testimonials,
  PricingTeaser,
  Faq,
  FinalCtaBand,
} from "@/components/marketing";

export const metadata: Metadata = {
  title: "Numen — Know if it'll pop before you post",
  description:
    "Numen simulates how your audience reacts to a TikTok before you post it — so you know if it'll pop, and why.",
};

/**
 * Single-scroll marketing landing for Numen — Phase 4 complete.
 *
 * Server component (no client directive). Owns the full single-scroll chrome:
 * a flat-matte header + a main of anchored story sections + a footer (the
 * marketing layout is a bare pass-through — the root layout owns the document
 * shell).
 *
 * D-18 section order (locked):
 *   #hero → #social-proof (trust strip) → #how-it-works → #the-simulation →
 *   #features → #testimonials (conversion zone) → #pricing (PricingTeaser) →
 *   #faq (Faq) → final-cta band (full-bleed, no max-w-5xl, D-12) → Footer
 *
 * NAV_LINKS (src/lib/nav.ts) is unchanged at exactly 5 anchors (D-19). The
 * social-proof strip, testimonials section, and CTA band have NO nav anchors.
 *
 * Every standard section carries `scroll-mt-20` so headings clear the 64px
 * sticky header. The social-proof strip uses tighter padding (`py-8 md:py-10`)
 * as it is a thin trust bar, not a full section. The full-bleed CTA band (D-12)
 * has no max-w-5xl inner measure — it owns its own surface.
 */
export default function HomePage() {
  return (
    <MotionConfigShell>
      <Header />
      <main>
        {/* Hero — serif voice headline + CTA + the contained signature stage
            (the crowd→score moment mounts into the stage in 02-02/02-03).
            <Hero> owns its own centering/measure; the section supplies the
            scroll-anchor id + vertical rhythm (UI-SPEC §Spacing). */}
        <section id="hero" className="scroll-mt-20 px-6 py-12 md:py-16">
          <Hero />
        </section>

        {/* Social-proof strip — trust bar riding directly under the hero (D-01/D-18).
            Thin vertical padding (py-8 md:py-10) — it is a strip, not a full section.
            No nav anchor (D-19). */}
        <section
          id="social-proof"
          className="scroll-mt-20 border-t border-border px-6 py-8 md:py-10"
        >
          <div className="mx-auto max-w-5xl">
            <SocialProofStrip />
          </div>
        </section>

        {/* How it works — STORY-01. The section owns the LOCKED rhythm
            (id/border/padding/measure); <HowItWorks/> renders its own real
            cream heading + the 3-step body (D-E / Pitfall 3). */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <HowItWorks />
          </div>
        </section>

        {/* The Simulation — STORY-02 output showcase (D-23 product noun). The
            section owns the LOCKED rhythm (id/border/padding/measure);
            <SimulationShowcase/> renders its own real cream "The Simulation"
            heading + the device-framed Placeholder + the named outputs. */}
        <section
          id="the-simulation"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <SimulationShowcase />
          </div>
        </section>

        {/* Features — STORY-03 deep-dive blocks. The section owns the LOCKED
            rhythm (id/border/padding/measure); <FeatureBlocks/> renders its own
            real cream heading + the alternating benefit + Placeholder rows
            (D-E / Pitfall 3 — an ADD between The Simulation and Pricing, not a
            fill of an existing section). */}
        <section
          id="features"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <FeatureBlocks />
          </div>
        </section>

        {/* Testimonials — conversion zone (D-05/D-18). After features, before
            pricing. Full locked rhythm. No nav anchor (D-19). */}
        <section
          id="testimonials"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <Testimonials />
          </div>
        </section>

        {/* Pricing teaser — #pricing stub filled (Phase 4 / CONVERT-01). */}
        <section
          id="pricing"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <PricingTeaser />
          </div>
        </section>

        {/* FAQ — #faq stub filled (Phase 4 / CONVERT-03). The Faq RSC wrapper
            mounts the FaqAccordion client island; only the accordion carries
            "use client", keeping the page root RSC and / statically prerendered. */}
        <section
          id="faq"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <Faq />
          </div>
        </section>

        {/* Full-bleed CTA band — before Footer, no max-w-5xl inner measure (D-12).
            The band owns its own full-bleed surface. No scroll-anchor / nav link (D-19). */}
        <section data-section="final-cta">
          <FinalCtaBand />
        </section>
      </main>
      <Footer />
    </MotionConfigShell>
  );
}
