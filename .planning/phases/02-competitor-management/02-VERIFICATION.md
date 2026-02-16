---
phase: 02-competitor-management
verified: 2026-02-16T18:28:00Z
status: human_needed
score: 4/4 automated checks verified
re_verification: false
human_verification:
  - test: "Add a TikTok competitor via UI form"
    expected: "Handle validates, profile/videos scrape, competitor appears in user's tracked list"
    why_human: "Requires UI interaction (Phase 3) and end-to-end flow testing with real TikTok API"
  - test: "Remove a tracked competitor via UI"
    expected: "Confirmation dialog appears, competitor disappears from list, shared profile preserved in DB"
    why_human: "Requires UI interaction (Phase 3) and visual confirmation of removal"
  - test: "Trigger cron route manually and verify daily snapshots"
    expected: "All profiles re-scraped, competitor_snapshots gets new rows for today's date, failures logged but batch continues"
    why_human: "Requires Vercel deployment with CRON_SECRET, manual trigger via curl/Vercel dashboard, and DB inspection"
  - test: "Verify duplicate tracking prevention"
    expected: "Adding same handle twice shows 'already tracking' error, no duplicate junction rows created"
    why_human: "Requires UI interaction and database inspection"
---

# Phase 2: Competitor Management Verification Report

**Phase Goal:** Users can add and remove competitors with real data flowing in on a schedule
**Verified:** 2026-02-16T18:28:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can paste a TikTok @handle and the system validates it exists, fetches initial profile + video data, and adds it to their tracked list | ? NEEDS_HUMAN | Server action `addCompetitor` exists with full scraping flow (validated handle normalization, Apify profile/video scraping, junction table insert, duplicate prevention via 23505 error). **No UI exists yet (Phase 3)** — cannot verify end-to-end without form submission. |
| 2 | User can remove a tracked competitor via confirmation dialog and it disappears from their list | ? NEEDS_HUMAN | Server action `removeCompetitor` exists with junction-only delete (preserves shared profile). **No UI exists yet (Phase 3)** — cannot verify confirmation dialog or visual removal. |
| 3 | Vercel cron route triggers daily batch re-scraping of all tracked competitors, collecting fresh follower/engagement snapshots for time-series | ? NEEDS_HUMAN | Cron route exists at `/api/cron/refresh-competitors` with per-handle scraping, snapshot upsert, and `vercel.json` daily schedule at 6:00 AM UTC. **Requires deployment to Vercel** with `CRON_SECRET` env var and manual trigger or 24h wait to verify execution. |
| 4 | Scraping failures for individual handles do not block the batch -- failed handles are logged and skipped | ✓ VERIFIED | Code inspection confirms per-handle try/catch in cron route (lines 48-96), failed handles update `scrape_status: "failed"` and loop continues without break/rethrow. |

**Score:** 4/4 automated checks verified (code exists and wired correctly), but 3/4 truths need human verification due to missing UI (Phase 3) and deployment requirements.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/actions/competitors/add.ts` | addCompetitor server action with scraping + deduplication | ✓ VERIFIED | Exports `addCompetitor(handle)`, uses service client for RLS-bypassed profile ops, auth client for junction insert, handles 23505 duplicate error, calls `revalidatePath("/competitors")`. Substantive: 146 lines with full scraping flow. Wired: Imports all Phase 1 dependencies (`createScrapingProvider`, `createServiceClient`, `normalizeHandle`). **Not yet consumed by UI (Phase 3)**. |
| `src/app/actions/competitors/remove.ts` | removeCompetitor server action with junction-only delete | ✓ VERIFIED | Exports `removeCompetitor(competitorId)`, deletes only `user_competitors` row via auth client RLS, preserves shared profile. Substantive: 44 lines with auth check + delete + revalidate. Wired: Imports `createClient`. **Not yet consumed by UI (Phase 3)**. |
| `src/lib/cron-auth.ts` | Cron auth utility with CRON_SECRET Bearer check | ✓ VERIFIED | Exports `verifyCronAuth(request)`, returns `null` on success or 401 `NextResponse` on failure. Substantive: 18 lines with Bearer token comparison. Wired: Imported by cron route. |
| `src/app/api/cron/refresh-competitors/route.ts` | Batch re-scraping cron route with error isolation | ✓ VERIFIED | Exports `GET` handler and `maxDuration=60`, uses `verifyCronAuth`, fetches all profiles via service client, per-handle scraping with try/catch isolation, snapshot upsert with `onConflict`, updates `scrape_status`. Substantive: 107 lines with full batch processing logic. Wired: Imports `verifyCronAuth`, `createServiceClient`, `createScrapingProvider`. |
| `vercel.json` | Vercel cron schedule config | ✓ VERIFIED | Contains cron entry for `/api/cron/refresh-competitors` with schedule `0 6 * * *` (daily 6:00 AM UTC). Valid JSON. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `add.ts` | `src/lib/scraping/index.ts` | `createScrapingProvider().scrapeProfile()` | ✓ WIRED | Import line 6, usage lines 52, 55, 105 |
| `add.ts` | `src/lib/supabase/service.ts` | `createServiceClient()` | ✓ WIRED | Import line 5, usage line 33 |
| `add.ts` | `src/lib/schemas/competitor.ts` | `normalizeHandle()` | ✓ WIRED | Import line 8, usage line 27 |
| `add.ts` | `src/lib/supabase/server.ts` | `createClient()` | ✓ WIRED | Import line 4, usage line 17 |
| `remove.ts` | `src/lib/supabase/server.ts` | `createClient()` | ✓ WIRED | Import line 4, usage line 15 |
| `refresh-competitors/route.ts` | `src/lib/cron-auth.ts` | `verifyCronAuth()` | ✓ WIRED | Import line 3, usage line 21 |
| `refresh-competitors/route.ts` | `src/lib/supabase/service.ts` | `createServiceClient()` | ✓ WIRED | Import line 4, usage line 24 |
| `refresh-competitors/route.ts` | `src/lib/scraping/index.ts` | `createScrapingProvider()` | ✓ WIRED | Import line 5, usage line 25 |
| `vercel.json` | `refresh-competitors/route.ts` | Cron path config | ✓ WIRED | Path `/api/cron/refresh-competitors` matches route file location |

**All key links verified.** All imports resolve, all function calls match expected signatures.

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| COMP-01: User can add competitor by pasting @handle | ⚠️ PARTIAL | Server action exists and wired, but no UI form (Phase 3) |
| COMP-02: System validates handle and fetches profile via Apify | ✓ SATISFIED | `addCompetitor` uses `normalizeHandle()` + `scraper.scrapeProfile()` |
| COMP-05: User can remove tracked competitor | ⚠️ PARTIAL | Server action exists and wired, but no confirmation dialog UI (Phase 3) |
| DATA-06: Vercel cron for batch re-scraping | ✓ SATISFIED | Cron route + `vercel.json` schedule exists, needs deployment verification |
| GROW-06: Daily follower/engagement snapshots | ✓ SATISFIED | Cron route upserts to `competitor_snapshots` with `onConflict: "competitor_id,snapshot_date"` |

**Summary:** 3/5 requirements satisfied, 2/5 partial (blocked by Phase 3 UI work).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| N/A | N/A | N/A | N/A | No anti-patterns detected |

**Notes:**
- No TODO/FIXME/placeholder comments
- No empty implementations or stub returns
- No console.log-only handlers
- All error cases return structured error objects
- Video scraping failure is intentionally non-fatal (line 125 in add.ts) with console.warn — this is good error isolation, not a stub

### Human Verification Required

#### 1. End-to-End Add Competitor Flow

**Test:**
1. Deploy app to Vercel with Supabase env vars configured
2. Navigate to competitors page (once Phase 3 UI exists)
3. Paste a valid TikTok handle (e.g., `@charlidamelio`) into add competitor form
4. Submit form

**Expected:**
- Handle validates (normalized to lowercase, `@` stripped if present)
- Loading state shows while scraping
- Profile data fetched from Apify (follower count, bio, avatar, etc.)
- Videos scraped and stored (up to 30 most recent)
- Initial snapshot created with today's date
- Competitor appears in user's tracked list immediately
- Success message displayed

**Why human:** Requires UI interaction (Phase 3), real TikTok API via Apify, and visual confirmation of data flow from form submission → scraping → database → UI update.

#### 2. Duplicate Tracking Prevention

**Test:**
1. Add a competitor (e.g., `@charlidamelio`)
2. Attempt to add the same handle again

**Expected:**
- Error message: "You are already tracking this competitor"
- No duplicate junction row created in `user_competitors` table
- Existing competitor data unchanged

**Why human:** Requires UI interaction, form submission, and database inspection to verify no duplicate rows. Postgres 23505 error code handling verified in code (line 137), but end-to-end flow needs manual test.

#### 3. Remove Competitor Flow

**Test:**
1. Click "Remove" button on a tracked competitor card (Phase 3 UI)
2. Confirm in confirmation dialog

**Expected:**
- Confirmation dialog appears with competitor's handle
- On confirm: competitor disappears from user's list
- Database check: `user_competitors` junction row deleted
- Database check: `competitor_profiles` row still exists (shared profile preserved)
- Other users tracking same competitor unaffected

**Why human:** Requires UI interaction (confirmation dialog is Phase 3), visual confirmation of removal, and database inspection to verify shared profile preservation.

#### 4. Cron Batch Re-Scraping

**Test:**
1. Deploy to Vercel with `CRON_SECRET` env var
2. Add 3-5 competitors with different handles
3. Wait 24 hours for scheduled cron OR manually trigger via:
   ```bash
   curl -X GET https://your-app.vercel.app/api/cron/refresh-competitors \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
4. Check Vercel logs and database

**Expected:**
- Cron route executes successfully
- All competitor profiles updated with fresh follower/video counts
- New rows in `competitor_snapshots` with today's `snapshot_date`
- If any handle fails (e.g., account deleted), it's logged but batch continues
- Failed handles have `scrape_status: "failed"` in `competitor_profiles`
- Response JSON: `{ refreshed: N, failed: M, total: N+M }`

**Why human:** Requires Vercel deployment, `CRON_SECRET` configuration, manual trigger or 24-hour wait, log inspection, and database query to verify snapshot creation and error isolation.

#### 5. Video Scraping Non-Fatal Failure

**Test:**
1. Add a competitor whose video scraping might fail (e.g., private account, rate limit)
2. Monitor console logs during add flow

**Expected:**
- Profile still gets tracked even if video scraping fails
- Console warning logged: `[addCompetitor] Video scraping failed (non-fatal):`
- Competitor appears in user's list with profile data (no videos)
- No error shown to user (graceful degradation)

**Why human:** Difficult to reliably trigger video scraping failure in test environment. Requires monitoring console logs and verifying competitor was still added despite video failure.

### Gaps Summary

**No blocking gaps detected.**

All required artifacts exist, are substantive (not stubs), and are correctly wired to Phase 1 dependencies. The phase goal achievement is blocked only by:

1. **Phase 3 dependency:** No UI exists yet to call `addCompetitor` and `removeCompetitor` server actions
2. **Deployment requirement:** Cron route requires Vercel deployment with `CRON_SECRET` to verify execution

These are expected blockers, not gaps in Phase 2 implementation. Phase 2 delivered:
- ✓ Server-side data mutation layer (add/remove actions)
- ✓ Scheduled data refresh infrastructure (cron route + vercel.json)
- ✓ Proper error handling and isolation
- ✓ Junction table deduplication pattern
- ✓ Dual-client pattern (service for RLS bypass, auth for user scope)

**Recommendation:** Mark Phase 2 as complete pending Phase 3 UI integration and post-deployment cron verification.

---

_Verified: 2026-02-16T18:28:00Z_
_Verifier: Claude (gsd-verifier)_
