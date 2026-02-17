# Integration Verification Report

**Date:** 2026-02-17
**Milestone:** Virtuna Competitors Tool
**Phases Verified:** 7 (01 through 07)

---

## Summary

**Connected:** 22 exports properly wired and consumed
**Orphaned:** 3 exports/actions created but never invoked
**Missing:** 2 expected connections not found
**Broken Flows:** 3 flows have critical breaks

---

## Wiring Summary

### Connected (confirmed import + usage)

| Export | From | Used By |
|--------|------|---------|
| `createScrapingProvider` | Phase 1 (`src/lib/scraping/index.ts`) | `add.ts`, `retry-scrape.ts`, `refresh-competitors/route.ts` |
| `normalizeHandle` | Phase 1 (`src/lib/schemas/competitor.ts`) | `add.ts` |
| `apifyProfileSchema`, `apifyVideoSchema` | Phase 1 (`src/lib/schemas/competitor.ts`) | `apify-provider.ts` |
| `addCompetitor` | Phase 2 (`src/app/actions/competitors/add.ts`) | `compare/page.tsx` (self-benchmarking only) |
| `retryScrape` | Phase 2 (`src/app/actions/competitors/retry-scrape.ts`) | `scrape-error-banner.tsx` |
| `createServiceClient` | Supabase service | `add.ts`, `retry-scrape.ts`, `intelligence-service.ts`, `refresh-competitors/route.ts` |
| `CompetitorCard` | Phase 3 | `competitors-client.tsx` |
| `CompetitorTable` | Phase 3 | `competitors-client.tsx` |
| `CompetitorEmptyState` | Phase 3 | `competitors-client.tsx` |
| `CompetitorCardSkeletonGrid` | Phase 3 | `competitors/loading.tsx` |
| `useCompetitorsStore` | Phase 3 | `competitors-client.tsx` |
| `StaleIndicator` | Phase 7 (`stale-indicator.tsx`) | `competitor-card.tsx`, `competitor-table.tsx`, `detail-header.tsx`, `comparison-client.tsx` |
| `ScrapeErrorBanner` | Phase 7 (`scrape-error-banner.tsx`) | `detail-header.tsx` |
| `formatCount`, `computeGrowthVelocity`, `computeEngagementRate`, `computePostingCadence`, `computeAverageViews` | Phase 1 (`competitors-utils.ts`) | 12 component and page files |
| `formatRelativeTime`, `isStale` | Phase 1 (`competitors-utils.ts`) | `stale-indicator.tsx`, `video-card.tsx`, `intelligence-service.ts` |
| `getAllIntelligence` | Phase 6 (`intelligence-service.ts`) | `[handle]/page.tsx` (server prefetch), `intelligence/route.ts` |
| `getStrategyAnalysis`, `getViralDetection`, `getHashtagGap`, `getRecommendations` | Phase 6 (`intelligence-service.ts`) | `intelligence/route.ts` |
| `IntelligenceSection` | Phase 6 | `[handle]/page.tsx` |
| `verifyCronAuth` | Phase 2 (`cron-auth.ts`) | `refresh-competitors/route.ts` |

---

## Orphaned Exports

**3 items created but never called by UI:**

### 1. `removeCompetitor` — Phase 2

- **File:** `src/app/actions/competitors/remove.ts`
- **Exported:** Yes — `export async function removeCompetitor(competitorId: string)`
- **Imported anywhere:** No — zero imports found in entire codebase
- **Impact:** Remove Competitor flow (E2E Flow 8) is entirely broken. No UI element exists to call this action. Competitors can be added but never removed through the product.

### 2. `addCompetitor` (from dashboard/empty state) — Phase 2

- **File:** `src/app/actions/competitors/add.ts`
- **Called from UI:** Only in `compare/page.tsx` for the "me" (self-benchmarking) case. No form or dialog on the `/competitors` page calls it.
- **Impact:** Add Competitor flow (E2E Flow 1) is entirely broken from the intended entry point. The empty state CTA button (`CompetitorEmptyState`) renders `<Button variant="primary">Add Competitor</Button>` with no `onClick` handler and no form. Users cannot add any competitor from the dashboard.

### 3. `CompetitorTableSkeleton` — Phase 3

- **File:** `src/components/competitors/competitor-table-skeleton.tsx`
- **Exported:** Yes — `export function CompetitorTableSkeleton()`
- **Imported anywhere:** No
- **Impact:** When the table view is active on page load, no skeleton appears (bare loading state). Minor UX gap, not a functional break.

---

## API Coverage

| Route | Has Caller | Notes |
|-------|-----------|-------|
| `GET /api/cron/refresh-competitors` | Yes — Vercel Cron via `vercel.json` (`0 6 * * *`) | Auth via `verifyCronAuth` |
| `POST /api/intelligence/[competitorId]` | Yes — `intelligence-section.tsx` line 85: `fetch(\`/api/intelligence/${competitorId}\`, { method: "POST" })` | |
| `GET /api/intelligence/[competitorId]` | No direct UI caller — detail page uses `getAllIntelligence()` server-side DB read instead | Not a bug; intentional architecture |

---

## Auth Protection

All competitor routes check auth via `supabase.auth.getUser()` and return `null` if no user. Additionally, all detail/compare pages verify the user tracks the specific competitor via a junction table check before serving data.

| Route | Auth Check | Junction Check |
|-------|-----------|----------------|
| `/competitors` (page.tsx) | `if (!user) return null` | N/A (lists user's own) |
| `/competitors/[handle]` (page.tsx) | `if (!user) return null` | `user_competitors` junction verified |
| `/competitors/compare` (page.tsx) | `if (!user) return null` | Per-competitor in `fetchCompetitorData` |
| `addCompetitor` action | `if (!user) return { error }` | N/A |
| `removeCompetitor` action | `if (!user) return { error }` | RLS-enforced via auth client |
| `retryScrape` action | `if (!user) return { error }` | Handle lookup scoped to user |
| `POST /api/intelligence/[competitorId]` | `if (!user)` 401 | Junction verified |
| `GET /api/cron/refresh-competitors` | Bearer token (`CRON_SECRET`) | N/A |

**All sensitive areas: PROTECTED.**

---

## Critical Bug: `creator_profiles` Query Column Mismatch

**Location:** `src/app/(app)/competitors/compare/page.tsx`, line 138

**Bug:**
```ts
// compare/page.tsx (WRONG)
.from("creator_profiles")
.select("tiktok_handle")
.eq("id", user.id)   // <-- queries the row's primary key "id", not "user_id"
.single();
```

**Correct pattern (used everywhere else):**
```ts
// [handle]/page.tsx, sidebar.tsx, intelligence route, login actions (CORRECT)
.from("creator_profiles")
.select("tiktok_handle")
.eq("user_id", user.id)
.maybeSingle();
```

**Impact:** `userHandle` on the compare page is always `null` unless the `creator_profiles.id` UUID happens to equal `auth.user.id` (which only occurs if they share the same UUID — very unlikely). The self-benchmarking feature ("You" option) is silently broken: selecting "me" returns `null` for `userHandle`, so `resolveHandle("me")` returns null, `dataA/dataB` is null, and the comparison never loads. The selector still shows the "You" option (passed via `userHandle={userHandle}` which is null), so the option is hidden but no error is shown.

---

## E2E Flow Status

### Flow 1: Add Competitor

`User pastes @handle -> addCompetitor -> scraping -> profile+videos stored -> card on dashboard -> clickable to detail`

**Status: BROKEN**

- Break point: Step 1 — No UI form exists to accept a handle and call `addCompetitor`.
- `CompetitorEmptyState` renders an `<Button>Add Competitor</Button>` with no `onClick` and no associated form/modal.
- No add-competitor dialog, drawer, or input field exists anywhere in the component tree.
- `addCompetitor` server action is fully implemented and tested (Phase 2); the missing piece is the form that invokes it.
- Steps once a competitor exists: card appears (CONNECTED), card is a `<Link href="/competitors/{handle}">` (CONNECTED).

### Flow 2: Daily Refresh

`Cron triggers -> batch re-scrape -> snapshots stored -> growth charts update -> stale indicators reflect new data`

**Status: COMPLETE**

- `vercel.json` cron: `GET /api/cron/refresh-competitors` at `0 6 * * *` (CONNECTED)
- Route fetches all profiles, calls `scraper.scrapeProfile()` per handle (CONNECTED)
- On success: updates `competitor_profiles`, upserts `competitor_snapshots` (CONNECTED)
- On failure: sets `scrape_status = "failed"` (CONNECTED — card shows error badge, detail page shows retry banner)
- `revalidatePath("/competitors")` triggers cache refresh (CONNECTED)
- Dashboard re-renders with fresh data including updated `last_scraped_at` → `StaleIndicator` reflects new state (CONNECTED)

### Flow 3: Detail Drill-Down

`Dashboard card click -> detail page -> sections render with real data -> AI intelligence section`

**Status: COMPLETE**

- `CompetitorCard` wraps entire card in `<Link href="/competitors/{data.tiktok_handle}">` (CONNECTED)
- `[handle]/page.tsx` fetches profile, verifies junction, parallel-fetches snapshots + videos (CONNECTED)
- `computeGrowthVelocity`, `computeEngagementRate`, etc. called server-side, props passed to client sections (CONNECTED)
- `GrowthSection`, `EngagementSection`, `TopVideosSection`, `ContentAnalysisSection` all receive real data props (CONNECTED)
- `getAllIntelligence(supabase, profile.id)` fetches cached AI from DB (CONNECTED)
- `IntelligenceSection` receives cached props; renders cards or "Generate" CTAs (CONNECTED)

### Flow 4: Comparison Flow

`Compare link -> page -> select 2 competitors -> metrics + charts render -> stale indicators visible`

**Status: COMPLETE** (with caveat on self-benchmarking — see Flow 5)

- Compare link appears in `CompetitorsClient` when `cards.length >= 2` → `<Link href="/competitors/compare">` (CONNECTED)
- `ComparePage` reads `?a=` and `?b=` searchParams (CONNECTED)
- `fetchCompetitorData` looks up profile, verifies junction, parallel-fetches snapshots + videos (CONNECTED)
- `ComparisonClient` renders `ComparisonMetricCard`, `ComparisonBarChart`, `ComparisonGrowthChart` when both sides have data (CONNECTED)
- `StaleIndicator` shown per side (CONNECTED)
- Selector changes push new URL params via `router.push` triggering server re-fetch (CONNECTED)

### Flow 5: Self-Benchmarking

`Compare page -> select "You" -> auto-tracks user handle -> comparison renders`

**Status: BROKEN**

- Break point: `creator_profiles` query uses `.eq("id", user.id)` instead of `.eq("user_id", user.id)`.
- `userHandle` is always `null` (query returns no row).
- `ComparisonSelector` receives `selfHandle={null}` and does not render the "You" option.
- User cannot self-benchmark — the option is invisible, no error is shown.
- **File:** `src/app/(app)/competitors/compare/page.tsx`, line 138.

### Flow 6: AI Generation

`Detail page -> click Generate -> POST /api/intelligence -> AI response -> card renders -> cached on next visit`

**Status: COMPLETE**

- `IntelligenceSection` client component calls `fetch("/api/intelligence/${competitorId}", { method: "POST", body: JSON.stringify({ analysis_type }) })` (CONNECTED)
- `POST /api/intelligence/[competitorId]` route authenticates user, verifies junction, fetches profile + videos + snapshots, builds `CompetitorContext`, dispatches to `getStrategyAnalysis`/`getViralDetection`/`getHashtagGap`/`getRecommendations` (CONNECTED)
- Each function calls DeepSeek or Gemini, then calls `upsertCache` (CONNECTED)
- Response JSON returned to client, `setStrategy/setViral/setHashtagGap/setRecommendations` state updated (CONNECTED)
- On next page load, `getAllIntelligence` reads from `competitor_intelligence` table → pre-populated in `cachedStrategy/cachedViral/cachedHashtagGap/cachedRecommendations` props (CONNECTED)
- **Note:** `hashtag_gap` generation requires user to have connected their TikTok handle AND have their account tracked as a competitor. Error messages guide the user correctly.

### Flow 7: Error Recovery

`Failed scrape -> error badge on card + banner on detail page -> click Retry -> retryScrape action -> profile refreshed`

**Status: COMPLETE**

- Cron marks `scrape_status = "failed"` on error (CONNECTED)
- `competitor-card.tsx` line 76: `{data.scrape_status === "failed" && <span className="text-[10px] text-red-400">Scrape failed</span>}` (CONNECTED)
- `detail-header.tsx` line 62: `{profile.scrape_status === "failed" && <ScrapeErrorBanner handle={profile.tiktok_handle} />}` (CONNECTED)
- `ScrapeErrorBanner` imports `retryScrape` directly, calls it in `useTransition` on button click (CONNECTED)
- `retryScrape` updates profile + upserts snapshot + calls `revalidatePath("/competitors")` and `revalidatePath("/competitors/${handle}")` (CONNECTED)

### Flow 8: Remove Competitor

`Dashboard -> remove action -> competitor disappears from list`

**Status: BROKEN**

- Break point: No UI element exists to trigger removal. `removeCompetitor` server action is implemented but never imported or called anywhere outside its own file.
- Neither `CompetitorCard`, `CompetitorTable`, `CompetitorsClient`, nor `CompetitorEmptyState` expose any remove button/context menu/action.
- `removeCompetitor` correctly deletes the `user_competitors` junction row via RLS-enforced auth client and calls `revalidatePath("/competitors")` — the action is sound, but unreachable.

---

## Detailed Findings

### Missing Connections

| Expected | From | To | Reason |
|----------|------|-----|--------|
| Add Competitor form/dialog | Phase 2 (`addCompetitor` action) | Dashboard / empty state | No UI component calls `addCompetitor`; `CompetitorEmptyState` CTA button has no handler |
| Remove Competitor UI trigger | Phase 2 (`removeCompetitor` action) | Dashboard cards or table rows | No component imports or calls `removeCompetitor` |

### Broken Flows

| Flow | Broken At | Specific Location | Fix Required |
|------|-----------|-------------------|--------------|
| Add Competitor (Flow 1) | Form submission | `src/components/competitors/competitor-empty-state.tsx` — Button has no onClick; no form/modal exists | Create an add-competitor dialog/form that calls `addCompetitor(handle)` and wire the empty state button to open it |
| Self-Benchmarking (Flow 5) | DB query — wrong column | `src/app/(app)/competitors/compare/page.tsx` line 138: `.eq("id", user.id)` should be `.eq("user_id", user.id)` | One-line fix |
| Remove Competitor (Flow 8) | No UI trigger | No component in the codebase imports `removeCompetitor` | Add remove button to `CompetitorCard` and/or `CompetitorTable` rows, calling `removeCompetitor(competitor.id)` |

### Minor Issues

| Issue | Location | Severity |
|-------|----------|----------|
| `CompetitorTableSkeleton` defined but never used | `src/components/competitors/competitor-table-skeleton.tsx` | Low — table view has no skeleton during loading |
| `addCompetitor` called in `compare/page.tsx` ignores its return value | `compare/page.tsx` line 200 | Low — if scraping fails silently during self-tracking setup, user sees no error |

---

## What Works End-to-End

- Daily refresh cron: fully wired (Phase 2 → Phase 1 → DB → Phase 3)
- Detail drill-down: fully wired (Phase 3 → Phase 4 → Phase 6)
- AI generation: fully wired (Phase 6 → API → Phase 6 → DB)
- Error recovery: fully wired (Phase 7 → Phase 2 → Phase 1)
- Comparison (two-competitor): fully wired (Phase 3 → Phase 5)
- All auth protection: solid across all routes and server actions

## What Is Broken

1. **Add Competitor** — no UI form exists; action is orphaned from the dashboard
2. **Remove Competitor** — action is completely orphaned; no UI trigger anywhere
3. **Self-Benchmarking** — one-line column name bug in `compare/page.tsx`

---

*Verified by integration checker on 2026-02-17*
