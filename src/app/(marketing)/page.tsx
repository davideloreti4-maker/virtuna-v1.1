import type { Metadata } from "next";
import { Header, Footer } from "@/components/layout";
import { Hero, MotionConfigShell } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Numen — Know if it'll pop before you post",
  description:
    "Numen simulates how your audience reacts to a TikTok before you post it — so you know if it'll pop, and why.",
};

/**
 * Scroll skeleton for the Phase-1 Foundation & Shell.
 *
 * Server component (no client directive). Owns the full single-scroll chrome:
 * a flat-matte header + a main of anchored stub sections + a footer (the
 * marketing layout is a bare pass-through — the root layout owns the document
 * shell).
 *
 * Each <section id> is both a nav/footer anchor target AND the mount point a
 * later phase fills (Phase 2 hero, Phase 3 "The Simulation" showcase, Phase 4
 * pricing teaser + FAQ). Stubs are empty-but-anchored with calm vertical rhythm
 * (py-20/24 ≈ 80–96px, UI-SPEC Spacing Scale) and a muted placeholder heading.
 * Real content + the serif hero land in Phases 2–4.
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
        <section id="hero" className="px-6 py-16 md:py-20">
          <Hero />
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-t border-border px-6 py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-semibold text-foreground-muted">
              How it works
            </h2>
          </div>
        </section>

        {/* The Simulation — product showcase (D-23 product noun). */}
        <section
          id="the-simulation"
          className="border-t border-border px-6 py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-semibold text-foreground-muted">
              The Simulation
            </h2>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-semibold text-foreground-muted">
              Pricing
            </h2>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border px-6 py-20">
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
