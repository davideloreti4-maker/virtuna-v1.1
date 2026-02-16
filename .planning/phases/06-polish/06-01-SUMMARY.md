---
phase: 06-polish
plan: 01
subsystem: ui
tags: [next.js, opengraph, metadata, middleware, tailwind]

# Dependency graph
requires:
  - phase: 02-landing-page
    provides: Marketing route group and landing page
  - phase: 05-referral
    provides: Referral system with /referrals route
provides:
  - Clean OG metadata with dynamic image generation via file convention
  - Marketing-route branded OG image for social sharing
  - Brand-deals redirect to /referrals
  - Middleware with only valid route references
  - Dashboard mobile overflow fix
affects: [deployment, social-sharing]

# Tech tracking
tech-stack:
  added: []
  patterns: [next.js opengraph-image file convention for route-specific OG images]

key-files:
  created:
    - src/app/(marketing)/opengraph-image.tsx
  modified:
    - src/app/layout.tsx
    - src/app/(app)/brand-deals/page.tsx
    - src/lib/supabase/middleware.ts
    - src/app/(app)/dashboard/dashboard-client.tsx

key-decisions:
  - "Removed static /og-image.png references from root metadata -- opengraph-image.tsx file convention auto-injects correct OG tags"
  - "Kept /brand-deals in middleware PROTECTED_PREFIXES since redirect page still needs auth protection"
  - "Kept /showcase in PUBLIC_PATHS as design system reference for development"

patterns-established:
  - "Route-specific OG images: place opengraph-image.tsx in route group directory for automatic scoping"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 6 Plan 1: Polish Summary

**Clean OG metadata via file convention, marketing OG image for social sharing, dead route cleanup in middleware, brand-deals redirect, and dashboard mobile fix**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T08:33:34Z
- **Completed:** 2026-02-16T08:36:06Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Removed conflicting static `/og-image.png` references from root layout metadata (file did not exist, causing broken OG previews)
- Created marketing-route `opengraph-image.tsx` with Virtuna branding, coral tagline, and muted subtitle for social sharing
- Replaced brand-deals placeholder page with redirect to /referrals
- Cleaned middleware of dead route references (/earnings, /content-intelligence) and test paths (primitives-showcase, viral-score-test, viral-results-showcase, viz-test)
- Added `min-w-0` to dashboard filter pills container to prevent flex overflow on mobile

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix OG metadata + create marketing OG image** - `50420c8` (feat)
2. **Task 2: Redirect brand-deals + clean middleware + dashboard mobile fix** - `0096f4e` (fix)

## Files Created/Modified
- `src/app/(marketing)/opengraph-image.tsx` - Marketing-specific OG image with Virtuna branding for landing page and referral link social sharing
- `src/app/layout.tsx` - Removed static /og-image.png references from openGraph and twitter metadata
- `src/app/(app)/brand-deals/page.tsx` - Replaced placeholder with redirect to /referrals
- `src/lib/supabase/middleware.ts` - Removed dead routes from PROTECTED_PREFIXES and test paths from PUBLIC_PATHS
- `src/app/(app)/dashboard/dashboard-client.tsx` - Added min-w-0 to filter pills container for mobile overflow prevention

## Decisions Made
- Removed static `/og-image.png` references from root metadata since the opengraph-image.tsx file convention auto-injects correct OG tags (having both creates a conflict pointing to a non-existent file)
- Kept `/brand-deals` in middleware PROTECTED_PREFIXES since the redirect page still needs auth protection to redirect authenticated users properly
- Kept `/showcase` in PUBLIC_PATHS as it serves as a design system reference page useful during development
- Kept `/coming-soon` in PUBLIC_PATHS as it is still used by footer links

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript build error in `src/app/(marketing)/showcase/utilities/page.tsx` (missing `NoiseTexture` import) causes `pnpm build` to fail -- unrelated to this plan's changes. Verified our modified files have zero TypeScript errors via `tsc --noEmit`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- OG metadata is clean and social sharing will work correctly for landing page and referral links
- Middleware only references existing routes
- Ready for plan 06-02 (remaining polish tasks)

---
*Phase: 06-polish*
*Completed: 2026-02-16*
