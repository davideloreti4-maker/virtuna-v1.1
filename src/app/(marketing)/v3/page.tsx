import type { Metadata } from 'next';
import { LandingHeader } from '@/app/(marketing)/_components/LandingHeader';
import { GrainOverlay } from '@/app/(marketing)/_components/GrainOverlay';
import { SkipToContent } from '@/app/(marketing)/_components/SkipToContent';
import { SectionShell } from '@/app/(marketing)/_components/SectionShell';
import { MotionRoot } from './MotionRoot';

/**
 * Landing v1 — `/v3` staging route (FOUND-01).
 *
 * Renders the 9 placeholder section shells in narrative order under a single
 * MotionConfig reducedMotion="user" page-root wrapper (FOUND-09). Skip-to-content link
 * lands on the main landmark (PERF-11). GrainOverlay paints SVG noise behind
 * all content (POLISH-01). LandingHeader is fixed-top with anchor links matching
 * section ids (FOUND-08).
 *
 * Page title locks "Virtuna | Predict viral before you post" (META-03 / FOUND-02
 * stale-title fix complement — once /v3 cuts over to root in Phase 11, this title
 * replaces any stale brand title residue site-wide).
 *
 * FOUND-05 collision-check decision:
 *   - src/components/ui/marquee.tsx EXISTS — Magic UI Marquee NOT installed in Phase 1.
 *     Deferred to Phase 9 (Social Proof) per ROADMAP; collision will be re-evaluated
 *     before install per UI-SPEC § Pre-install collision checks.
 *   - src/hooks/useCountUp.ts EXISTS — Magic UI NumberTicker NOT installed in Phase 1.
 *     Deferred to Phase 4/5/8 (where it's actually consumed) per ROADMAP.
 *   - Magic UI DotPattern is OPTIONAL per UI-SPEC § Magic UI/Aceternity installs row —
 *     deferred until a section actually needs the texture (no section in Phase 1
 *     requires it; placeholder shells use alternating background per § Section Shell).
 */
export const metadata: Metadata = {
  title: 'Virtuna | Predict viral before you post',
  description: 'AI that scores your TikToks before TikTok does. Simulate audiences, get a viral score in 30 seconds.',
  openGraph: {
    title: 'Virtuna | Predict viral before you post',
    description: 'AI that scores your TikToks before TikTok does. Simulate audiences, get a viral score in 30 seconds.',
    url: 'https://virtuna.ai/',
    siteName: 'Virtuna',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Virtuna | Predict viral before you post',
    description: 'AI that scores your TikToks before TikTok does. Simulate audiences, get a viral score in 30 seconds.',
  },
  alternates: {
    canonical: 'https://virtuna.ai/',
  },
};

/**
 * DOM order is intentional (a11y):
 * 1. SkipToContent — first focusable element on Tab (WCAG 2.5.5)
 * 2. GrainOverlay — aria-hidden decorative layer, never in tab order
 * 3. LandingHeader — fixed-position nav, rendered above content visually
 * 4. main#main-content — skip-link target; pt-16 offsets the 64px fixed header
 */
export default function LandingV3Page() {
  return (
    <>
      {/* Skip link must be first focusable element — position is DOM-order-dependent */}
      <SkipToContent />
      {/* Decorative SVG grain noise — aria-hidden, pointer-events-none, z-index -1 */}
      <GrainOverlay />
      {/* Fixed-top nav — rendered in DOM after skip link so keyboard order is correct */}
      <LandingHeader />
      {/* Main content landmark — skip-link target (href="#main-content") */}
      <main id="main-content" className="pt-16">
        {/*
         * MotionRoot wraps all 9 SectionShell instances so MotionConfig
         * reducedMotion="user" acts as a single kill-switch for the whole page.
         * Sections outside MotionRoot (Header, GrainOverlay) have no motion behavior.
         */}
        <MotionRoot>
          {/* Narrative order matches LandingHeader anchor hrefs and ROADMAP phase mapping */}
          <SectionShell id="hero" label="Hero" shipsInPhase={2} variant="odd" isHero />
          <SectionShell id="demo" label="Demo" shipsInPhase={4} variant="even" />
          <SectionShell id="how-it-works" label="How It Works" shipsInPhase={5} variant="odd" />
          <SectionShell id="surfaces" label="Three Surfaces" shipsInPhase={6} variant="even" />
          <SectionShell id="comparison" label="Comparison" shipsInPhase={7} variant="odd" />
          <SectionShell id="science" label="The Science" shipsInPhase={8} variant="even" />
          <SectionShell id="social-proof" label="Social Proof" shipsInPhase={9} variant="odd" />
          <SectionShell id="pricing" label="Pricing" shipsInPhase={10} variant="even" />
          <SectionShell id="final-cta" label="Final CTA" shipsInPhase={2} variant="odd" />
        </MotionRoot>
      </main>
    </>
  );
}
