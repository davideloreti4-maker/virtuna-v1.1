import type { Metadata } from "next";
import { Header, Footer } from "@/components/layout";
import {
  Hero,
  HowItWorks,
  SimulationShowcase,
  FeatureBlocks,
  MotionConfigShell,
} from "@/components/marketing";

export const metadata: Metadata = {
  title: "Numen — Know if it'll pop before you post",
  description:
    "Numen simulates how your audience reacts to a TikTok before you post it — so you know if it'll pop, and why.",
};

/**
 * Single-scroll marketing landing for Numen.
 *
 * Server component (no client directive). Owns the full single-scroll chrome:
 * a flat-matte header + a main of anchored story sections + a footer (the
 * marketing layout is a bare pass-through — the root layout owns the document
 * shell).
 *
 * Each <section id> is both a nav/footer anchor target AND a content mount
 * point. The hero (#hero), how-it-works (#how-it-works), the-simulation
 * (#the-simulation), and features (#features) now render real STORY content;
 * only #pricing and #faq remain placeholder stubs (Phase 4 fills them).
 *
 * Every section carries `scroll-mt-20` (5rem) so its heading clears the 64px
 * sticky header by a reliable, intentional offset (GAP-5) rather than by
 * accidental padding. Section vertical padding is tightened to a denser
 * responsive rhythm (`py-16 md:py-20`) so the assembled body reads
 * higher-density on desktop (GAP-3). Hairline `border-t border-border`
 * separators and the `mx-auto max-w-5xl` inner measure are preserved.
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

        {/* Pricing teaser — placeholder stub (Phase 4). */}
        <section
          id="pricing"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-semibold text-foreground-muted">
              Pricing
            </h2>
          </div>
        </section>

        {/* FAQ — placeholder stub (Phase 4). */}
        <section
          id="faq"
          className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-semibold text-foreground-muted">
              FAQ
            </h2>
          </div>
        </section>
      </main>
      <Footer />
    </MotionConfigShell>
  );
}
