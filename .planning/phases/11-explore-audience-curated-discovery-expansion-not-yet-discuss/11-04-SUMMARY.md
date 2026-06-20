---
phase: 11-explore-audience-curated-discovery
plan: 04
subsystem: api
tags: [sse, discover, outlier, audience-fit, skill-chain, nextjs, apidojo, zod]

# Dependency graph
requires:
  - phase: 11-01
    provides: "rankWithAudienceFit (pure audience-fit re-rank) + OutlierGridBlockSchema extended with fit/trackable/trackHandle"
  - phase: 08
    provides: "Discover pull/rank stack (createScrapingProvider.scrapeVideos, rankOutliers, classifyDiscoverInput, discover-cache), outlier-grid block + renderer, discover→remix chain handoff"
  - phase: 07
    provides: "Audience object + getAudience/GENERAL_AUDIENCE (active-audience load from active_audience_id)"
  - phase: 05
    provides: "canonical skill-chain SSE contract (hooks route shape, createOpenThreadLazy, insertMessage, kcStamp)"
provides:
  - "runExplorePipeline: pull → rankOutliers → rankWithAudienceFit → validated outlier-grid block (no SIM call), also returns the measured ranked tiles for cache reuse"
  - "POST /api/tools/explore: skill-chain SSE route (auth → csrfGuard → params+cap → active audience → daily cap → pull/fit → stream → persist + KC stamp)"
  - "Profile-mode tiles carry trackable:true + trackHandle (the pull-input handle); niche-mode tiles trackable:false (RESEARCH Q3)"
affects: [11-05, 11-06, 11-07, 12-library]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin SSE skill route delegating the whole pipeline to a runner (no Flash/gate loop) — Explore variant of the hooks-route contract"
    - "In-memory Discover cache stores the MEASURED ranked tiles; the audience-fit re-rank recomputes per request (fit depends on the active audience, not the pull)"
    - "Runner returns its measured ranked tiles alongside the block so the route caches from the SAME pull (no double scrape)"

key-files:
  created:
    - src/lib/tools/runners/explore-runner.ts
    - src/lib/tools/runners/explore-runner.test.ts
    - src/app/api/tools/explore/route.ts
  modified: []

key-decisions:
  - "timeWindow param accepted into the route contract but not yet threaded into the pull (rankOutliers already applies WINDOW_DAYS=90 recency + half-life); narrowing by today/week/month is an honest follow-up — never faked"
  - "runExplorePipeline result extended with `ranked: RankedOutlier[]` (additive) so the cache fills from the same pull instead of a wasteful second scrape"
  - "Cache stores audience-independent measured ranked tiles; cache hit re-runs rankWithAudienceFit before building the block (per-audience fit on a hit)"

patterns-established:
  - "Explore skill server half = clone the hooks SSE route but delegate to a pure-math runner; stage contract Pulling outliers → Scoring for your audience, content-first, NO fake %"
  - "Active audience ALWAYS from openThread.active_audience_id (CR-01); General/preset/thin degrades every tile to fit:null via rankWithAudienceFit"

requirements-completed: [EXPLORE-01, EXPLORE-02, EXPLORE-03]

# Metrics
duration: 10min
completed: 2026-06-20
---

# Phase 11 Plan 04: Explore Server Half (SSE route + audience-fit runner) Summary

**`/api/tools/explore` skill-chain SSE route that pulls outliers (reused apidojo Discover stack), audience-fit re-ranks them with pure math (rankWithAudienceFit — zero SIM call, ENGINE_VERSION frozen 3.19.0), threads the profile-mode Track handle, builds + validates + persists the extended outlier-grid block with a KC stamp, and streams honest no-fake-% progress.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-20T02:16Z
- **Completed:** 2026-06-20T02:26Z
- **Tasks:** 2
- **Files modified:** 3 (3 created)

## Accomplishments
- `runExplorePipeline` — the Explore pipeline (pull → rankOutliers → rankWithAudienceFit → build the extended outlier-grid block → `OutlierGridBlockSchema.safeParse`), with **zero SIM/Flash/engine-scoring calls** (the only network is the provider scrape; ENGINE_VERSION untouched — D-02/D-03, Pitfall 6).
- `POST /api/tools/explore` — the SSE route on the canonical skill-chain contract: auth → csrfGuard → param parse + server-side caps (niche/accounts/timeWindow/serendipity) → active audience from `active_audience_id` (never body, CR-01) → daily cap (429 friendly) → pull/fit via the runner → `Pulling outliers` → `Scoring for your audience` stages, content-first, no fake % → persist the block + KC stamp (D-10).
- Profile-mode tiles are trackable (handle = normalized pull input, no `@`, lowercased); niche-mode tiles carry no author handle → `trackable:false` (RESEARCH Q3). General/preset/thin audiences degrade every tile to `fit:null`.
- Runner unit test (6 cases) locks: fit-threading, degrade-to-null on General, trackable-by-mode, `safeParse` validity, the 30-budget scrape, and a static zero-engine-import proof.

## Task Commits

Each task was committed atomically:

1. **Task 1: explore-runner — pull→rank→audience-fit→validated block (TDD)** - `4a939cd1` (feat) — RED test + GREEN runner committed together as the TDD runner+test pair (repo convention for runner+test).
2. **Task 2: /api/tools/explore SSE route** - `e8173479` (feat) — the route + the additive runner `ranked` return it depends on.

**Plan metadata:** (this commit) `docs(11-04): complete plan`

_Note: Task 1 is tdd="true"; RED was confirmed (module-not-found) before GREEN. Runner + its test are one commit per the existing runner+test convention in this repo._

## Files Created/Modified
- `src/lib/tools/runners/explore-runner.ts` - `runExplorePipeline`: scrapeVideos (reused Discover budget 30) → rankOutliers (cap 30) → rankWithAudienceFit (pure) → build extended outlier-grid block → safeParse; returns `{ block, ranked }`. NO SIM call.
- `src/lib/tools/runners/explore-runner.test.ts` - 6 vitest cases proving fit-threading, General degrade, trackable-by-mode, safeParse validity, scrape budget, and zero engine-scoring imports/calls.
- `src/app/api/tools/explore/route.ts` - the SSE route; auth/csrf/params/audience/cap/cache/stream/persist; delegates to `runExplorePipeline`; in-memory cache re-fits per audience on a hit.

## Decisions Made
- **`timeWindow` accepted but not yet threaded into the pull.** The route parses it (part of the EXPLORE-01 param contract) but does not narrow the scrape by today/week/month — `rankOutliers` already applies a 90-day recency window + half-life decay. Honest: we read the param (`void body.timeWindow`) rather than pretend to filter by it. Narrowing is a follow-up refinement.
- **Runner returns its measured `ranked` tiles (additive).** Originally the route would have re-scraped to fill the cache (double Apify call). Surfacing the measured ranking from the runner lets the route cache from the same pull. Additive to the result shape — does not change the locked input signature.
- **Cache stores audience-independent measured tiles; fit recomputes per request.** A cache hit still runs `rankWithAudienceFit` before building the block, because fit depends on the active audience (which can differ between two same-day pulls of the same input).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Eliminated a double scrape on the cache-miss path**
- **Found during:** Task 2 (route implementation)
- **Issue:** The plan's "cache the ranked tiles" instruction, naively implemented over the locked runner signature (which encapsulates the scrape and returned only `{ block }`), forced a SECOND `scrapeVideos` call purely to populate the cache — doubling Apify spend and latency on every cache-miss pull.
- **Fix:** Extended `RunExploreResult` with `ranked: RankedOutlier[]` (the measured tiles from the single pull the runner already performed) and cached from `result.ranked`. One scrape per pull. Removed the now-dead `createScrapingProvider`/`rankOutliers`/`SCRAPE_LIMIT`/`MAX_TILES` imports+constants from the route.
- **Files modified:** src/lib/tools/runners/explore-runner.ts, src/app/api/tools/explore/route.ts
- **Verification:** Runner test still green (6/6) after the additive return; route typechecks clean; the runner's scrape-count test asserts exactly one scrape call.
- **Committed in:** `e8173479` (Task 2 commit)

**2. [Rule 1 - Bug] Tightened the test's zero-engine-import assertion to ignore doc prose**
- **Found during:** Task 1 (TDD GREEN)
- **Issue:** The first version of the "no engine scoring" test grepped the whole runner source, so the file header's honesty-constraint PROSE (which legitimately names `ENGINE_VERSION`/`Flash` to forbid them) tripped the matcher — a false failure.
- **Fix:** Strip block + line comments before matching, then assert no engine-scoring CALLS and no `from "@/lib/engine"` import in real code.
- **Files modified:** src/lib/tools/runners/explore-runner.test.ts
- **Verification:** 6/6 green; the comment-stripped grep over both files confirms zero engine-scoring tokens in real code.
- **Committed in:** `4a939cd1` (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed invalid Archetype slugs in the test fixture**
- **Found during:** Task 1 (typecheck after GREEN)
- **Issue:** The test's `CalibratedPersona` fixtures used non-existent archetype slugs (`fyp_mainstream`, `niche_core`); `archetype` is the strict `Archetype` union, so `tsc` rejected the fixture (the runtime test passed because the fit math reads `temperature`/`share`, not `archetype`).
- **Fix:** Replaced with valid `Archetype` members (`high_engager`, `niche_deep_scout`, `loyalist`).
- **Files modified:** src/lib/tools/runners/explore-runner.test.ts
- **Verification:** `tsc` clean on the test file; 6/6 green.
- **Committed in:** `4a939cd1` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All three were correctness/quality fixes within the planned scope — the double-scrape fix is the only behavioural change (it makes the route do what the plan intended: reuse the cache, not re-pull). No scope creep; the locked runner input signature and route contract are unchanged.

## Issues Encountered
- **Pre-existing repo-wide test typecheck debt (out of scope).** A full `npx tsc --noEmit` reports 46 errors across 19 **pre-existing** `__tests__/*.test.ts` files (fold-schema, grounding-line, messages, open-thread, hooks/ideas/remix/script runner tests — mostly strict `Object is possibly 'undefined'` + `ProfileRow.user_id` literal-shape drift). None are in the three files this plan created, and none were touched by this plan's commits. Logged here as deferred debt rather than fixed (SCOPE BOUNDARY — only auto-fix issues directly caused by this task's changes). Recommend a dedicated test-strict cleanup pass.

## Known Limitations
- **`timeWindow` is a no-op in the pull** (see Decisions). The grid still renders honest, recency-decayed outliers; the param simply doesn't narrow today/week/month yet. To be threaded in a follow-up — never faked in the UI.
- **In-memory cache + daily cap (Pitfall 5).** Reused as-is from Discover — module-level state, not durable across serverless cold starts. The cap is a soft Apify-spend guard, not a billing control; real rate-limiting is the HARDEN-01 pre-launch gate.

## User Setup Required
None - no new external service configuration. The route reuses the already-provisioned `APIFY_TOKEN` + Supabase used by the shipped P8/P9/P10 features.

## Next Phase Readiness
- The Explore server half is live and persists the extended `outlier-grid` block to the open thread with a KC stamp. **11-05** can build `use-explore-stream` (clone `use-hooks-stream`, parse the `stage`/`content`/`done`/`error` frames) + the tile fit-bar / "+ Track account" button; the block's per-tile `fit` + `trackable` + `trackHandle` fields are populated and schema-valid.
- **11-06** the `ExploreThreadView` (idle quick-actions); **11-07** the composer wiring + enabling the `explore` skill pill.
- The on-tap Remix → Read is already shipped (`discover→remix` + remix-card's `LensTrigger`) — no new chain code needed (RESEARCH Pattern 4).
- No blockers introduced. EXPLORE-06 (comment seeding) stays deferred (D-09).

## Self-Check: PASSED

- FOUND: src/lib/tools/runners/explore-runner.ts
- FOUND: src/lib/tools/runners/explore-runner.test.ts
- FOUND: src/app/api/tools/explore/route.ts
- FOUND commit: 4a939cd1 (Task 1)
- FOUND commit: e8173479 (Task 2)

---
*Phase: 11-explore-audience-curated-discovery*
*Completed: 2026-06-20*
