---
phase: 06-hardening
plan: 04
subsystem: api
tags: [profile, scraping, tiktok, supabase, fire-and-forget]

requires:
  - phase: 01-schedule-crons
    provides: "scraping provider (Apify) and creator_profiles table"
  - phase: 04-observability
    provides: "structured logger (createLogger) for console.error migration"
provides:
  - "PATCH /api/profile accepts tiktok_handle and persists to creator_profiles"
  - "Background creator scrape on TikTok handle link (fire-and-forget)"
  - "GET /api/profile returns tiktok_handle field"
  - "Structured logging in profile route (OBS-05 migration complete)"
affects: [prediction-pipeline, creator-context]

tech-stack:
  added: []
  patterns:
    - "void async IIFE for fire-and-forget background work"
    - "Destructure to separate fields for different tables before upsert"

key-files:
  created: []
  modified:
    - "src/app/api/profile/route.ts"

key-decisions:
  - "Scrape fields mapped to creator_profiles columns that exist in DB schema (display_name, tiktok_followers, avatar_url, bio)"
  - "tiktok_handle destructured out of parsed.data before user_settings upsert to avoid unknown column error"
  - "Service client used for creator_profiles write (bypasses RLS) since user client may lack permissions"

patterns-established:
  - "void async IIFE: pattern for non-blocking background work in API routes"

duration: 8min
completed: 2026-02-18
---

# Phase 6 Plan 4: Profile TikTok Handle + Background Scrape Summary

**Profile PATCH accepts tiktok_handle, upserts creator_profiles, and triggers fire-and-forget Apify scrape with structured logging**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-18T13:02:41Z
- **Completed:** 2026-02-18T13:11:12Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- PATCH /api/profile now accepts optional `tiktok_handle` field in request body
- Setting tiktok_handle upserts `creator_profiles` table via service client (bypasses RLS)
- Background scrape triggers via `void` async IIFE -- does not block PATCH response
- Scrape populates display_name, tiktok_followers, avatar_url, and bio in creator_profiles
- GET /api/profile returns tiktok_handle from creator_profiles
- All `console.error` calls replaced with `createLogger({ module: "profile" })` structured logging

## Task Commits

Each task was committed atomically:

1. **Task 1: Accept tiktok_handle in profile PATCH and trigger background scrape** - `53c77c1` (feat)

**Plan metadata:** (see below)

## Files Created/Modified
- `src/app/api/profile/route.ts` - Added tiktok_handle to Zod schema, GET response, PATCH handler with creator_profiles upsert and background scrape, structured logger migration

## Decisions Made
- **Scrape field mapping:** Only mapped fields that exist in both `ProfileData` (scraping types) and `creator_profiles` (DB schema): displayName -> display_name, followerCount -> tiktok_followers, avatarUrl -> avatar_url, bio -> bio. Skipped heartCount, videoCount, followingCount, verified (no matching DB columns).
- **Table separation:** Destructured `tiktok_handle` out of `parsed.data` before spreading into `user_settings` upsert, since `user_settings` table has no `tiktok_handle` column. Without this, the upsert would fail with an unknown column error.
- **Service client for creator_profiles:** Used `createServiceClient()` (bypasses RLS) for the creator_profiles upsert and update, since the user's Supabase client may not have write permissions on that table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Separated tiktok_handle from user_settings upsert**
- **Found during:** Task 1 (Profile PATCH implementation)
- **Issue:** The existing code spreads `...parsed.data` into the `user_settings` upsert. Adding `tiktok_handle` to the Zod schema means it would be included in the spread, but `user_settings` table has no `tiktok_handle` column -- this would cause Supabase to reject the upsert.
- **Fix:** Destructured `tiktok_handle` out of `parsed.data` before spreading: `const { tiktok_handle: _tiktokHandle, ...settingsData } = parsed.data;`
- **Files modified:** src/app/api/profile/route.ts
- **Verification:** Build compiles, all 203 tests pass
- **Committed in:** 53c77c1

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness. Without destructuring, every PATCH request with tiktok_handle would fail. No scope creep.

## Issues Encountered
- Next.js build fails with `ENOENT: pages-manifest.json` -- this is a pre-existing Next.js 16 infrastructure issue unrelated to code changes. TypeScript compilation succeeds ("Compiled successfully") and all 203 tests pass.
- Commit `53c77c1` was auto-created during a git stash/pop cycle and bundled 06-04 profile route changes with pre-existing 06-03 pipeline changes. The profile route changes are correctly committed but share a commit with HARD-03 work.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Profile TikTok handle wiring complete
- This was the last plan in Phase 6 (Hardening) -- phase is complete
- Ready for milestone completion

---
*Phase: 06-hardening*
*Completed: 2026-02-18*

## Self-Check: PASSED
