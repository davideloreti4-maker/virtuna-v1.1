"use client";

import Link from "next/link";

/**
 * LandingHeader — fixed-top navigation for the `/v3` landing page.
 *
 * Implements:
 * - FOUND-08: anchor nav above-fold for all 9 landing sections + Sign in link + Sign up CTA
 * - MOTION-04: Lightning CSS workaround pattern (backdrop-filter via inline React style,
 *   never via Tailwind utility — Lightning CSS strips the utility class in production builds).
 *
 * Spec source: .planning/phases/01-foundation-scaffold/01-UI-SPEC.md § Header Visual Contract.
 * Anchor href slugs MUST stay in sync with SectionShell `id` union from Plan 02.
 */

/**
 * Anchor slug contract: each href below MUST match a SectionShell `id` from Plan 02.
 * Kept as a literal type union for future-proofing without re-deriving from JSX.
 */
export type LandingAnchor =
  | "#hero"
  | "#demo"
  | "#how-it-works"
  | "#surfaces"
  | "#comparison"
  | "#science"
  | "#social-proof"
  | "#pricing"
  | "#final-cta";

const NAV_LINK_CLASS =
  "text-sm font-normal text-foreground-muted hover:text-foreground transition-colors";

export function LandingHeader() {
  return (
    <header
      role="banner"
      className="fixed top-0 left-0 right-0 h-16 border-b"
      style={{
        zIndex: 200,
        backgroundColor: 'rgba(7, 8, 10, 0.85)',
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
        // MOTION-04 / PITFALLS § 2: backdrop-filter MUST be inline style.
        // Lightning CSS strips the Tailwind utility variant in prod builds.
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Virtuna wordmark — 16px semibold white; routes to root marketing page. */}
        <Link
          href="/"
          className="text-base font-semibold text-foreground"
        >
          Virtuna
        </Link>

        {/* Anchor nav — 9 same-page links to SectionShell ids. Hidden below md (768px).
            Each href below is a literal LandingAnchor that pairs with a SectionShell id. */}
        <nav
          aria-label="Landing page navigation"
          className="hidden md:flex items-center gap-6"
        >
          <a href="#hero" className={NAV_LINK_CLASS}>
            Hero
          </a>
          <a href="#demo" className={NAV_LINK_CLASS}>
            Demo
          </a>
          <a href="#how-it-works" className={NAV_LINK_CLASS}>
            How it works
          </a>
          <a href="#surfaces" className={NAV_LINK_CLASS}>
            Surfaces
          </a>
          <a href="#comparison" className={NAV_LINK_CLASS}>
            Comparison
          </a>
          <a href="#science" className={NAV_LINK_CLASS}>
            Science
          </a>
          <a href="#social-proof" className={NAV_LINK_CLASS}>
            Social proof
          </a>
          <a href="#pricing" className={NAV_LINK_CLASS}>
            Pricing
          </a>
          <a href="#final-cta" className={NAV_LINK_CLASS}>
            Final CTA
          </a>
        </nav>

        {/* Right cluster — Sign in (md+ only) + Sign up CTA (always visible). */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden md:inline-block text-sm font-normal text-foreground-muted hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold bg-coral-500 hover:bg-coral-400 rounded-md px-4 py-2 transition-colors"
            // Literal hex per UI-SPEC § Header Sign up row — avoids any Tailwind v4
            // oklch drift on the dark-brown accent-foreground token (PITFALLS § 3).
            style={{ color: '#1a0f0a' }}
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
