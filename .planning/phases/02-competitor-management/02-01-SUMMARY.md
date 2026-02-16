---
phase: 02-competitor-management
plan: 01
subsystem: api
tags: [server-actions, supabase, scraping, junction-table, rls, tiktok]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "Supabase clients (server.ts, service.ts), scraping provider (index.ts, apify-provider.ts), schemas (competitor.ts), DB migration (competitor_tables.sql)"
provides:
  - "addCompetitor server action -- validates handle, scrapes TikTok via Apify, upserts profile/snapshot/videos, links user via junction table"
  - "removeCompetitor server action -- deletes user junction row only, preserves shared profile"
  - "ActionResult type pattern for server action return values"
affects: [03-competitor-ui, 04-dashboard, scheduled-scraping]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service client for RLS-bypassed writes, auth client for user-scoped operations"
    - "Junction table deduplication: find-or-create profile, then link user"
    - "Postgres 23505 error code for duplicate detection"
    - "Non-fatal video scraping with console.warn fallback"

key-files:
  created:
    - src/app/actions/competitors/add.ts
    - src/app/actions/competitors/remove.ts
  modified:
    - src/types/database.types.ts

key-decisions:
  - "Use service client for all profile/snapshot/video writes (RLS requires existing junction row that doesn't exist yet during add)"
  - "Video scraping failure is non-fatal -- profile still gets tracked even if videos fail"
  - "Added competitor table types to database.types.ts inline (no supabase gen-types CLI needed)"

patterns-established:
  - "Server action return type: { error?: string; data?: T } for success, { error?: string; success?: boolean } for void operations"
  - "Auth check pattern: createClient() -> getUser() -> early return { error: 'Not authenticated' }"
  - "Dual-client pattern: service client for privileged ops, auth client for user-scoped ops in same action"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 2 Plan 1: Add/Remove Competitor Server Actions Summary

**Server actions for adding (scrape + deduplicate + link) and removing (junction-only delete) TikTok competitors using dual Supabase clients**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T17:18:23Z
- **Completed:** 2026-02-16T17:20:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `addCompetitor` server action with full scraping + deduplication flow using junction table pattern
- Created `removeCompetitor` server action that safely deletes only the user link, preserving shared profiles
- Added competitor table types to database.types.ts for full TypeScript type safety

## Task Commits

Each task was committed atomically:

1. **Task 1: Create addCompetitor server action with junction table deduplication** - `9082bf0` (feat)
2. **Task 2: Create removeCompetitor server action** - `5ccffc8` (feat)

## Files Created/Modified
- `src/app/actions/competitors/add.ts` - Server action: normalize handle, scrape profile via Apify, upsert profile/snapshot/videos with service client, insert junction row with auth client
- `src/app/actions/competitors/remove.ts` - Server action: auth check, delete junction row only via auth client, preserve shared profile
- `src/types/database.types.ts` - Added competitor_profiles, competitor_snapshots, competitor_videos, user_competitors table types

## Decisions Made
- **Service client for profile writes:** RLS on competitor_profiles SELECT requires an existing junction row. During add, the junction row doesn't exist yet, so service client (bypasses RLS) is needed for profile lookup and all data writes. Auth client is used only for the junction row insert where RLS policy checks `user_id = auth.uid()`.
- **Non-fatal video scraping:** If video scraping fails after profile creation, the competitor is still tracked. Videos can be backfilled later. This prevents a transient Apify failure from blocking the entire add flow.
- **Inline database types:** Added competitor table types directly to database.types.ts rather than running `supabase gen types`. This was necessary because the migration hasn't been applied to a live Supabase instance yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added competitor table types to database.types.ts**
- **Found during:** Task 1 (addCompetitor implementation)
- **Issue:** database.types.ts didn't include competitor_profiles, user_competitors, competitor_snapshots, or competitor_videos tables. TypeScript would error on `.from("competitor_profiles")` calls.
- **Fix:** Added all 4 competitor table type definitions (Row, Insert, Update, Relationships) to the Database type.
- **Files modified:** src/types/database.types.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 9082bf0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both server actions ready to be consumed by Phase 3 UI components via `useActionState` or direct invocation
- `addCompetitor(handle)` and `removeCompetitor(competitorId)` are fully typed and export from `src/app/actions/competitors/`
- Database types updated -- all Supabase queries are type-safe

## Self-Check: PASSED

- FOUND: src/app/actions/competitors/add.ts
- FOUND: src/app/actions/competitors/remove.ts
- FOUND: src/types/database.types.ts
- FOUND: .planning/phases/02-competitor-management/02-01-SUMMARY.md
- FOUND: commit 9082bf0 (Task 1)
- FOUND: commit 5ccffc8 (Task 2)

---
*Phase: 02-competitor-management*
*Completed: 2026-02-16*
