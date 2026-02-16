---
phase: 02-landing-page
plan: 01
subsystem: ui
tags: [next-link, tailwind, raycast-design, cta, landing-page]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Auth routes at /signup and /login (decision [01-01])
provides:
  - All landing page CTAs link to correct /signup route
  - All pricing page unauthenticated CTAs link to /signup?plan=<tier>
  - Raycast 6% border opacity standard enforced in FAQ and footer
  - Design token usage (text-foreground-muted) in footer
affects: [02-landing-page, header-cta-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "border-white/[0.06] for all standard borders (Raycast 6% opacity)"
    - "text-foreground-muted design token instead of raw text-gray-400"

key-files:
  created: []
  modified:
    - src/components/landing/hero-section.tsx
    - src/components/layout/footer.tsx
    - src/app/(marketing)/pricing/pricing-section.tsx
    - src/components/landing/faq-section.tsx

key-decisions:
  - "CTA links updated to /signup (not /auth/signup) per Phase 1 auth route decision [01-01]"
  - "Raycast 6% border opacity enforced via border-white/[0.06] in FAQ and footer"
  - "Footer text colors migrated from raw text-gray-400 to text-foreground-muted design token"

patterns-established:
  - "All auth-related CTAs use /signup (not /auth/signup)"
  - "Unauthenticated pricing CTAs use /signup?plan=<tier>"
  - "Design token usage over raw Tailwind color classes for brand consistency"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 2 Plan 1: CTA Links & Raycast Design Fixes Summary

**Fixed CTA link targets from /auth/signup to /signup across hero, footer, and pricing; aligned border opacities and text colors to Raycast 6% design standard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T05:16:20Z
- **Completed:** 2026-02-16T05:18:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All landing page and footer CTAs now link to /signup (matching Phase 1 auth route restructuring)
- Pricing page unauthenticated CTAs now link to /signup?plan=<tier>
- FAQ accordion borders aligned to Raycast 6% opacity standard (border-white/[0.06])
- Footer border and text colors migrated to design tokens
- Build passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CTA link targets across landing page, footer, and pricing** - `c2bd7b7` (fix)
2. **Task 2: Fix Raycast design language inconsistencies (borders, text colors)** - `d1627ce` (fix)

## Files Created/Modified
- `src/components/landing/hero-section.tsx` - Updated CTA href from /auth/signup to /signup
- `src/components/layout/footer.tsx` - Updated CTA href, border opacities (3x), text colors (5x text-gray-400 -> text-foreground-muted)
- `src/app/(marketing)/pricing/pricing-section.tsx` - Updated unauthenticated CTA href from /auth/signup?plan= to /signup?plan=
- `src/components/landing/faq-section.tsx` - Updated accordion border from border-white/10 to border-white/[0.06]

## Decisions Made
- CTA links updated to /signup per Phase 1 decision [01-01] -- no ambiguity, direct replacement
- Raycast 6% border opacity applied uniformly to FAQ and footer (was 10% and 20%)
- All 5 footer text color instances migrated from text-gray-400 to text-foreground-muted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Landing page CTAs and design language are consistent
- Remaining /auth/signup references exist in header.tsx and auth/login page (out of scope for this plan, noted for future cleanup)
- backers-section.tsx still has border-white/10 (out of scope, not listed in plan files)
- Ready for Plan 02 (remaining landing page work)

## Self-Check: PASSED

- [x] src/components/landing/hero-section.tsx -- FOUND
- [x] src/components/layout/footer.tsx -- FOUND
- [x] src/app/(marketing)/pricing/pricing-section.tsx -- FOUND
- [x] src/components/landing/faq-section.tsx -- FOUND
- [x] Commit c2bd7b7 -- FOUND
- [x] Commit d1627ce -- FOUND
- [x] Build passes -- CONFIRMED

---
*Phase: 02-landing-page*
*Completed: 2026-02-16*
