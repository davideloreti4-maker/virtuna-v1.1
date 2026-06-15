/**
 * Shared in-page navigation anchor set for the marketing landing.
 *
 * Single source of truth for the in-page nav anchors so the header bar/mobile
 * panel and the footer Product column never drift (IN-03). Previously the
 * header `NAV_LINKS` and footer `PRODUCT_LINKS` arrays were byte-identical and
 * kept in sync by hand; this constant is now the only place the set lives.
 *
 * Order is locked (NAV-01 / NAV-02): How it works → The Simulation → Features →
 * Pricing → FAQ. Each entry targets a scroll-skeleton section id the marketing
 * page assigns. Mirrors the `src/lib/routes.ts` `as const` / JSDoc style.
 */

/** In-page anchor links — the locked nav set shared by header + footer. */
export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "The Simulation", href: "#the-simulation" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;
