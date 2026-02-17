---
phase: 01-schedule-crons-fix-data-pipeline-wiring
plan: 01
subsystem: infra
tags: [vercel-crons, supabase-types, database-schema, evaluation-tier]

# Dependency graph
requires: []
provides:
  - "All 7 cron jobs scheduled in vercel.json"
  - "evaluation_tier column reflected in TypeScript types"
  - "Comprehensive database.types.ts matching all migrations"
affects: [01-02, validate-rules, retrain-ml, calibration-audit, sync-whop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cron schedule ordering: hourly > 6h > 12h > daily > weekly > monthly"
    - "Database types must include all migration columns before build verification"

key-files:
  created:
    - "src/hooks/queries/use-cj-products.ts"
  modified:
    - "vercel.json"
    - "src/types/database.types.ts"
    - "src/lib/engine/rules.ts"
    - "src/app/api/profile/route.ts"
    - "src/app/api/team/route.ts"
    - "src/app/api/team/invite/route.ts"
    - "src/app/api/team/members/[id]/route.ts"
    - "src/app/api/bookmarks/route.ts"
    - "src/app/api/profile/avatar/route.ts"
    - "src/app/api/settings/notifications/route.ts"
    - "src/components/app/brand-deals/earnings-tab.tsx"
    - "src/components/visualization/VisualizationCanvas.tsx"
    - "src/app/(marketing)/pricing/page.tsx"

key-decisions:
  - "Comprehensive database.types.ts update: added all missing tables and columns from migrations rather than just evaluation_tier"
  - "Pricing page set to force-dynamic to avoid WhopCheckoutEmbed SSG error"

patterns-established:
  - "Database types must be regenerated or manually updated when migrations add columns/tables"
  - "Tables in Supabase types remove need for 'as never' casts on .from() calls"

# Metrics
duration: 11min
completed: 2026-02-17
---

# Phase 1 Plan 1: Schedule Crons & Verify Types Summary

**All 7 cron jobs scheduled in vercel.json with evaluation_tier in TypeScript types and comprehensive database type alignment across 9 missing tables/columns**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-17T18:35:54Z
- **Completed:** 2026-02-17T18:46:55Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- vercel.json now declares all 7 cron routes with correct schedules (was 1)
- evaluation_tier + rule_contributions added to rule_library TypeScript types
- database.types.ts brought fully up to date with all 15 migration files
- Removed 12+ `as never` type-safety workarounds across 6 API route files
- pnpm build exits 0 with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add all 7 cron entries to vercel.json and verify build** - `9fe3824` (feat)
2. **Task 2: Verify evaluation_tier migration and regenerate TypeScript types** - `4a48170` (chore)

## Files Created/Modified
- `vercel.json` - 7 cron entries (calculate-trends, scrape-trending, sync-whop, refresh-competitors, validate-rules, retrain-ml, calibration-audit)
- `src/types/database.types.ts` - Added evaluation_tier, rule_contributions to rule_library; added referral_codes/clicks/conversions, tiktok_accounts, user_settings, teams, team_members, user_bookmarks, affiliate_links tables; added onboarding/trial/v2-expansion columns
- `src/hooks/queries/use-cj-products.ts` - Stub hook returning empty AffiliateProgram[] (CJ API not yet integrated)
- `src/lib/engine/rules.ts` - Updated stale comment on data-shape cast
- `src/app/api/profile/route.ts` - Removed `as never` / `as Record<string, unknown>` casts
- `src/app/api/team/route.ts` - Removed `as never` casts on team_members/teams queries
- `src/app/api/team/invite/route.ts` - Removed `as never` casts
- `src/app/api/team/members/[id]/route.ts` - Removed `as never` / `as Record<string, unknown>` casts
- `src/app/api/bookmarks/route.ts` - Removed `as never` casts on user_bookmarks queries
- `src/app/api/profile/avatar/route.ts` - Removed `as never` cast on user_settings upsert
- `src/app/api/settings/notifications/route.ts` - Typed updates with UserSettingsInsert
- `src/components/app/brand-deals/earnings-tab.tsx` - Added missing EarningsTabSkeleton import
- `src/components/visualization/VisualizationCanvas.tsx` - Replaced three-stdlib import with inline type
- `src/app/(marketing)/pricing/page.tsx` - Added force-dynamic to avoid WhopCheckoutEmbed SSG crash

## Decisions Made
- Updated database.types.ts comprehensively (9 missing tables + 10 missing columns) rather than just adding evaluation_tier, because the build would not pass with partial types
- Used `force-dynamic` on pricing page instead of fixing the underlying WhopCheckoutEmbed SSG issue, which is a third-party library concern
- Created use-cj-products as a stub returning empty results rather than removing the import chain, preserving the intended CJ integration point

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing use-cj-products hook**
- **Found during:** Task 1 (build verification)
- **Issue:** `src/hooks/queries/use-cj-products.ts` referenced in index.ts and deals-tab.tsx but file did not exist
- **Fix:** Created stub hook returning empty AffiliateProgram[] array
- **Files modified:** src/hooks/queries/use-cj-products.ts (created)
- **Verification:** pnpm build passes
- **Committed in:** 9fe3824

**2. [Rule 3 - Blocking] Missing referral/onboarding/trial/v2 columns in database.types.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** referral_codes table, onboarding_completed_at column, and 7 other tables/columns from migrations missing from TypeScript types, causing build errors
- **Fix:** Added all missing tables (referral_codes, referral_clicks, referral_conversions, tiktok_accounts, user_settings, teams, team_members, user_bookmarks, affiliate_links) and columns (onboarding_step, primary_goal, onboarding_completed_at, is_trial, trial_ends_at, behavioral_predictions, feature_vector, reasoning, warnings, input_mode, has_video, gemini_score)
- **Files modified:** src/types/database.types.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 9fe3824

**3. [Rule 1 - Bug] as-never type casts causing TypeScript errors**
- **Found during:** Task 1 (build verification)
- **Issue:** After adding tables to database.types.ts, `null as Record<string, unknown>` casts in profile/team/bookmark routes failed strict TypeScript checks
- **Fix:** Removed all `as never` casts and `as Record<string, unknown>` workarounds, using proper typed access
- **Files modified:** src/app/api/profile/route.ts, src/app/api/team/route.ts, src/app/api/team/invite/route.ts, src/app/api/team/members/[id]/route.ts, src/app/api/bookmarks/route.ts, src/app/api/profile/avatar/route.ts, src/app/api/settings/notifications/route.ts
- **Verification:** pnpm build passes with zero TypeScript errors
- **Committed in:** 9fe3824

**4. [Rule 3 - Blocking] Missing EarningsTabSkeleton import**
- **Found during:** Task 1 (build verification)
- **Issue:** EarningsTabSkeleton used in JSX but not imported
- **Fix:** Added import statement
- **Files modified:** src/components/app/brand-deals/earnings-tab.tsx
- **Verification:** pnpm build passes
- **Committed in:** 9fe3824

**5. [Rule 3 - Blocking] Missing three-stdlib type declaration**
- **Found during:** Task 1 (build verification)
- **Issue:** `three-stdlib` package not installed, type import failing
- **Fix:** Replaced import with inline `any` type (visualization component, low impact)
- **Files modified:** src/components/visualization/VisualizationCanvas.tsx
- **Verification:** pnpm build passes
- **Committed in:** 9fe3824

**6. [Rule 3 - Blocking] Pricing page SSG crash from WhopCheckoutEmbed**
- **Found during:** Task 1 (build verification)
- **Issue:** React.Children.only error during static generation of /pricing page from @whop/checkout
- **Fix:** Added `export const dynamic = "force-dynamic"` to skip SSG
- **Files modified:** src/app/(marketing)/pricing/page.tsx
- **Verification:** pnpm build completes with all 54 pages generated
- **Committed in:** 9fe3824

---

**Total deviations:** 6 auto-fixed (2 bugs, 4 blocking)
**Impact on plan:** All auto-fixes were necessary to achieve the plan's requirement of `pnpm build` exiting 0. The comprehensive type update is larger than planned but was mandatory -- partial types meant partial build failures. No scope creep beyond what was needed for a green build.

## Issues Encountered
- The database.types.ts was significantly out of date (missing 9 tables and 10+ columns from 15 migration files). This required a comprehensive manual update since `supabase gen types` was not available locally. The types were reconstructed from migration SQL files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 cron jobs are scheduled and will execute on Vercel deployment
- evaluation_tier is in TypeScript types, unblocking semantic rule evaluation in validate-rules
- database.types.ts is now comprehensive, reducing future type-cast workarounds
- Plan 01-02 can proceed with data pipeline wiring

---
*Phase: 01-schedule-crons-fix-data-pipeline-wiring*
*Completed: 2026-02-17*

## Self-Check: PASSED

- vercel.json: FOUND
- src/types/database.types.ts: FOUND
- src/hooks/queries/use-cj-products.ts: FOUND
- src/lib/engine/rules.ts: FOUND
- 01-01-SUMMARY.md: FOUND
- Commit 9fe3824: FOUND (Task 1)
- Commit 4a48170: FOUND (Task 2)
