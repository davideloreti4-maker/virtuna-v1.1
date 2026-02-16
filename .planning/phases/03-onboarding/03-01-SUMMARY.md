---
phase: 03-onboarding
plan: 01
subsystem: auth
tags: [supabase, auth, onboarding, routing, oauth, creator-profiles]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Supabase auth with login/signup pages at /(onboarding) route group"
provides:
  - "First-time user detection in login action (email/password path)"
  - "First-time user detection in OAuth callback (Google path)"
  - "Clean auth routes (old /auth/login and /auth/signup removed)"
  - "Header links updated to /login and /signup"
affects: [03-onboarding, 04-payments]

# Tech tracking
tech-stack:
  added: []
  patterns: ["creator_profiles.onboarding_completed_at as first-time user signal", "pendingCookies pattern for deferred NextResponse.redirect in route handlers"]

key-files:
  created: []
  modified:
    - src/app/(onboarding)/login/actions.ts
    - src/app/auth/callback/route.ts
    - src/components/layout/header.tsx

key-decisions:
  - "Deferred response creation in OAuth callback using pendingCookies array to collect auth cookies before redirect URL is known"
  - "Header links updated from /auth/login to /login and /auth/signup to /signup (Rule 2 - missing critical)"

patterns-established:
  - "First-time user detection: query creator_profiles.onboarding_completed_at with maybeSingle(), redirect to /welcome if null/missing"
  - "Deferred redirect pattern: collect cookies in array, create NextResponse.redirect after determining destination"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 3 Plan 01: First-Time User Routing Summary

**Login action and OAuth callback detect first-time users via creator_profiles and redirect to /welcome onboarding flow**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T05:43:25Z
- **Completed:** 2026-02-16T05:46:06Z
- **Tasks:** 2
- **Files modified:** 3 (+ 3 deleted)

## Accomplishments
- Login action (email/password) queries creator_profiles before redirect, sending first-time users to /welcome
- OAuth callback (Google) queries creator_profiles before redirect, sending first-time users to /welcome
- Deleted deprecated /auth/login, /auth/signup pages and /auth/layout.tsx
- Updated header links from /auth/login to /login and /auth/signup to /signup

## Task Commits

Each task was committed atomically:

1. **Task 1: Add first-time user detection to login action and OAuth callback** - `14f2f12` (feat)
2. **Task 2: Delete deprecated auth pages** - `ea9ac76` (chore)

## Files Created/Modified
- `src/app/(onboarding)/login/actions.ts` - Added creator_profiles query for onboarding_completed_at before redirect
- `src/app/auth/callback/route.ts` - Restructured to defer redirect URL until after profile check, using pendingCookies pattern
- `src/components/layout/header.tsx` - Updated links from /auth/login to /login, /auth/signup to /signup
- `src/app/auth/login/page.tsx` - Deleted (deprecated)
- `src/app/auth/signup/page.tsx` - Deleted (deprecated)
- `src/app/auth/layout.tsx` - Deleted (deprecated)

## Decisions Made
- Used pendingCookies array pattern in OAuth callback to defer NextResponse.redirect creation until after profile check, since the redirect URL depends on the profile query result. Supabase SSR's setAll callback collects cookies that are applied to the response after it's created.
- Updated header links to /login and /signup (deviation Rule 2 -- these were stale references to deleted pages)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated header.tsx links to new auth routes**
- **Found during:** Task 2 (Delete deprecated auth pages)
- **Issue:** Header component had links to /auth/login and /auth/signup which were being deleted
- **Fix:** Updated all 4 link references to /login and /signup respectively
- **Files modified:** src/components/layout/header.tsx
- **Verification:** grep for auth/login and auth/signup returns no results
- **Committed in:** ea9ac76 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential fix -- header links would have been broken without this update. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- First-time user routing is complete -- new users will see /welcome onboarding flow
- Returning users continue to /dashboard as before
- Ready for remaining onboarding plans (03-02)

## Self-Check: PASSED

- login/actions.ts: FOUND
- auth/callback/route.ts: FOUND
- auth/login/page.tsx: CONFIRMED DELETED
- auth/signup/page.tsx: CONFIRMED DELETED
- auth/layout.tsx: CONFIRMED DELETED
- 03-01-SUMMARY.md: FOUND
- Commit 14f2f12: FOUND
- Commit ea9ac76: FOUND

---
*Phase: 03-onboarding*
*Completed: 2026-02-16*
