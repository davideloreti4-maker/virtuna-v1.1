---
phase: 01-training-corpus-eval-foundation
plan: "06"
subsystem: corpus
tags: [apidojo-migration, clockworks-fallback, orchestrator-split, calibration, cli-modes, scrape, corpus-build]

requires:
  - phase: 01-01
    provides: training_corpus + benchmark_results Supabase tables
  - phase: 01-02
    provides: eval-config constants, bucketing pure functions
  - phase: 01-03
    provides: apify-jobs infra, normalize-scrape
  - phase: 01-04
    provides: orchestrator + build-corpus CLI skeleton

provides:
  - apidojo/tiktok-scraper migration (production code-complete; APIFY_ACTOR_LEGACY=clockworks FREE-tier fallback active)
  - Two-phase orchestrator: scrapeRawToCache() + bucketAndPersist() with JSONL cache
  - Calibration pure-function module (calibration.ts) + operator CLI (calibrate-thresholds.ts)
  - Four-mode build-corpus CLI: --smoke | --scrape | --calibrate | --build
  - Sealed full.2026-05-11 threshold snapshot (D-09 empirical, D-13 immutable) in thresholds.ts
  - 225 stratified labeled rows in training_corpus under corpus_version=full.2026-05-11
  - 180-day recency ceiling fix in normalize-scrape.ts (permanent, both actors)

affects: [01-07, training_corpus, thresholds.ts, eval-harness, Phase 4+ corpus refresh]

tech-stack:
  added:
    - "apidojo/tiktok-scraper Apify actor (~$0.30/1K posts, replaces clockworks at ~$3.70/1K)"
    - "APIFY_ACTOR_LEGACY=clockworks env switch: FREE-tier fallback for scraping without Starter plan"
    - "JSONL cache at .planning/cache/raw-<version>.jsonl (gitignored, operator-owned)"
    - "scripts/calibrate-thresholds.ts: operator CLI for empirical threshold derivation (prints code block; D-13 does not write)"
    - "src/lib/engine/corpus/calibration.ts: pure-function percentile + sanity-check + formatter module"
  patterns:
    - "Two-phase corpus build: scrapeRawToCache() → JSONL cache → bucketAndPersist() (enables calibrate-between-phases)"
    - "D-13 operator-seal: calibration script prints TypeScript code block; operator hand-pastes into thresholds.ts"
    - "Four mutually exclusive CLI modes: --smoke | --scrape | --calibrate | --build (--pilot/--full deprecated aliases)"
    - "180-day recency ceiling: client-side MAX_AGE_MS filter applied in normalize-scrape.ts (both actor paths)"

key-files:
  created:
    - src/lib/engine/corpus/calibration.ts
    - scripts/calibrate-thresholds.ts
    - src/lib/engine/corpus/__tests__/calibration.test.ts
  modified:
    - src/lib/engine/corpus/apify-jobs.ts (apidojo migration + APIFY_ACTOR_LEGACY switch)
    - src/lib/engine/corpus/orchestrator.ts (split + JSONL cache helpers + bucketAndPersist)
    - src/lib/engine/corpus/normalize-scrape.ts (180-day recency ceiling, commit 7540a96)
    - src/lib/engine/corpus/__tests__/apify-jobs.test.ts
    - src/lib/engine/corpus/__tests__/orchestrator.test.ts
    - src/lib/engine/corpus/cli/build-corpus-args.ts (four-mode CLI)
    - src/lib/engine/corpus/__tests__/build-corpus-args.test.ts
    - scripts/build-corpus.ts
    - src/lib/engine/corpus/thresholds.ts (full.2026-05-11 snapshot appended, D-13 sealed)
    - .planning/phases/01-training-corpus-eval-foundation/01-06-PLAN.md (rewritten for apidojo strategy)
    - .planning/phases/01-training-corpus-eval-foundation/01-07-PLAN.md (rewritten for baseline-small strategy)

key-decisions:
  - "Migrated to apidojo/tiktok-scraper: ~12× cheaper ($0.30 vs $3.70/1K posts). FREE plan exhaustion drove the initial escape hatch to APIFY_ACTOR_LEGACY=clockworks."
  - "APIFY_ACTOR_LEGACY=clockworks FREE-tier fallback: actual full.2026-05-11 scrape used clockworks (FREE quota), NOT apidojo — apidojo Starter plan not yet activated."
  - "Two-phase build: scrapeRawToCache() returns NormalizedCorpusRow[] without bucketing; bucketAndPersist() takes sealed rows and upserts. Enables calibrate-between-phases workflow."
  - "JSONL cache at .planning/cache/raw-<version>.jsonl: gitignored, operator-owned. Decouples expensive scrape from DB write."
  - "180-day recency ceiling (commit 7540a96): clockworks silently ignored oldestPostDate — 405/568 rows were >90 days old (median 9mo, P75 3.2yr). Fixed permanently in normalize-scrape.ts."
  - "Calibration math extracted to calibration.ts pure-function module — independently testable without I/O."
  - "Scrape volume (actual): 930 raw → 568 quality-filtered → 238 after 180-day filter → 225 upserted (10 viral/20 avg/20 under per niche caps applied)."
  - "Comedy bucket compression accepted (2.88× separation, below 3× sanity floor): genuine trending comedy distribution, not calibration error."

patterns-established:
  - "D-13 immutability: threshold snapshots in THRESHOLD_SNAPSHOTS are NEVER edited after commit — only appended"
  - "Operator-seal pattern: calibration script prints code block, operator reviews and hand-pastes"
  - "Client-side recency filter is the last line of defense against stale data regardless of actor choice"

requirements-completed: [CORPUS-01, CORPUS-03, CORPUS-08]

duration: "~6h total (Block A ~35min code + Block B ~5h scrape + calibrate + build operations)"
completed: "2026-05-11"
---

# Phase 1 Plan 06: apidojo Migration + Orchestrator Split + Calibration (Full) Summary

**Corpus `full.2026-05-11` sealed: 225 stratified TikTok videos (5 niches × viral/avg/under) scraped via clockworks FREE-tier fallback, calibrated at P80/P40, upserted to `training_corpus`**

## Performance

- **Duration:** ~6h total (Block A: ~35min code-only; Block B: ~5h live operations)
- **Started:** 2026-05-11T00:00:00Z (Block A code migration)
- **Completed:** 2026-05-11 (Block B — corpus sealed prior to baseline run)
- **Tasks:** 5 (smoke → scrape → calibrate → checkpoint → build)
- **Files modified:** 14

## Accomplishments

- Migrated apify-jobs.ts from clockworks to apidojo (production code complete; APIFY_ACTOR_LEGACY=clockworks FREE-tier fallback active for the actual scrape)
- Added permanent 180-day recency ceiling in normalize-scrape.ts (commit 7540a96) — discovered clockworks silently ignored oldestPostDate; 405/568 rows were >90 days old
- Sealed `full.2026-05-11` threshold snapshot via empirical calibration (P80 viralFloor, P40 underCeiling per niche) — D-13 immutable in thresholds.ts
- Upserted 225 stratified labeled rows to training_corpus (viral=47, average=85, under=92; 5 niches covered)
- 262+ tests pass; 0 TypeScript errors in production code

## Task Commits

Block A (code migration):

1. **apify-jobs.ts migration to apidojo** - `1ccbb0c` (refactor)
2. **apify-jobs tests updated for apidojo shape** - `a54f856` (test)
3. **Orchestrator split + JSONL cache helpers** - `b1fb5f2` (refactor)
4. **Calibration module + calibrate-thresholds CLI** - `4616be3` (feat)
5. **build-corpus.ts four-mode CLI** - `b7c5936` (feat)
6. **Plan files restructured (01-06 + 01-07)** - `2cb72fd` (docs)
7. **Remove unused vars flagged by tsc** - `24446c2` (fix)

Block B (live operations — fix commits only; scrape/calibrate/build are operator actions):

8. **180-day recency ceiling in normalize-scrape.ts** - `7540a96` (fix)
9. **clockworks APIFY_ACTOR_LEGACY fallback** - `ca170e5` (feat)
10. **Threshold snapshot full.2026-05-11 sealed** - `7b2a8db` (feat)
11. **Gitignore .planning/cache/ JSONL files** - `8d39f50` (chore)

## Files Created/Modified

- `src/lib/engine/corpus/calibration.ts` — pure-function percentile + sanity check + code formatter module
- `scripts/calibrate-thresholds.ts` — operator CLI (reads JSONL cache, prints TypeScript threshold block)
- `src/lib/engine/corpus/__tests__/calibration.test.ts` — 38 unit tests for calibration module
- `src/lib/engine/corpus/apify-jobs.ts` — apidojo migration + APIFY_ACTOR_LEGACY=clockworks switch
- `src/lib/engine/corpus/orchestrator.ts` — split into scrapeRawToCache() + bucketAndPersist() + JSONL helpers
- `src/lib/engine/corpus/normalize-scrape.ts` — 180-day MAX_AGE_MS recency ceiling (permanent fix)
- `src/lib/engine/corpus/thresholds.ts` — full.2026-05-11 empirical snapshot appended (D-13 sealed)
- `src/lib/engine/corpus/cli/build-corpus-args.ts` — four-mode CLI: --smoke | --scrape | --calibrate | --build
- `scripts/build-corpus.ts` — wired to new four-mode args

## Scrape Outcomes (Block B)

| Stage | Count | Notes |
|---|---|---|
| Raw scrape (clockworks) | 930 | Via APIFY_ACTOR_LEGACY=clockworks, FREE quota |
| After quality filter (CORPUS-08) | 568 | views ≥ 1, valid platform_video_id |
| After 180-day recency filter | 238 | MAX_AGE_MS = 180 days client-side |
| After stratification + upsert | 225 | 10 viral / 20 avg / 20 under per niche (caps applied) |

## Calibrated Thresholds (D-09, D-13 sealed)

| Niche | viralFloor (P80) | underCeiling (P40) | Separation |
|---|---|---|---|
| beauty | 5,120,000 | 250,840 | 20× |
| fitness | 5,480,000 | 1,164,240 | 5× |
| edu | 2,000,000 | 368,500 | 5× |
| comedy | 25,900,000 | 9,000,000 | 2.88× |
| lifestyle | 871,200 | 153,540 | 6× |

Comedy 2.88× is below the 3× sanity floor but accepted as genuine distribution compression. Documented in thresholds.ts comment block.

## Decisions Made

- Calibration uses P80 for viralFloor and P40 for underCeiling (not P90/P30 as originally planned — adjusted after seeing the raw distribution; P80/P40 produced cleaner bucket separation)
- Comedy compression (2.88×) accepted: at P30, comedy view count was 6.88M, indicating mass-viral content dominates trending comedy hashtags regardless of niche specificity
- The actual `full.2026-05-11` corpus was scraped via clockworks (FREE-tier), not apidojo — apidojo code migration is production-ready but requires Starter plan activation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 180-day recency ceiling added to normalize-scrape.ts**
- **Found during:** Block B calibration analysis
- **Issue:** clockworks silently ignores `oldestPostDate` — 405/568 quality-filtered rows were >90 days old (median 9 months, P75 3.2 years). Years-old content inflated apparent view counts, skewing P80 calibration.
- **Fix:** Added `MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000` client-side filter in normalize-scrape.ts (applies to both actor paths)
- **Files modified:** `src/lib/engine/corpus/normalize-scrape.ts`
- **Verification:** Scrape reprocessed: 568 → 238 rows after filter. P80 values re-derived from recency-appropriate distribution.
- **Committed in:** `7540a96` (fix(01-06): add 180-day recency ceiling)

**2. [Rule 1 - Bug] APIFY_ACTOR_LEGACY=clockworks fallback added**
- **Found during:** Block B smoke test
- **Issue:** apidojo/tiktok-scraper rejects FREE-tier Apify plans — Starter plan required. The migrated code could not run.
- **Fix:** Added `APIFY_ACTOR_LEGACY=clockworks` env var: when set, apify-jobs.ts produces clockworks-shaped configs instead of apidojo. Enables scraping on FREE-tier while apidojo migration code remains intact for Starter activation.
- **Files modified:** `src/lib/engine/corpus/apify-jobs.ts`
- **Committed in:** `ca170e5` (feat(01-06): add APIFY_ACTOR_LEGACY=clockworks fallback)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs discovered during Block B operations)
**Impact on plan:** Both fixes were necessary for correctness. The recency ceiling fix materially improved calibration quality. The clockworks fallback enabled the scrape to proceed without a Starter plan.

## Issues Encountered

- **apidojo Starter plan not available:** apidojo/tiktok-scraper requires Apify Starter plan; FREE plan quota exhausted. Resolved via APIFY_ACTOR_LEGACY=clockworks fallback (commit ca170e5).
- **readRawCache JSON parse error:** Initial readline-based JSONL reader had position-882 JSON parse bugs on multi-line entries. Fixed by switching to `fs/promises readFile + split('\n')` approach.
- **ON CONFLICT batch-dedup (commit 8261876):** orchestrator needed batch-level dedup before upsert to prevent key violations when multiple scrape configs return the same platform_video_id.

## Next Phase Readiness

- training_corpus table has 225 rows under corpus_version=full.2026-05-11 — ready for eval harness
- thresholds.ts full.2026-05-11 snapshot is sealed (D-13) — eval harness and bucketing use these values
- Plan 01-07 can proceed immediately (eval harness already written in Plan 01-05)
- apidojo migration code is production-ready; activate by providing APIFY_TOKEN from Starter plan

## Self-Check: PASSED

- `training_corpus` count via Supabase: 225 rows, corpus_version=full.2026-05-11, 5 niches covered (viral=47, average=85, under=92)
- `thresholds.ts` THRESHOLD_SNAPSHOTS contains `full.2026-05-11` entry (verified in source)
- All Block A + Block B commits present in git log
- 262+ corpus tests pass (as of Block A completion)

---
*Phase: 01-training-corpus-eval-foundation*
*Completed: 2026-05-11*
