"use client";

import { HeroBookend } from "@/app/(marketing)/_components/HeroBookend";
import { LandingFooter } from "@/app/(marketing)/_components/LandingFooter";

/**
 * FinalCtaSection (CTA-01, CTA-02) — verbatim Hero mirror at page end + footer.
 *
 * Per D-08: SAME Spotlight, badge, visual H1 (with WordRotate), sub-headline, and CTA pair
 * as HeroSection. Two differences:
 *  - reducedHeight={true}  → min-h-[60vh] vs HeroSection's min-h-[100dvh]
 *  - headingAs="p"         → the visual H1 renders as <p role="heading" aria-level={2}>
 *                            (identical visual styling and WordRotate behavior) so the page
 *                            contains exactly one <h1> in the accessibility tree.
 *                            Resolves UI-SPEC § Accessibility Contract single-H1 rule in Phase 2.
 *  - border-top separator from VisionBeat above (1px rgba(255,255,255,0.04))
 *  - LandingFooter attaches directly below the bookend.
 *
 * Anchor ID #final-cta MUST be preserved — LandingHeader.tsx anchor href depends on it.
 *
 * LandingFooter placement: Rendered as sibling to <section id="final-cta">, NOT inside it.
 * LandingFooter wraps itself in <footer> — nesting footer inside section would create
 * incorrect landmark hierarchy. Fragment wrapper keeps both as direct children siblings.
 */
export function FinalCtaSection() {
  return (
    <>
      <section
        id="final-cta"
        aria-label="Final CTA section"
        className="relative bg-background"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}
      >
        <HeroBookend reducedHeight headingAs="p" />
      </section>
      <LandingFooter />
    </>
  );
}
