/**
 * SkipToContent.tsx — WCAG 2.5.5 skip-to-main-content link.
 *
 * Server component (no client directive). Implements PERF-11.
 *
 * Per UI-SPEC § Skip-to-Content Contract:
 *   - <a href="#main-content">Skip to main content</a>
 *   - Default: position absolute, top -44px (off-screen), left 16px
 *   - On :focus-visible: top 16px, left 16px, z-index 9999, outline 2px solid #FF7F50
 *     (--color-accent), bg --color-background-elevated, text --color-foreground
 *   - 8px border radius (--radius-md), 12px/16px padding, 14px regular text
 *
 * Tailwind v4 mapping (each unit = 4px):
 *   -top-11 → top: -44px (off-screen default; also matches WCAG 44px min touch target)
 *   focus-visible:top-4 → top: 16px (revealed on keyboard focus)
 *   left-4 → left: 16px
 *   px-4 → 16px horizontal padding
 *   py-3 → 12px vertical padding
 *   text-sm → 14px
 *   font-normal → 400
 *   rounded-md → 8px radius
 *   z-[9999] → above fixed Header (z-index 200) when focused
 *   outline-accent → uses --color-accent (coral #FF7F50)
 *
 * Target element: <main id="main-content"> wraps the 9 SectionShell instances in
 * /v3/page.tsx (Plan 05).
 */

import type { JSX } from "react";

export function SkipToContent(): JSX.Element {
  return (
    <a
      href="#main-content"
      className="absolute -top-11 left-4 z-[9999] bg-background-elevated text-foreground text-sm font-normal rounded-md px-4 py-3 focus-visible:top-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      Skip to main content
    </a>
  );
}
