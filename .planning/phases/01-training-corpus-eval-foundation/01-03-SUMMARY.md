---
phase: 01-training-corpus-eval-foundation
plan: "03"
subsystem: api
tags: [apify, cron, scraping, tiktok, zod, vitest, nextjs]

# Dependency graph
requires: []
provides:
  - GET /api/cron/refresh-corpus (CORPUS-02 stub; full mechanism deferred to Phase 11/12)
  - vercel.json monthly schedule "0 6 1 * *" for refresh-corpus
  - buildApifyJobs(niche, isPilot) → { trending, average, under } config tuple per D-06
  - getFollowerTier(count) → 'nano'|'micro'|'mid'|'large'|'mega'|null
  - normalizeScrapedItem(item, niche, corpus_version, scrapeKind) → NormalizedCorpusRow | null (W6: scrape_kind propagated)
  - NICHES const + Niche type + ScrapeConfigKind type
  - apidojoVideoSchema (Zod) for the apidojo TikTok actor fallback format
affects:
  - Plan 01-04 (corpus orchestrator — composes buildApifyJobs + normalizeScrapedItem)
  - Plan 01-02 (eval-config — will export its own Niche; both definitions will coexist post-merge)
  - Phase 11/12 (will replace refresh-corpus stub with full scrape trigger)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cron stub pattern: verifyCronAuth + maxDuration=60 + try/catch + log.error/info (parallel to calibration-audit)"
    - "Apify config-builder pattern (pure function, no client calls; orchestrator owns invocation)"
    - "Skip-on-fail normalization (Zod safeParse with two-format dispatch; never throws)"
    - "Explicit toNumber/toNullableNumber helpers (no silent type coercion at trust boundary; T-01-C-02)"
    - "Local Niche definition in apify-jobs.ts (decouples from sibling Wave 1 plan 01-02's eval-config.ts)"

key-files:
  created:
    - src/app/api/cron/refresh-corpus/route.ts
    - src/lib/engine/corpus/apify-jobs.ts
    - src/lib/engine/corpus/follower-tier.ts
    - src/lib/engine/corpus/normalize-scrape.ts
    - src/lib/engine/corpus/__tests__/apify-jobs.test.ts
    - src/lib/engine/corpus/__tests__/follower-tier.test.ts
    - src/lib/engine/corpus/__tests__/normalize-scrape.test.ts
  modified:
    - vercel.json (added refresh-corpus cron entry)

key-decisions:
  - "Niche type defined locally in apify-jobs.ts (not imported from ./eval-config) — sibling Wave 1 plan 01-02 creates eval-config.ts in a separate worktree; both definitions will coexist after merge as identical string-literal unions. Deviation Rule 3: blocking-issue auto-fix."
  - "completion_pct is hardcoded null on every NormalizedCorpusRow — explicitly documented as KNOWN GAP. Apify does not expose completion rate; downstream callers must treat this as a contract, not a stub."
  - "Trending hashtags include 'fyp' (TikTok feed multiplier); average/under use niche-specific hashtags exclusively — confirms D-02 trending vs niche split."
  - "Full corpus (isPilot=false) produces exactly 5× pilot resultsPerPage — matches D-01 stratification ratio (50 pilot / 500 full)."

patterns-established:
  - "Cron stub deferral: route exists with auth + maxDuration + return 200, but the actual work message says 'Phase X/Y'. Lets vercel.json registration land in Phase 1 without committing to operational logic."
  - "Two-format Apify item normalizer: dispatch via Zod safeParse from primary actor (clockworks) → secondary actor (apidojo) → null. Schema validation IS the trust boundary; explicit coercion helpers prevent silent type widening."
  - "W6 scrape_kind propagation: the orchestrator passes ScrapeConfigKind into normalizeScrapedItem so downstream bucket_target can be encoded without re-deriving the row's provenance."

requirements-completed: [CORPUS-02, CORPUS-04, CORPUS-07]

# Metrics
duration: ~5min
completed: 2026-05-11
---

# Phase 01 Plan 03: Cron stub + Apify scrape primitives Summary

**Three independent corpus infra pieces — refresh-corpus cron stub + apify-jobs config builder + two-format normalize-scrape + follower-tier classifier — with 51 passing unit tests.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-11T05:16:05Z
- **Completed:** 2026-05-11T05:21:00Z
- **Tasks:** 3
- **Files created:** 7 (1 route, 3 corpus modules, 3 test files)
- **Files modified:** 1 (vercel.json)
- **Tests added:** 51 (all passing)

## Accomplishments

- **Refresh-corpus cron registered** — `GET /api/cron/refresh-corpus` with `verifyCronAuth` guard, `maxDuration = 60`, and a stubbed 200 response that documents Phase 11/12 as the place where the full 30-day rolling refresh mechanism lands. `vercel.json` gets the monthly entry `"0 6 1 * *"` without disturbing any of the 7 prior cron entries.
- **buildApifyJobs delivers 15 configs per refresh** — 5 niches × 3 kinds (trending/average/under). Each config sets `newestPostDate = today − 7d` (D-04 age floor), `oldestPostDate = today − 90d` (sanity ceiling), `excludePinnedPosts: true`, and is keyed to the `clockworks/tiktok-scraper` actor. Pilot vs full resultsPerPage is exactly 5×. Trending pulls high-traffic hashtags (`fyp` + niche root); average/under use the 4 niche-specific tags exclusively.
- **normalizeScrapedItem handles both Apify actor output shapes** — Zod safeParse against `apifyVideoSchema` (clockworks, project primary per `apify-provider.ts:9-10`) then `apidojoVideoSchema` (this plan's new schema). Returns a typed `NormalizedCorpusRow` or `null`. Skip-on-fail for parse errors, `views < 1`, and `posted_at` within the last 7 days. `scrape_kind` (W6) is propagated onto the row so the orchestrator can encode bucket_target downstream.
- **getFollowerTier extracted to shared module** — pulled the inline logic from `scripts/extract-training-data.ts:68-75` into `src/lib/engine/corpus/follower-tier.ts` with the canonical industry tiers (10k/100k/1M/10M). Null/undefined/zero/negative all return `null` (RESEARCH §A.3: clockworks profile-scraper does not always populate fans).
- **Threat mitigations from plan's `<threat_model>` enforced in code** — T-01-C-01 (spoofing) via verifyCronAuth, T-01-C-02 (tampering) via Zod safeParse + explicit toNumber/toNullableNumber helpers (no silent coercion), T-01-C-03 (data poisoning) via views<1 and 7-day age filters, T-01-C-05 (DoS) via maxDuration cap.

## Task Commits

Each task was committed atomically. TDD tasks (2 + 3) have RED + GREEN commits.

1. **Task 1: Refresh-corpus cron stub + vercel.json registration** — `1c29ab8` (feat)
2. **Task 2 RED: Failing tests for apify-jobs + follower-tier** — `ab7fab2` (test)
3. **Task 2 GREEN: Implement buildApifyJobs + getFollowerTier** — `04332d9` (feat)
4. **Task 3 RED: Failing tests for normalizeScrapedItem** — `449efd6` (test)
5. **Task 3 GREEN: Implement normalizeScrapedItem (clockworks + apidojo)** — `636396c` (feat)

## Files Created/Modified

### Created

- `src/app/api/cron/refresh-corpus/route.ts` — cron stub route; verifyCronAuth + log + 200 with `{ status: "stubbed", message: "Phase 1 stub; full 30-day refresh implemented in Phase 11/12" }`
- `src/lib/engine/corpus/apify-jobs.ts` — `NICHES` const, `Niche` type, `ScrapeConfigKind` type, `ApifyScrapeConfig` interface, `buildApifyJobs(niche, isPilot)`, `listNicheHashtags(niche)` defensive-copy helper. Pure config builder; no Apify calls.
- `src/lib/engine/corpus/follower-tier.ts` — `FollowerTier` string-literal union, `getFollowerTier(count)` classifier
- `src/lib/engine/corpus/normalize-scrape.ts` — `NormalizedCorpusRow` interface (with W6 `scrape_kind` field), `apidojoVideoSchema` Zod schema for the secondary actor, `normalizeScrapedItem(item, niche, corpus_version, scrapeKind)` dispatcher, internal `normalizeClockworks` and `normalizeApidojo` per-format normalizers, internal `toNumber` / `toNullableNumber` / `normalizeOrNull` coercion helpers
- `src/lib/engine/corpus/__tests__/apify-jobs.test.ts` — 13 tests
- `src/lib/engine/corpus/__tests__/follower-tier.test.ts` — 20 tests
- `src/lib/engine/corpus/__tests__/normalize-scrape.test.ts` — 18 tests

### Modified

- `vercel.json` — appended `{ "path": "/api/cron/refresh-corpus", "schedule": "0 6 1 * *" }` to the `crons` array; all 7 prior entries unchanged

## Decisions Made

- **Niche type defined locally in apify-jobs.ts** (instead of `import type { Niche } from "./eval-config"` as the plan template specified). Sibling Wave 1 plan 01-02 creates `eval-config.ts` in a separate worktree; that file does not exist in this branch. Defining `Niche` locally lets the tests run in isolation. After Wave 1 merge, both files will export an identical string-literal union — structurally compatible. A future consolidation plan can collapse to a single source. Documented under **Deviations** below (Rule 3).
- **completion_pct hardcoded `null`** on every `NormalizedCorpusRow` — explicitly documented as KNOWN GAP. The Apify TikTok actors do not expose video-completion rate; the row schema reserves the field for a future enrichment source (TikTok Creative Center, manual annotation, or computed from retention curves).
- **Apify view-count quality rule at scrape-time** (not just orchestrator-side) — `views < 1` triggers `null` return inside the normalizer. This is belt-and-suspenders against T-01-C-03 (the orchestrator in Plan D will also enforce CORPUS-08 validation rule 2).
- **Date-filter at scrape-time** (Pitfall 1 belt-and-suspenders) — `posted_at` within 7 days of now returns `null`. Apify also has `newestPostDate = today − 7d` in the config, but the normalizer enforces it again because clockworks occasionally returns items outside the requested date range.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Niche type sourced locally instead of from `./eval-config`**
- **Found during:** Task 2 (writing apify-jobs.ts header imports)
- **Issue:** The plan's `<action>` skeleton starts with `import type { Niche } from "./eval-config"`. `eval-config.ts` is created by Wave 1 sibling plan 01-02 in a separate worktree (`agent-aebd32c1cfbd90ab4`) and does not exist in this branch. Importing from it would cause `vitest` to fail with `Cannot find module`, blocking my plan's verification gate.
- **Fix:** Defined `NICHES` const, `Niche` type, and `ScrapeConfigKind` type locally inside `src/lib/engine/corpus/apify-jobs.ts`, then exported them. `normalize-scrape.ts` imports `Niche` and `ScrapeConfigKind` from `./apify-jobs`. After Wave 1 merge, plan 01-02's `eval-config.ts` will also export `Niche` as an identical `(typeof NICHES)[number]` literal union — TypeScript treats these as structurally compatible. A future consolidation plan can collapse to a single source.
- **Files modified:** `src/lib/engine/corpus/apify-jobs.ts` (lines 17-26), `src/lib/engine/corpus/normalize-scrape.ts` (line 5)
- **Verification:** All 51 corpus tests pass; `npx tsc --noEmit` shows zero errors in `src/lib/engine/corpus/**`
- **Committed in:** `04332d9` (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue)
**Impact on plan:** None functional. Plan's contract surface is unchanged (same exported types, same shapes). Only the internal module that owns the `Niche` source-of-truth moves from `eval-config.ts` to `apify-jobs.ts` for this branch's compile-isolation. Post-merge consolidation is a low-risk single-line refactor.

## Issues Encountered

None. The plan's `<action>` skeletons were detailed enough that implementation was straightforward; the only judgment call was the `Niche` import location (documented above).

## Self-Check: PASSED

**Created files exist:**
- FOUND: `src/app/api/cron/refresh-corpus/route.ts`
- FOUND: `src/lib/engine/corpus/apify-jobs.ts`
- FOUND: `src/lib/engine/corpus/follower-tier.ts`
- FOUND: `src/lib/engine/corpus/normalize-scrape.ts`
- FOUND: `src/lib/engine/corpus/__tests__/apify-jobs.test.ts`
- FOUND: `src/lib/engine/corpus/__tests__/follower-tier.test.ts`
- FOUND: `src/lib/engine/corpus/__tests__/normalize-scrape.test.ts`
- FOUND: `vercel.json` modification (1 new entry, 7 preserved)

**Commits exist:**
- FOUND: `1c29ab8` (Task 1: refresh-corpus cron stub)
- FOUND: `ab7fab2` (Task 2 RED)
- FOUND: `04332d9` (Task 2 GREEN)
- FOUND: `449efd6` (Task 3 RED)
- FOUND: `636396c` (Task 3 GREEN)

**Plan verification gates:**
- `npx vitest run src/lib/engine/corpus/__tests__/apify-jobs.test.ts src/lib/engine/corpus/__tests__/follower-tier.test.ts src/lib/engine/corpus/__tests__/normalize-scrape.test.ts` → 51 passing
- `vercel.json` valid JSON with 8 entries (7 preserved + 1 new)
- `npx tsc --noEmit` → no new errors in `src/lib/engine/corpus/**` or `src/app/api/cron/refresh-corpus/route.ts` (pre-existing errors in unrelated `src/lib/engine/__tests__/*.test.ts` are out of scope)

## Next Phase Readiness

Plan 01-04 (corpus orchestrator) can now compose:

- `buildApifyJobs(niche, isPilot)` for the 15-job scrape matrix
- `normalizeScrapedItem(item, niche, corpus_version, scrapeKind)` for the per-actor row normalizer
- `NormalizedCorpusRow` as the canonical row shape for the corpus persistence layer

Plan 01-02's `eval-config.ts` (parallel Wave 1) will provide `NICHE_THRESHOLDS`, `Bucket` type, `bucketByViews`, and the macro-F1 metrics. Plan 01-04 can import from both without further coordination.

No blockers. No deferred items.

---
*Phase: 01-training-corpus-eval-foundation*
*Completed: 2026-05-11*
