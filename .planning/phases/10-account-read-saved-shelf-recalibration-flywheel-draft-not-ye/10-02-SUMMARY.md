---
phase: 10-account-read-saved-shelf-recalibration-flywheel
plan: 02
subsystem: flywheel-persistence
tags: [supabase, migrations, rls, apify, scraping, crud-repos, flywheel, saved-shelf]

# Dependency graph
requires:
  - phase: 07-audience
    provides: "audiences table + audience-repo.ts CRUD idiom (SupabaseClient param, session user_id, RLS own-rows)"
  - phase: 08-discover-remix
    provides: "apidojo split actors + clockworks VIDEO_ACTOR single-URL path + apifyVideoSchema (competitor.ts)"
  - phase: 10
    plan: 01
    provides: "Disposition union, reconcile.ts CALIBRATION/CRAFT splits, RealizedMetrics/MetricSource types"
provides:
  - "outcome_signatures / reconciliations / saved_items migration files (3 sibling tables, RLS own-rows)"
  - "ApifyScrapingProvider.scrapeSinglePostMetrics(url): apidojo tiktok-scraper-api single-post metrics → VideoData"
  - "outcome-repo / reconciliation-repo / shelf-repo typed session-safe CRUD"
affects: [10-03-outcome-capture, 10-04-saved-shelf-ui, 10-05-recalibration-wiring, 10-06-reconciliation-log, 10-07-db-push-regen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-table strategy: NEW outcome_signatures table, never widen the contested outcomes table (Pitfall 1)"
    - "Single-URL metric capture = apidojo/tiktok-scraper-api Single Post Query tier (startUrls:[url]); clockworks retired for metrics, kept only for Remix mp4 resolution"
    - "Distinct clockworks vs apidojo remap — wrong schema silently zeros every metric (apidojo-remap.test.ts guard)"
    - "Repos: user_id from session never input (CR-01); (supabase as any) interim cast + TODO(10-07) until types regen"

key-files:
  created:
    - supabase/migrations/20260619100000_outcome_signatures.sql
    - supabase/migrations/20260619100100_reconciliations.sql
    - supabase/migrations/20260619100200_saved_items.sql
    - src/lib/flywheel/outcome-repo.ts
    - src/lib/flywheel/reconciliation-repo.ts
    - src/lib/shelf/shelf-repo.ts
  modified:
    - src/lib/scraping/apify-provider.ts
    - src/lib/scraping/types.ts
    - src/lib/flywheel/reconcile.ts
    - .planning/phases/10-account-read-saved-shelf-recalibration-flywheel-draft-not-ye/10-SPIKE.md

key-decisions:
  - "Single-URL scrape = apidojo/tiktok-scraper-api Single Post Query tier (startUrls:[url]); the SEPARATE single-post-capable apidojo actor, not the all-in-one one. clockworks retired for metrics"
  - "scrapeSinglePostMetrics uses apidojoVideoSchema/remapApidojoVideo (bookmarks→saves), never the clockworks schema — wrong schema would zero every metric"
  - "A1 calibration/craft split locked owner-confirmed; [ASSUMED] markers removed from reconcile.ts"
  - "DB push deferred to Plan 07 (BLOCKING gate) — migrations written + committed, casts interim"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-06-19
---

# Phase 10 Plan 02: Flywheel + Shelf Persistence Rails Summary

**Three RLS-protected sibling Supabase tables (outcome_signatures, reconciliations, saved_items) that never touch the contested `outcomes` table, plus a single-URL public-metric scrape on apidojo's `tiktok-scraper-api` Single Post Query tier and three session-safe typed CRUD repos — the data + scrape rails Plans 03-06 wire against, with the A1 calibration/craft split now owner-locked.**

## Performance

- **Duration:** ~25 min (continuation agent; prior agent reached the Task-1 checkpoint)
- **Started (continuation):** 2026-06-19T14:09Z
- **Completed:** 2026-06-19
- **Tasks:** 3 (Task 1 = blocking-human spike sign-off; Tasks 2-3 = auto)
- **Files created:** 6 · **Files modified:** 4

## Accomplishments

- **Task 1 (spike sign-off + provider correction):** Recorded owner APPROVAL of the single-URL metric shape and the A1 split in `10-SPIKE.md`, and the FINAL provider finding (see Deviations) — single-URL metric capture runs apidojo's `tiktok-scraper-api` Single Post Query tier.
- **Task 2 (migrations + scrape):** Wrote 3 sibling migrations with RLS own-rows-only, none touching `outcomes`/`real_*`. Added `scrapeSinglePostMetrics(url)` on `ApifyScrapingProvider` — apidojo `tiktok-scraper-api` (`startUrls:[url]`), remapped via `remapApidojoVideo` (bookmarks→saves) + an SSRF guard on the untrusted paste-URL input.
- **Task 3 (typed CRUD repos):** `outcome-repo`, `reconciliation-repo`, `shelf-repo` mirroring `audience-repo.ts` — `SupabaseClient` param, zod-validated input, `user_id` from session never input (CR-01), `(supabase as any)` interim cast with `TODO(10-07)`.
- **A1 lock:** Removed the `[ASSUMED] A1` markers from Plan 01's `reconcile.ts` (3 occurrences) now that the split is owner-confirmed — `calibration={collector,connector,converter}`, `craft={scanner,lurker,skeptic}`.

## Task Commits

1. **Task 1: spike sign-off + (interim) provider correction** — `c10762a1` (docs)
2. **Task 2: migrations + single-URL scrape** — `14e5ddb5` (feat)
3. **Task 3: typed CRUD repos** — `69b67134` (feat)
4. **A1 marker removal** — `b9dbd25f` (refactor)
5. **Provider re-correction → apidojo tiktok-scraper-api** — `5d9e245b` (fix, code+tests)
6. **SPIKE provider finding corrected** — `c9bb5575` (fix, docs)

_Commits 5-6 supersede the interim clockworks-single-URL decision after the coordinator surfaced the separate single-post-capable apidojo actor (`apidojo/tiktok-scraper-api`)._

## Files Created/Modified

- `supabase/migrations/20260619100000_outcome_signatures.sql` — predicted/realized vectors, provenance, raw_metrics, `analysis_id text` (NOT uuid), `audience_id` pin, `source` paste_url|drift_scrape; RLS `os_all_own`.
- `supabase/migrations/20260619100100_reconciliations.sql` — cross-creator seed: niche/goal_intent/follower_tier bucket/divergence/classification/proposal_state; RLS `rec_all_own`. Rails only.
- `supabase/migrations/20260619100200_saved_items.sql` — flat typed shelf, `item_type` CHECK, no folder_id/tags; RLS `saved_all_own`.
- `src/lib/scraping/apify-provider.ts` — `scrapeSinglePostMetrics` (apidojo `tiktok-scraper-api`, `startUrls:[url]`, remap via `remapApidojoVideo`) + `isAllowedPostUrl` SSRF guard + `SINGLE_POST_METRICS_ACTOR` const.
- `src/lib/scraping/types.ts` — `scrapeSinglePostMetrics` added to `ScrapingProvider`.
- `src/lib/scraping/__tests__/apidojo-remap.test.ts` — single-post-output remap cases + Pitfall-1 guard.
- `src/lib/flywheel/{outcome,reconciliation}-repo.ts`, `src/lib/shelf/shelf-repo.ts` — session-safe CRUD.
- `src/lib/flywheel/reconcile.ts` — `[ASSUMED] A1` → owner-confirmed.
- `10-SPIKE.md` — owner sign-off + FINAL provider-correction record.

## Decisions Made

- **Single-URL scrape = apidojo `tiktok-scraper-api` Single Post Query tier.** This is a SEPARATE actor from the all-in-one `apidojo/tiktok-scraper` (which forbids single-post URLs, the original Pitfall 2). `tiktok-scraper-api` takes `startUrls:[url]` → exactly 1 video, no 10-post minimum. clockworks is retired for single-URL metric capture (kept only for the Remix mp4-resolution path in `resolveVideoUrl`, which needs the downloadable KV media apidojo's metrics-only actor doesn't return).
- **`scrapeSinglePostMetrics` remaps via `remapApidojoVideo`/`apidojoVideoSchema` (bookmarks→saves).** The single-post output shape matches the Discover apidojo shape (`views/likes/comments/shares/bookmarks`), so the existing apidojo remap applies directly. Using the clockworks schema instead would silently zero every metric (the bug `apidojo-remap.test.ts` guards — extended with single-post cases).
- **SSRF guard added on the paste-URL input** (`isAllowedPostUrl`: HTTPS + TikTok host) — `resolveVideoUrl` only guards the resolved mp4 host, but the paste-URL is untrusted input (T-10-05). Rule 2 critical-functionality add.
- **Requirements NOT marked complete.** FLYWHEEL-01/05 and SAVE-01 span multiple plans (per REQUIREMENTS traceability: FLYWHEEL-01→10-02/03/07, SAVE-01→10-02/04, FLYWHEEL-05→10-02/06). This plan lays only the rails; the requirements complete in their later plans.

## Deviations from Plan

### Auto-applied (surfaced, not silently overridden)

**1. [Rule 3 - Provider correction, resolved in two passes] Single-URL scrape → apidojo `tiktok-scraper-api` Single Post Query tier**
- **Found during:** Task 1 scout, then a coordinator-relayed research correction.
- **Pass 1 (interim):** The codebase + RESEARCH §Pitfall 2 document that `apidojo/tiktok-scraper` (the all-in-one Discover actor) forbids single-post URLs (≥10 posts/query). Reading "use apidojo" as that actor would ship broken scraping, so the interim implementation kept clockworks `VIDEO_ACTOR` for single-URL metrics and documented the constraint.
- **Pass 2 (final, implemented):** Further research surfaced a SEPARATE actor — `apidojo/tiktok-scraper-api` — with a "Single Post Query" tier (`startUrls:[url]` → exactly 1 video, no 10-post minimum, $0.003 flat). This is the correct single source. `scrapeSinglePostMetrics` now calls `apidojo/tiktok-scraper-api` and remaps via `remapApidojoVideo` (`bookmarks→saves`); the clockworks remap helper was removed. clockworks is retired for single-URL metrics (kept only for `resolveVideoUrl` Remix mp4 resolution). Recorded in `10-SPIKE.md` "PROVIDER CORRECTION — FINAL".
- **Verification approach + residual risk:** No live token was available to probe `tiktok-scraper-api`; Context7 has no Apify-store actor docs. The input field (`startUrls`) and saves field (`bookmarks`) follow the actor's documented Single Post Query tier + the existing apidojo schema, and are unit-tested via `apidojo-remap.test.ts`. **Plan 07 UAT must verify the live `startUrls`/`bookmarks` field names against a real token** and adapt the remap if the dataset version differs (noted in code + SPIKE).
- **Files modified:** `src/lib/scraping/apify-provider.ts`, `src/lib/scraping/__tests__/apidojo-remap.test.ts`, `10-SPIKE.md`.
- **Commits:** `c10762a1` + `14e5ddb5` (interim), `5d9e245b` + `c9bb5575` (final apidojo correction).

**2. [Rule 2 - Critical functionality] SSRF guard on the paste-URL input**
- **Found during:** Task 2 (threat model T-10-05).
- **Issue:** `scrapeSinglePostMetrics` takes an untrusted pasted URL; `resolveVideoUrl` only guards the *resolved* mp4 host, leaving the input URL unguarded.
- **Fix:** Added `isAllowedPostUrl` (HTTPS + TikTok host allowlist + private-IP reject); the method throws `ssrf_rejected` before the actor call.
- **Files modified:** `src/lib/scraping/apify-provider.ts`.
- **Commit:** `14e5ddb5`.

## Authentication Gates

None in Tasks 2-3. Task 1 was a blocking-human OWNER gate (the spike sign-off) — resolved by the owner's "approved" response carried in this continuation prompt.

## Issues Encountered

None beyond the provider correction (Deviation 1).

## User Setup Required

None — zero new packages (RESEARCH Package Legitimacy Audit). **DB push is deferred to Plan 07** (BLOCKING gate): the 3 migrations are written + committed but NOT pushed; the repos use `(supabase as any)` interim casts until Plan 07 runs `supabase db push` + regenerates `database.types.ts` + removes the casts.

## Verification

- `npm run build` → **passes** (types resolve off committed migrations + interim casts).
- `grep -L "ALTER TABLE outcomes|real_*"` on all 3 migrations → **all clean** (no forbidden patterns; no folder_id/tags).
- `npx vitest run src/lib/scraping/` → **25 passed / 0 failed** (incl. the new apidojo single-post remap cases).
- `npx vitest run src/lib/flywheel/` → **38 passed / 0 failed** (A1 marker removal is comment-only, no behavior change).
- `npx eslint src/lib/flywheel/{outcome,reconciliation}-repo.ts src/lib/shelf/shelf-repo.ts src/lib/scraping/apify-provider.ts --max-warnings=0` → **clean (exit 0)**.
- All 3 repos < 500 lines (138 / 165 / 138).

## Known Stubs

None. The migrations + repos are complete rails; no placeholder data flows to UI (UI wiring is Plans 03-06).

## Next Phase Readiness

- Plans 03 (outcome capture) and 06 (reconciliation log) wire against `outcome-repo`/`reconciliation-repo` + `scrapeSinglePostMetrics`.
- Plan 04 (saved shelf UI) wires against `shelf-repo`.
- Plan 05 (recalibration) consumes `listReconciliations` + `updateProposalState`.
- **Plan 07 must:** run `supabase db push`, regenerate `database.types.ts`, and remove every `(supabase as any)` cast (grep `TODO(10-07)` for the exact sites).

## Self-Check: PASSED

- All 7 created files verified on disk (3 migrations + 3 repos + SUMMARY).
- All 6 commits verified in git history (c10762a1, 14e5ddb5, 69b67134, b9dbd25f, 5d9e245b, c9bb5575).
- Build + scraping tests (25) + flywheel tests (38) + lint all green.
