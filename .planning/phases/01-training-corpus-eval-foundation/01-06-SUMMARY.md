---
phase: 1
plan: "06"
subsystem: corpus
tags: [apidojo-migration, orchestrator-split, calibration, cli-modes]
dependency_graph:
  requires: [01-01, 01-02, 01-03, 01-04]
  provides: [apidojo-scrape-infra, calibration-pipeline, build-corpus-4-modes]
  affects: [01-07, training_corpus]
tech_stack:
  added:
    - "apidojo/tiktok-scraper Apify actor (~$0.30/1K posts)"
    - "JSONL cache file for scrape → calibrate → build workflow"
    - "scripts/calibrate-thresholds.ts: operator CLI for empirical threshold derivation"
    - "src/lib/engine/corpus/calibration.ts: pure-function percentile + sanity check module"
  patterns:
    - "Two-phase corpus build: scrapeRawToCache() + bucketAndPersist() (JSONL cache between)"
    - "D-13 operator-seal: calibration script prints code block, operator hand-pastes"
    - "Four mutually exclusive CLI modes: --smoke | --scrape | --calibrate | --build"
key_files:
  created:
    - src/lib/engine/corpus/calibration.ts
    - scripts/calibrate-thresholds.ts
    - src/lib/engine/corpus/__tests__/calibration.test.ts
  modified:
    - src/lib/engine/corpus/apify-jobs.ts
    - src/lib/engine/corpus/orchestrator.ts
    - src/lib/engine/corpus/__tests__/apify-jobs.test.ts
    - src/lib/engine/corpus/__tests__/orchestrator.test.ts
    - src/lib/engine/corpus/cli/build-corpus-args.ts
    - src/lib/engine/corpus/__tests__/build-corpus-args.test.ts
    - scripts/build-corpus.ts
    - .planning/phases/01-training-corpus-eval-foundation/01-06-PLAN.md
    - .planning/phases/01-training-corpus-eval-foundation/01-07-PLAN.md
decisions:
  - "Migrated to apidojo/tiktok-scraper: ~12× cheaper ($0.30 vs $3.70/1K posts). Previous FREE plan quota exhaustion drove this change."
  - "Two-phase build: scrapeRawToCache() returns NormalizedCorpusRow[] without bucketing; bucketAndPersist() takes sealed rows and upserts. Enables calibrate-between-phases workflow."
  - "JSONL cache at .planning/cache/raw-<version>.jsonl: gitignored, operator-owned. Decouples expensive scrape from DB write."
  - "Calibration math extracted to calibration.ts pure-function module (percentile, sanity checks, code formatter) — independently testable without I/O."
  - "Build corpus CLI now has 4 modes (smoke/scrape/calibrate/build) replacing the old binary --pilot/--full. Legacy flags kept as deprecated aliases."
  - "Scrape volume: pilot=80/120/300, full=800/1200/3000 maxItems per trending/average/under config. Targets 25K raw across 5 niches (~$5 Apify) → ~6-15K labeled after filters."
  - "apidojo asymmetries accepted: follower_count=null and sound_name=null in per-post payload. getFollowerTier(null) returns null gracefully; v2.1 eval is unaffected."
metrics:
  duration: "~35 min"
  completed_date: "2026-05-11"
  tasks_completed: 6
  files_changed: 14
---

# Phase 1 Plan 06: apidojo Migration + Orchestrator Split + Calibration (Block A) Summary

Block A of the Phase 01 finishing plan. Migrated the corpus scrape from clockworks to apidojo, split the orchestrator for the two-phase scrape-calibrate-build flow, added a calibration script, extended the CLI with four modes, and restructured the plan files. All work is code-only — no live API calls.

## What Was Built

### Step 1: apify-jobs.ts — apidojo migration

Rewrote `buildApifyJobs()` to produce apidojo-shaped configs:
- Actor: `apidojo/tiktok-scraper` (was `clockworks/tiktok-scraper`)
- Input: `{ startUrls: string[], maxItems: number, location: "US" }`
- Removed: `hashtags`, `resultsPerPage`, `newestPostDate`, `oldestPostDate`, `excludePinnedPosts`
- Removed: `daysAgoISO()` helper (7-day age filter is client-side in normalize-scrape.ts:190)
- Full mode budget: trending=800, average=1200, under=3000 → 25K raw/niche at ~$5 total
- Pilot mode budget: trending=80, average=120, under=300 (smoke test sizes)

normalize-scrape.ts was NOT modified — it already has `normalizeApidojo()` at lines 170-217.

### Step 2: apify-jobs tests updated

19 tests updated to assert:
- `actorId === "apidojo/tiktok-scraper"`
- `input.startUrls` = array of `https://www.tiktok.com/tag/<hashtag>` URLs
- `input.maxItems` = positive integer, `input.location === "US"`
- No clockworks-only fields
- Specific maxItems values for pilot and full modes

### Step 3: Orchestrator split

Added to `orchestrator.ts`:
- `scrapeRawToCache(opts)`: scrapes via Apify, normalizes, quality-filters, deduplicates by `platform_video_id`. Returns `NormalizedCorpusRow[]`. Does NOT bucket or write to DB.
- `bucketAndPersist(opts)`: takes rows + sealed version, applies bucket classification + per-niche stratification caps, upserts to training_corpus. Preserves the 8261876 batch-dedup fix.
- `writeRawCache(rows, path)` / `readRawCache(path)`: JSONL cache helpers. Date fields stored as ISO strings, parsed back to Date on read.
- `defaultCachePath(version)`: `.planning/cache/raw-<version>.jsonl`
- `buildCorpus()` kept as a thin legacy wrapper for backward compat.

25 orchestrator tests cover all new functions plus the JSONL roundtrip and Date preservation.

### Step 4: Calibration module + CLI

`src/lib/engine/corpus/calibration.ts` (pure functions):
- `percentile(sortedValues, p)`: linear interpolation
- `computeNicheStats(niche, views, pViral, pUnder)`: P10/P30/P50/P70/P90 + proposed thresholds
- `buildSanityWarnings(stats)`: warns on < 100 rows or tight separation; errors on empty/NaN
- `formatNumber(n)`: underscore-separated (250_000)
- `formatThresholdCodeBlock(version, stats)`: TypeScript code for operator to paste
- `calibrate(viewsByNiche)`: full pipeline → CalibrationResult

`scripts/calibrate-thresholds.ts`: operator CLI that reads JSONL cache, prints stats table + warnings + code block. Exits 0 on success, 1 on fatal errors. Does NOT write to thresholds.ts (D-13 operator-seal).

38 calibration unit tests pass.

### Step 5: build-corpus.ts four-mode CLI

`src/lib/engine/corpus/cli/build-corpus-args.ts` extended:
- `--smoke`: 1 niche × 1 hashtag × 20 items, dry-run, field-coverage report
- `--scrape`: calls `scrapeRawToCache()`, writes JSONL cache (no DB)
- `--calibrate`: reads JSONL cache, prints proposed thresholds code block
- `--build`: reads JSONL cache, calls `bucketAndPersist()`, upserts to DB
- `--pilot` / `--full`: deprecated aliases for `--smoke` / `--scrape`
- Added `--cache`, `--niches`, version slug format validation

30 arg tests pass including all modes, mutual exclusivity, and legacy flag combinations.

### Step 6: Plan files restructured

**01-06-PLAN.md** rewritten:
- Title: "Migrate to apidojo + scrape labeled corpus + calibrate empirical thresholds (D-09)"
- Flow: smoke → broad scrape → calibrate → human checkpoint → build → retrospective
- Target: ≥3000 labeled rows (vs old 50-video pilot framing)
- Cost: ~$5 Apify

**01-07-PLAN.md** rewritten:
- Title: "Measure v2.1 baseline on stratified 500-video subset → D-20 canonical row"
- Corpus already exists from 01-06 — no rebuild
- Adds `--subsample 500 --stratified --seed 42` flag task
- Cost: ~$1-3 DeepSeek (no Apify)
- Documents apidojo asymmetries in baseline doc requirements

## Deviations from Plan

None — plan executed exactly as written. All 6 steps committed atomically.

## Known Stubs

None — Block A is code-only infra migration. No live data, no placeholder values in production paths.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. The calibration script and JSONL cache are local-only (operator-facing) with no web exposure.

## Block B Status (awaiting operator)

Block A is complete. Block B (live execution) is blocked on:
1. Valid Apify Starter (or higher) APIFY_TOKEN — current FREE plan is exhausted
2. Operator to run: `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --smoke` (smoke test)
3. Operator to run: `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --scrape` (~$5)
4. Operator to run: `npx tsx scripts/calibrate-thresholds.ts --version full.2026-05-12` and hand-paste the threshold block into `src/lib/engine/corpus/thresholds.ts`
5. Operator to run: `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --build`

## Self-Check: PASSED

- All modified files exist at their expected paths
- 262 corpus tests pass (npx vitest run src/lib/engine/corpus/__tests__)
- 0 TypeScript errors in production code (pre-existing test-file errors are unrelated)
- No changes to normalize-scrape.ts (already polyglot) or thresholds.ts (operator seals later)
- No live API calls made during Block A
- All 7 commits present: 1ccbb0c, a54f856, b1fb5f2, 4616be3, b7c5936, 2cb72fd, 24446c2
