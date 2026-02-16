---
phase: 05-referral
plan: 01
subsystem: auth, database
tags: [supabase, middleware, rls, cookies, referral]

# Dependency graph
requires:
  - phase: 05-referral (referral_tables migration)
    provides: referral_clicks table with RLS enabled
provides:
  - Referral cookie persistence through Supabase middleware lifecycle
  - RLS INSERT policy on referral_clicks for authenticated users
affects: [05-referral remaining plans, auth callback referral tracking]

# Tech tracking
tech-stack:
  added: []
  patterns: [post-getUser cookie setting to survive Supabase response re-creation]

key-files:
  created:
    - supabase/migrations/20260216000000_referral_clicks_insert_policy.sql
  modified:
    - src/lib/supabase/middleware.ts

key-decisions:
  - "Referral cookie set AFTER getUser() to survive Supabase setAll response re-creation"
  - "INSERT policy uses WITH CHECK on referred_user_id = auth.uid() for self-only inserts"

patterns-established:
  - "Post-getUser cookie pattern: any non-Supabase cookies must be set after getUser() in middleware to survive setAll re-creation"

# Metrics
duration: 1min
completed: 2026-02-16
---

# Phase 5 Plan 1: Referral Cookie & RLS Bugfixes Summary

**Middleware referral cookie persistence fix + RLS INSERT policy for referral_clicks enabling OAuth callback tracking**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-16T06:13:57Z
- **Completed:** 2026-02-16T06:15:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed referral cookie being destroyed when Supabase's setAll re-creates the response object
- Added RLS INSERT policy allowing authenticated users to insert their own referral click records
- Both fixes critical for referral tracking pipeline to work in production

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix middleware referral cookie lost on Supabase response re-creation** - `817ef1a` (fix)
2. **Task 2: Add RLS INSERT policy for referral_clicks table** - `ef5b20b` (feat)

## Files Created/Modified
- `src/lib/supabase/middleware.ts` - Moved referral cookie set to after getUser() call
- `supabase/migrations/20260216000000_referral_clicks_insert_policy.sql` - INSERT policy for referral_clicks

## Decisions Made
- Referral cookie set AFTER getUser() to survive Supabase setAll response re-creation (plan-specified approach)
- INSERT policy uses WITH CHECK on referred_user_id = auth.uid() for self-only inserts (prevents faking referrals for other users)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Referral cookie now persists through full middleware lifecycle
- OAuth callback can insert referral click records without RLS blocking
- Ready for remaining referral plans (dashboard UI, conversion tracking)

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 05-referral*
*Completed: 2026-02-16*
