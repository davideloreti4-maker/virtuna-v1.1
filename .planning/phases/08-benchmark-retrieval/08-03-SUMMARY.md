---
phase: 08-benchmark-retrieval
plan: 03
subsystem: engine
tags: [embedder, gemini, pgvector, retrieval, bucket-derivation, re-ranker, vitest, tdd]

# Dependency graph
requires:
  - phase: 08-benchmark-retrieval/01
    provides: pgvector migration with match_corpus_videos + match_scraped_videos RPCs (param names: query_embedding, match_count, filter_niche, filter_platform, filter_follower_tier)
  - phase: 08-benchmark-retrieval/02
    provides: RetrievalEvidenceItem + BenchmarkRetrievalResult Zod schemas, SignalAvailability.retrieval, PredictionResult.retrieval_score + retrieval_evidence
  - phase: 01-training-corpus-eval-foundation
    provides: THRESHOLD_SNAPSHOTS["full.2026-05-11"] viralFloor/underCeiling per Phase-1 niche (read by bucket-derivation for the 5 calibrated niches)
  - phase: 04-wave-0-content-type-niche-detection
    provides: NICHE_TREE with benchmark_filters.tag_filters (read by re-ranker for hashtag overlap detection)
provides:
  - buildSubjectText() — single source of truth for D-06 subject formula (byte-identical at backfill + predict time)
  - embedQuery() — predict-time Gemini embedding call (RETRIEVAL_QUERY task type)
  - embedBatch() — backfill Gemini embedding call (≤100 sync batch, RETRIEVAL_DOCUMENT task type)
  - deriveBucket() — D-03a bucket derivation (corpus carry-forward / calibrated thresholds / non-calibrated percentile placeholders)
  - bucketValue() — D-03 score formula bucket-value mapping (viral=1.0, average=0.5, under=0.0)
  - softRerank() — D-04a +5% hashtag-overlap bonus, original similarity field UNMUTATED
  - matchTrainingCorpus() / matchScrapedVideos() — Supabase RPC wrappers for top-K cosine queries
  - CORPUS_NICHE_ALIASES (education→edu boundary translation), NON_CORPUS_ENGAGEMENT_PERCENTILES (placeholders awaiting Plan 05)
affects: [08-04-PLAN.md retrieval-stage.ts, 08-05-PLAN.md backfill auto-embed paths]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gemini embedding via existing @google/genai SDK (no new dep, no new env var)"
    - "Pure-function retrieval helpers — no IO, no logger in re-ranker + bucket-derivation"
    - "RPC client wrapper — error-on-supabase-error throw pattern (mirrors orchestrator.ts:353-363)"

key-files:
  created:
    - src/lib/engine/retrieval/embedder.ts
    - src/lib/engine/retrieval/bucket-derivation.ts
    - src/lib/engine/retrieval/re-ranker.ts
    - src/lib/engine/retrieval/pgvector-client.ts
    - src/lib/engine/__tests__/retrieval/embedder.test.ts
    - src/lib/engine/__tests__/retrieval/bucket-derivation.test.ts
    - src/lib/engine/__tests__/retrieval/re-ranker.test.ts
    - src/lib/engine/__tests__/retrieval/pgvector-client.test.ts
  modified: []

key-decisions:
  - "Gemini embedding model: gemini-embedding-001 with outputDimensionality: 768 (RESEARCH Finding 1 supersedes D-05's deprecated text-embedding-004 which shut down 2026-01-14)"
  - "NON_CORPUS_ENGAGEMENT_PERCENTILES shipped as 0/0 placeholders for all 5 non-calibrated niches; Plan 05 backfill will overwrite with real P80/P40 — fallback returns 'average' (safe default) until then"
  - "pgvector-client.ts impl committed in Task 2 GREEN (not Task 3) because re-ranker.ts imports MatchRow type from it — Task 3 commit added only the test file"
  - "Test pattern: vitest globals (no explicit imports for describe/it/expect/vi) — matches all existing engine __tests__/* files"

patterns-established:
  - "Retrieval module logger namespace: retrieval.<basename> (e.g. retrieval.embedder); created via createLogger({ module: 'retrieval.X' })"
  - "Sentry breadcrumb on success in stage-helper files; Sentry.captureException only at outer boundary on retry exhaustion"
  - "D-06 single source of truth: buildSubjectText() is the ONLY function that constructs the embedding subject. Plan 05's auto-embed paths + Plan 04's predict path MUST call this — never inline the formula"
  - "Re-rank bonus on sort key only — original similarity field NEVER mutated (D-02 persistence integrity)"
  - "Hashtag normalization at compare time: lowercase + strip leading # — taxonomy is lowercase no-prefix, scrape paths vary"

requirements-completed: [RETRIEVAL-03]

# Metrics
duration: 8min
completed: 2026-05-18
---

# Phase 8 Plan 03: Retrieval modules — embedder + bucket-derivation + re-ranker + pgvector-client Summary

**Four pure retrieval modules + their unit tests (58 new tests, all green), with D-06 subject-text formula locked as the single source of truth for cosine-similarity parity between backfill and predict-time paths.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-18T21:21:16Z
- **Completed:** 2026-05-18T21:29:00Z
- **Tasks:** 4 (3 TDD + 1 regression invariant)
- **Files created:** 8 (4 modules + 4 test files)
- **Files modified:** 0

## Accomplishments

- D-06 subject-text formula locked in `buildSubjectText` as the single source of truth — byte-identical across backfill (Plan 05) and predict-time (Plan 04) paths; verified by determinism test asserting exact string output
- Gemini embedding wrapper on `gemini-embedding-001` with `outputDimensionality: 768` — preserves D-05's 768d intent (matches migration vector(768) columns) while using the GA replacement model after text-embedding-004 shut down (RESEARCH Finding 1)
- Bucket derivation covers all 3 D-03a branches: training_corpus carry-forward, calibrated 5 niches via THRESHOLD_SNAPSHOTS, non-calibrated 5 niches via percentile placeholders (safe-default to "average" until Plan 05 backfill computes real P80/P40)
- Soft re-ranker with +5% hashtag overlap bonus AND immutability of the original similarity field — bonus lives on `rerank_score` (sort key only), so D-02 persisted item integrity is preserved (the bucket-vote denominator in D-03 sees the original cosine score)
- pgvector RPC client with throw-on-error semantics and nullable platform + followerTier passthrough (D-04 Tier 2/3 hierarchical relaxation works without alternate function variants)
- Edu↔education alias handled in `CORPUS_NICHE_ALIASES` — boundary translation for training_corpus's migration CHECK constraint (which accepts only "edu") versus NICHE_TREE's "education"
- BENCH-05 invariant: zero regressions — 762 baseline tests still green, 58 new tests added (820 total passed, 4 skipped, 0 failed)

## Task Commits

1. **Task 1 RED: embedder failing tests** — `3d4cae1` (test)
2. **Task 1 GREEN: embedder implementation** — `994b171` (feat)
3. **Task 2 RED: bucket-derivation + re-ranker failing tests** — `12a525a` (test)
4. **Task 2 GREEN: bucket-derivation + re-ranker + pgvector-client impl** — `58864a3` (feat)
5. **Task 3 GREEN: pgvector-client tests** — `c1c1d8b` (test)

_Note: pgvector-client.ts impl landed in commit 4 (Task 2 GREEN) because re-ranker.ts imports `MatchRow` from it as a TS type — see Deviations below. Task 3 added the test file only._

_Task 4 (BENCH-05 regression check) produced no file changes — pure invariant verification via `pnpm test`._

## Files Created/Modified

### Created

- `src/lib/engine/retrieval/embedder.ts` — Gemini SDK wrapper + D-06 `buildSubjectText` helper. Exports: `buildSubjectText`, `embedQuery`, `embedBatch`, `EMBEDDING_MODEL`, `EMBEDDING_DIM`. Logger namespace: `retrieval.embedder`. Sentry breadcrumb on success, capture on retry exhaustion.
- `src/lib/engine/retrieval/bucket-derivation.ts` — Pure module (no IO). Exports: `deriveBucket`, `bucketValue`, `NON_CORPUS_ENGAGEMENT_PERCENTILES`, `CORPUS_NICHE_ALIASES`. NEVER throws — unknown niche returns "average" (safe default).
- `src/lib/engine/retrieval/re-ranker.ts` — Pure soft re-ranker. Exports: `softRerank`, `HASHTAG_BONUS`. Original `similarity` field unmutated; bonus lives on `rerank_score`.
- `src/lib/engine/retrieval/pgvector-client.ts` — Supabase RPC wrapper for top-K cosine queries. Exports: `matchTrainingCorpus`, `matchScrapedVideos`, `MatchRow`, `MatchOptions`. Throw-on-error pattern.
- `src/lib/engine/__tests__/retrieval/embedder.test.ts` — 15 tests (D-06 determinism, null handling, 500-char truncation, embedQuery RETRIEVAL_QUERY contract, embedBatch RETRIEVAL_DOCUMENT contract, dim validation, ≤100 cap, retry exhaustion)
- `src/lib/engine/__tests__/retrieval/bucket-derivation.test.ts` — 18 tests (training_corpus carry-forward, calibrated 3 outcomes per niche, education→edu alias, non-calibrated placeholders + post-Plan-05 simulation, div-by-zero protection, unknown-niche fallback, bucketValue mapping)
- `src/lib/engine/__tests__/retrieval/re-ranker.test.ts` — 15 tests (overlap bonus, immutability, taxonomy lookup miss, hashtag normalization, K-slicing, edge cases for K=0/K=1/empty, similarity cap at 1.0)
- `src/lib/engine/__tests__/retrieval/pgvector-client.test.ts` — 10 tests (5 named-param shape per function, null data → [], throw-on-error, nullable platform + followerTier passthrough)

### Modified

None — strictly additive change. No imports added in `aggregator.ts`, `pipeline.ts`, or `types.ts` (those belong to Plans 02 and 04).

## Decisions Made

1. **Gemini embedding model upgraded from D-05 to RESEARCH Finding 1** — `text-embedding-004` was shut down 2026-01-14 (per Gemini deprecation notice). `gemini-embedding-001` is the GA replacement; specifying `outputDimensionality: 768` preserves D-05's 768d intent and matches the existing migration's `vector(768)` columns. Cost remains $0.15/M input tokens (negligible per-prediction).

2. **NON_CORPUS_ENGAGEMENT_PERCENTILES shipped as 0/0 placeholders for all 5 non-calibrated niches** — `tech-gadgets`, `gaming`, `fashion-style`, `music-performance`, `food-cooking`. Plan 05's `pnpm tsx scripts/embed-corpus.ts --derive-percentiles` will overwrite with real P80/P40 after backfill. Until then, `deriveBucket` returns "average" for these niches (safe default per RESEARCH Finding 5 — chicken-and-egg fallback).

3. **Hashtag normalization at re-rank time uses lowercase + strip leading `#`** — taxonomy `tag_filters` are lowercase without `#` (verified by reading `src/lib/niches/taxonomy.ts`); scrape paths sometimes emit `#prefixed` or mixed-case hashtags. Normalizing both sides avoids false negatives.

4. **Re-rank bonus capped at 1.0** — cosine similarity range is [0,1]; adding +0.05 to a 0.99 match would produce 1.04 without `Math.min(1, ...)`. The test explicitly verifies `rerank_score <= 1.0`.

5. **Hashtag immutability test asserts both return-shape AND source-input integrity** — the `softRerank` test verifies `result[0].similarity === inputItem.similarity` AND `originalItem.similarity` is unchanged after the call. This catches both shallow-mutation bugs (caller surfaces stale boost) and shared-reference bugs (caller mutates input array).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pgvector-client.ts impl landed in Task 2 GREEN (not Task 3)**
- **Found during:** Task 2 (re-ranker.ts implementation)
- **Issue:** `re-ranker.ts` imports `MatchRow` as a TypeScript type from `./pgvector-client`. With strict TS + `isolatedModules: true`, the file must exist as a TS module for the type-only import to resolve. Task 3 was scheduled to create pgvector-client.ts, but Task 2's re-ranker couldn't compile until pgvector-client.ts existed.
- **Fix:** Created `src/lib/engine/retrieval/pgvector-client.ts` (Task 3's deliverable file) as part of Task 2's GREEN commit `58864a3`. Task 3 then added only the test file (`pgvector-client.test.ts`) and verified the existing impl. All Task 3 acceptance criteria still pass — the file exists, exports the correct names, tests pass.
- **Files modified:** `src/lib/engine/retrieval/pgvector-client.ts` (created in Task 2 commit instead of Task 3)
- **Verification:** `grep -c 'supabase.rpc("match_corpus_videos"'` returns 1; `pnpm vitest run pgvector-client.test.ts` exits 0 with 10/10 tests passing.
- **Committed in:** `58864a3` (Task 2 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Zero scope creep — only the commit boundary between Task 2 and Task 3 shifted. All 4 deliverable files + 4 test files in the plan's `files_modified` frontmatter exist and pass their tests.

## Issues Encountered

None during plan execution. Some adjacent observations (logged for awareness, not requiring action):

- **`tsc --noEmit` reports `Cannot find name 'vi'` errors across all engine `__tests__/*` files** — this is a pre-existing project-wide issue (confirmed in `video-e2e.test.ts`, `gemini.test.ts`, `trends.test.ts`, `pipeline.test.ts`, `deepseek.test.ts`, `creator.test.ts`, `cost-benchmark.test.ts`, `cost-calculation.test.ts`). Vitest globals (`describe`, `it`, `expect`, `vi`) work at runtime via `globals: true` in `vitest.config.ts`, but the project hasn't added `vitest/globals` to `tsconfig.json`'s `types` array. Out of scope for Plan 03 — same condition existed pre-task. Test suite runs cleanly (820/820 pass).
- **Plan 04's expected aggregator.ts errors confirmed** — `pnpm exec tsc --noEmit` shows `aggregator.ts(330,9)` and `aggregator.ts(536,5)` missing-`retrieval`-property errors and `pipeline.ts(132,7)` CreatorContext shape mismatch. These are exactly the 13 known errors flagged in the spawn prompt as Plan 04's responsibility. No retrieval/* source-file (non-test) errors introduced by this plan.

## Threat Surface Scan

No new threat surface introduced beyond the plan's existing `<threat_model>` block (T-08-10 through T-08-15). All mitigations applied as designed:

- **T-08-10 (caption prompt injection)** — `embedContent` is a vectorization call, not a generation call; subject text is opaque data, never used as a prompt template.
- **T-08-11 (caption leakage in logs)** — `log.info` in embedder records only `duration_ms`, `dims`, `cost_cents`. No caption text logged; Sentry breadcrumb data field follows same pattern.
- **T-08-12 (RPC param injection)** — `supabase.rpc(name, {named_params})` uses Postgres prepared bindings; no string interpolation.
- **T-08-13 (embedBatch DoS)** — Hard cap of 100 texts per call enforced; MAX_RETRIES=2 with linear backoff.
- **T-08-14 (subject text formula drift)** — `buildSubjectText` is the only path for constructing the subject; determinism test asserts byte-identical output.
- **T-08-15 (embedding inversion)** — Accepted risk; not relevant in Plan 03 scope.

## User Setup Required

None — no external service configuration required. Plan 04 (retrieval-stage.ts wiring) and Plan 05 (backfill CLI) will surface any user-facing setup at their respective integration points.

## Next Phase Readiness

**Ready for Plan 04 (retrieval-stage.ts):**
- `buildSubjectText`, `embedQuery` importable from `@/lib/engine/retrieval/embedder`
- `matchTrainingCorpus`, `matchScrapedVideos` importable from `@/lib/engine/retrieval/pgvector-client`
- `softRerank` importable from `@/lib/engine/retrieval/re-ranker`
- `deriveBucket`, `bucketValue`, `CORPUS_NICHE_ALIASES` importable from `@/lib/engine/retrieval/bucket-derivation`
- `MatchRow` + `MatchOptions` types exported for orchestration

**Ready for Plan 05 (backfill auto-embed):**
- `buildSubjectText` + `embedBatch` importable for orchestrator.ts + apify webhook handler extensions
- `NON_CORPUS_ENGAGEMENT_PERCENTILES` is the constant Plan 05's `--derive-percentiles` mode will overwrite (after computing P80/P40 from the live scraped_videos pool)

**Blockers:** None for Plans 04 or 05. The 13 cross-plan TS errors in `aggregator.ts` and `pipeline.ts` close in Plan 04.

## Self-Check: PASSED

**File existence:**
- `src/lib/engine/retrieval/embedder.ts` — FOUND
- `src/lib/engine/retrieval/bucket-derivation.ts` — FOUND
- `src/lib/engine/retrieval/re-ranker.ts` — FOUND
- `src/lib/engine/retrieval/pgvector-client.ts` — FOUND
- `src/lib/engine/__tests__/retrieval/embedder.test.ts` — FOUND
- `src/lib/engine/__tests__/retrieval/bucket-derivation.test.ts` — FOUND
- `src/lib/engine/__tests__/retrieval/re-ranker.test.ts` — FOUND
- `src/lib/engine/__tests__/retrieval/pgvector-client.test.ts` — FOUND

**Commit existence (verified via `git log --oneline`):**
- `3d4cae1` test(08-03): add failing tests for retrieval/embedder — FOUND
- `994b171` feat(08-03): implement retrieval/embedder — FOUND
- `12a525a` test(08-03): add failing tests for bucket-derivation + re-ranker — FOUND
- `58864a3` feat(08-03): implement bucket-derivation + re-ranker + pgvector-client types — FOUND
- `c1c1d8b` test(08-03): add tests for retrieval/pgvector-client — FOUND

**Test suite verification:** 820 passed, 4 skipped, 0 failed (vs. 762 baseline before plan — exactly 58 new tests added: 15 embedder + 18 bucket-derivation + 15 re-ranker + 10 pgvector-client).

---
*Phase: 08-benchmark-retrieval*
*Completed: 2026-05-18*
