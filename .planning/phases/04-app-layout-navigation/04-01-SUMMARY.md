---
phase: 04-app-layout-navigation
plan: 01
subsystem: ui
tags: [next.js, route-groups, layouts, radix-ui]

# Dependency graph
requires:
  - phase: 02-design-system-components
    provides: Header, Footer, design tokens, fonts
  - phase: 03-landing-site
    provides: Landing page sections and components
provides:
  - Route group structure for marketing and app
  - Separate layout contexts (with/without Header)
  - Dashboard page placeholder at /dashboard
  - Radix UI dropdown and dialog packages
affects: [04-02, 04-03, 04-04, 05-app-shell]

# Tech tracking
tech-stack:
  added: [@radix-ui/react-dropdown-menu, @radix-ui/react-dialog]
  patterns: [route-groups, separate-root-layouts]

key-files:
  created:
    - src/app/(marketing)/layout.tsx
    - src/app/(marketing)/page.tsx
    - src/app/(marketing)/coming-soon/page.tsx
    - src/app/(marketing)/showcase/page.tsx
    - src/app/(app)/layout.tsx
    - src/app/(app)/dashboard/page.tsx
  modified: []

key-decisions:
  - "Route groups for layout separation - (marketing) with Header, (app) without"
  - "Each route group has own root layout with html/body tags"
  - "Deleted root layout.tsx - route groups provide complete layouts"

patterns-established:
  - "Route group pattern: (marketing) for public pages, (app) for authenticated app"
  - "Marketing layout includes Header component, app layout has flex container for future sidebar"

# Metrics
duration: 12min
completed: 2026-01-28
---

# Phase 4 Plan 1: Route Groups Setup Summary

**Next.js route groups separating marketing site (with Header) from app dashboard (sidebar-ready) with Radix UI dependencies installed**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-28T16:46:06Z
- **Completed:** 2026-01-28T16:57:50Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments

- Created `(marketing)` route group with Header for landing pages
- Created `(app)` route group without Header, prepared for sidebar
- Moved existing pages (/, /coming-soon, /showcase) to marketing group
- Created dashboard placeholder page at /dashboard
- Radix UI dropdown-menu and dialog packages available (pre-installed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Radix UI dependencies** - `59bd577` (chore) - Pre-existing commit
2. **Task 2: Create route groups for marketing and app** - `503e226` (feat)

## Files Created/Modified

- `src/app/(marketing)/layout.tsx` - Marketing root layout with Header and fonts
- `src/app/(marketing)/page.tsx` - Landing home page (moved)
- `src/app/(marketing)/coming-soon/page.tsx` - Coming soon page (moved)
- `src/app/(marketing)/showcase/page.tsx` - Component showcase page (moved)
- `src/app/(app)/layout.tsx` - App root layout without Header, flex container for sidebar
- `src/app/(app)/dashboard/page.tsx` - Dashboard placeholder page

## Decisions Made

- **Route groups for layout separation:** Using `(marketing)` and `(app)` route groups allows completely different layouts without affecting URL structure
- **Each route group has own root layout:** Both layouts include `<html>` and `<body>` tags with font variables, eliminating need for shared root layout
- **Deleted root layout.tsx:** Route groups provide complete layouts, no shared root needed
- **App layout flex structure:** Pre-configured `flex min-h-screen` container ready for sidebar + main content pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed incorrect relative paths for fonts and globals.css**
- **Found during:** Task 2 (Create route groups)
- **Issue:** Initial paths `../../globals.css` and `../../../fonts/` were wrong for route group nesting
- **Fix:** Changed to `../globals.css` and `../../fonts/` (route groups don't add filesystem depth)
- **Files modified:** src/app/(marketing)/layout.tsx, src/app/(app)/layout.tsx
- **Verification:** Build passes without module resolution errors
- **Committed in:** 503e226 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Path fix was necessary for build to pass. No scope creep.

## Issues Encountered

None - once paths were corrected, implementation proceeded smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route groups established and working
- Ready for 04-02: View Selector dropdown component
- Ready for 04-03: Society Selector modal component
- App layout flex container ready for sidebar integration
- Radix UI primitives available for dropdown and dialog components

---
*Phase: 04-app-layout-navigation*
*Completed: 2026-01-28*
