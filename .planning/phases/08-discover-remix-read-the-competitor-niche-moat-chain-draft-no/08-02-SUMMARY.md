---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
plan: 02
subsystem: discover
tags: [apify-apidojo, zod-remap, outlier-score, input-classify, in-memory-cache, discover-route]

requires:
  - phase: 07-audience-manager
    provides: "normalizeHandle, VideoData/ProfileData scrape boundary, ideas-route security spine"
provides:
  - "apidojo Discover actors wired to scrapeVideos/scrapeProfile + apidojoVideoSchema/apidojoProfileSchema remapping apidojo field names onto VideoData/ProfileData (Pitfall 1 defeated)"
  - "rankOutliers(videos, mode, now?) — 90d window, median baseline (vs own/vs niche), recency-decayed multiplier, saves/views→shares/views tiebreak (pure)"
  - "classifyDiscoverInput(raw) → {mode, normalized} (pure)"
  - "discover-cache: getCachedDiscover/setCachedDiscover/checkUserCap/recordUserPull + DISCOVER_DAILY_CAP (in-memory, per input/mode/day)"
  - "POST /api/discover — auth-gated classify→cap→cache→scrape→rank→source-tagged tiles, no SIM score"
affects: [Plan 03 outlier grid, W3/W4 killer features, Remix rehost path (untouched)]

tech-stack:
  added: []
  patterns:
    - "Normalize at the scrape boundary (Pattern 2): apidojo→VideoData remap isolated in apify-provider.ts so outlier-compute + grid stay actor-agnostic"
    - "Mode-dependent baseline, shared decay (Pattern 3): median baseline per mode, half-life recency decay over a 90d window"
    - "Injectable clock (now param) on rankOutliers + discover-cache for deterministic tests"
    - "Read-only cap check + separate recordUserPull consume — cache hits don't burn a pull"

key-files:
  created:
    - src/lib/discover/outlier-compute.ts
    - src/lib/discover/classify-input.ts
    - src/lib/discover/discover-cache.ts
    - src/app/api/discover/route.ts
    - src/lib/scraping/__tests__/apidojo-remap.test.ts
    - src/lib/discover/__tests__/outlier-compute.test.ts
    - src/lib/discover/__tests__/classify-input.test.ts
    - src/lib/discover/__tests__/discover-cache.test.ts
  modified:
    - src/lib/scraping/apify-provider.ts
    - src/lib/schemas/competitor.ts

key-decisions:
  - "Discover-scoped actor swap (A4): scrapeVideos/scrapeProfile → apidojo; resolveVideoUrl stays on clockworks VIDEO_ACTOR (Pitfall 2 — apidojo forbids single-post URLs). clockworks apifyVideoSchema + cron/webhook path left untouched."
  - "apidojo id may arrive as number → z.union([string,number]).transform(String) so a missing id is rejected (item skipped) rather than coerced to the string 'undefined'."
  - "DiscoverTile cache generic relaxed from Record<string,unknown> to object so a typed RankedOutlier interface (no index signature) is cacheable without an assertion."
  - "checkUserCap is read-only; recordUserPull consumes a pull only on a real cache-miss scrape — re-opening a cached pull never burns the daily cap."
  - "DISCOVER_DAILY_CAP=20 (Open Q3, low-double-digit); in-memory cache, NO Supabase table / migration (Open Q2)."

patterns-established:
  - "apidojo-remap exported as standalone remapApidojoVideo/remapApidojoProfile so the field-map is unit-tested without mocking ApifyClient."

requirements-completed: [DISC-01, DISC-03, DISC-04]

duration: 11min
completed: 2026-06-19
---

# Phase 08 Plan 02: W1 Backend — apidojo Swap + Outlier Score + Discover Route Summary

**De-risked the all-new Apify/outlier spine: swapped the Discover scrape path to apidojo with a field-name remap that defeats the silent-zero Pitfall 1, built the pure `rankOutliers` + `classifyDiscoverInput` modules and an in-memory per-(input,mode,day) cache, and shipped an auth-gated `POST /api/discover` that returns recency-decayed outlier-ranked, source-tagged tiles with no fabricated SIM score — while leaving the Remix rehost path on its working single-URL clockworks actor.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-19T08:06:08Z
- **Completed:** 2026-06-19T08:17:00Z
- **Tasks:** 3 (all TDD)
- **Files:** 8 created, 2 modified

## Accomplishments

- **Task 1 — apidojo swap + Zod remap.** Added `apidojoVideoSchema`/`apidojoProfileSchema` mapping apidojo keys (`views/likes/comments/shares/bookmarks/uploadedAt/channel.followers`) onto the existing `VideoData`/`ProfileData` interfaces, exported `remapApidojoVideo`/`remapApidojoProfile`, and pointed `scrapeVideos`/`scrapeProfile` at `DISCOVER_VIDEO_ACTOR`/`DISCOVER_PROFILE_ACTOR` (apidojo). `resolveVideoUrl` stays on the clockworks `VIDEO_ACTOR` (Pitfall 2). Test asserts non-zero views/saves/shares + a real `Date` postedAt — the Pitfall 1 failure signature (all-zero metrics) is explicitly asserted against.
- **Task 2 — pure outlier + classify modules.** `rankOutliers(videos, mode, now?)`: 90d window (D-07), median baseline (`vs own` profile / `vs niche` niche, D-05), `views/baseline` multiplier, half-life recency decay, `rankKey → saves/views → shares/views` sort (D-06), divide-by-zero guarded. `classifyDiscoverInput`: `@handle`/tiktok URL → profile (via `normalizeHandle`), free text → niche. Both pure — no Apify/Supabase import.
- **Task 3 — cache + route.** In-memory `discover-cache` keyed `${normalizedInput}|${mode}|${YYYY-MM-DD}` (Pitfall 6) with `DISCOVER_DAILY_CAP=20` per-user (Open Q3); `POST /api/discover` mirrors the ideas-route security spine (auth before any work, `user_id` from session only, server-side input cap), flows classify → cap → cache → apidojo scrape → `rankOutliers` → ≤30 source-tagged tiles, maps over-cap to a friendly `429` (never a 500) and scrape failure to a `ScrapeErrorBanner`-compatible shape. No SIM score emitted (Pitfall 5).

## Task Commits

1. **Task 1: apidojo actor swap + Zod remap** — `e915babf` (feat, test+impl folded)
2. **Task 2: outlier-compute + classify-input** — `8f1d828e` (auto-wip hook pre-committed all 4 files; canonical feat content)
3. **Task 3: discover-cache + POST /api/discover** — `cc4a52d1` (feat)

## Files Created/Modified

**Created**
- `src/lib/discover/outlier-compute.ts` — `rankOutliers`, `median`, `WINDOW_DAYS`/`HALF_LIFE_DAYS`
- `src/lib/discover/classify-input.ts` — `classifyDiscoverInput`
- `src/lib/discover/discover-cache.ts` — cache + cap + `DISCOVER_DAILY_CAP`
- `src/app/api/discover/route.ts` — `POST` Discover route
- `src/lib/scraping/__tests__/apidojo-remap.test.ts`
- `src/lib/discover/__tests__/outlier-compute.test.ts`
- `src/lib/discover/__tests__/classify-input.test.ts`
- `src/lib/discover/__tests__/discover-cache.test.ts`

**Modified**
- `src/lib/scraping/apify-provider.ts` — Discover actors + exported apidojo remap helpers; `resolveVideoUrl` untouched
- `src/lib/schemas/competitor.ts` — `apidojoVideoSchema`/`apidojoProfileSchema` added alongside the untouched clockworks schemas

## Decisions Made

- **Discover-scoped swap, not a global retire (A4).** Only `scrapeVideos`/`scrapeProfile` move to apidojo. `resolveVideoUrl` (Remix rehost, single `postURLs:[url]` + `shouldDownloadVideos:true`) stays on clockworks because apidojo `tiktok-scraper` forbids single-post URLs (Pitfall 2). The clockworks `apifyVideoSchema` and the cron/webhook consumers are left byte-identical.
- **apidojo `id` coercion.** `z.union([string,number]).transform(String)` — apidojo may emit a numeric id, but a missing id must be *rejected* (item skipped) rather than coerced to `"undefined"` by `z.coerce.string()`.
- **Cap is read-only; pulls consumed separately.** `checkUserCap` never mutates; `recordUserPull` fires only on a real cache-miss scrape, so re-opening a cached pull does not burn the daily cap.
- **In-memory cache, no migration (Open Q2).** Single-instance v1; `getCachedDiscover/setCachedDiscover/checkUserCap` are module-level Maps. No `discover_cache` table, no `supabase/migrations` touch — the conditional schema-push requirement does not apply to this phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] apidojo missing-id coerced to the string "undefined"**
- **Found during:** Task 1 (RED test "skips an item with no usable id" failed)
- **Issue:** `id: z.coerce.string()` turned a missing id into `"undefined"` instead of failing the parse, so junk items were not skipped.
- **Fix:** `id: z.union([z.string(), z.number()]).transform((v) => String(v))` — accepts a numeric id, rejects absent id.
- **Files:** `src/lib/schemas/competitor.ts`
- **Commit:** `e915babf`

**2. [Rule 3 — Blocking] DiscoverTile generic constraint rejected the typed tile**
- **Found during:** Task 3 (tsc: `DiscoverResponseTile` lacks a string index signature for `Record<string, unknown>`)
- **Issue:** The route caches a typed `RankedOutlier`-derived interface; the `Record<string, unknown>` cache generic required an index signature.
- **Fix:** Relaxed `DiscoverTile` to `object` (still constrains to non-primitives) so any structured tile is cacheable without an assertion.
- **Files:** `src/lib/discover/discover-cache.ts`
- **Commit:** `cc4a52d1`

## Issues Encountered

- An `auto-wip` working-tree hook on this worktree pre-committed Task 2's four files as `8f1d828e chore(auto-wip)` the moment the GREEN `pnpm test` ran, before the canonical `git commit` — so the explicit Task-2 commit reported "nothing to add." No work lost; the four files are intact in `8f1d828e`. (Same hook behaviour was documented in Plan 01's SUMMARY — not stray work.)

## Verification

- `apidojo-remap` ✓ — captured apidojo item yields non-zero views/saves/shares + real Date; clockworks shape does NOT populate the apidojo schema (Pitfall 1 defeated, both directions).
- `outlier-compute` ✓ — over-performer ranks #1, mode labels `vs own`/`vs niche`, 90d window excludes stale, recency decay + saves/shares tiebreak ordering asserted, divide-by-zero guarded.
- `classify-input` ✓ — `@handle`/tiktok URL → profile, free text → niche.
- `discover-cache` ✓ — same-day hit, prior-day miss, mode-scoping, per-user cap block/reset/isolation.
- `resolve-video` ✓ — Remix rehost path still green on clockworks (Pitfall 2 avoided).
- `grep actor(VIDEO_ACTOR)` confirms `resolveVideoUrl` references the non-apidojo single-URL actor.
- `POST /api/discover` authenticates before any scrape (auth/createClient precedes the scrape call); cache key contains all three of normalizedInput, mode, YYYY-MM-DD; no `discover_cache`/`apply_migration`/`supabase/migrations` references.
- `pnpm exec tsc --noEmit` — no new discover/scraping (non-test) type errors. Full suite: 2682 passed / 27 skipped.

## User Setup Required

None. `APIFY_TOKEN` is unchanged (same account works for apidojo actors). The apidojo actor slugs resolve at runtime against the existing Apify account — no new env var.

## Next Phase Readiness

- W1 backend complete: a Discover pull returns apidojo-scraped, correctly-remapped, recency-decayed outlier-ranked tiles through an auth-gated cached route; the Remix rehost path is untouched.
- Plan 03 (the outlier grid) can consume `rankOutliers` output + `POST /api/discover` tiles directly — tiles carry `multiplier` + honest `baselineLabel`, never a SIM score.

## Self-Check: PASSED

- FOUND: src/lib/discover/outlier-compute.ts
- FOUND: src/lib/discover/classify-input.ts
- FOUND: src/lib/discover/discover-cache.ts
- FOUND: src/app/api/discover/route.ts
- FOUND: src/lib/scraping/__tests__/apidojo-remap.test.ts
- FOUND: commit e915babf (Task 1)
- FOUND: commit 8f1d828e (Task 2, auto-wip)
- FOUND: commit cc4a52d1 (Task 3)
- VERIFIED: resolveVideoUrl still on clockworks VIDEO_ACTOR (Pitfall 2)
- VERIFIED: no migration refs in discover-cache.ts (in-memory, Open Q2)

---
*Phase: 08-discover-remix-read-the-competitor-niche-moat-chain-draft-no*
*Completed: 2026-06-19*
