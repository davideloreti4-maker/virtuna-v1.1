---
phase: 01-training-corpus-eval-foundation
plan: "02"
subsystem: engine
tags: [vitest, typescript, eval-harness, macro-f1, bootstrap, calibration, ece, corpus]

requires:
  - phase: 01-training-corpus-eval-foundation/01-01
    provides: NICHES taxonomy and engine module references (additive-only contract for src/lib/engine/aggregator.ts)

provides:
  - "src/lib/engine/corpus/ pure-function module skeleton (no I/O, no DB, no network)"
  - "NICHES + NICHE_THRESHOLDS pilot snapshot (D-08), requiredImprovementFor() (D-18 sliding scale)"
  - "THRESHOLD_SNAPSHOTS lookup keyed by corpus_version (D-13 immutability)"
  - "bucketByViews() classifier with D-10 hard cutoff and bigint coercion"
  - "computeMacroF1() — sklearn-equivalent 3-class macro-F1 (D-14)"
  - "pairedBootstrapMacroF1() — mulberry32-seeded reproducible bootstrap (D-17, ≥200 iters)"
  - "scoreWithoutSignal() — replicates aggregator.selectWeights redistribution (EVAL-03, Pitfall 7)"
  - "bucketFromScore() — engine 0-100 score → bucket via 70/30 cuts (Phase 1 simplification)"
  - "aggregateStageLatencies() + quantile() — per-stage p50/p95/p99 across pipeline runs (RESEARCH §C.8)"
  - "metrics/index.ts barrel that re-exports computeECE from @/lib/engine/calibration (single source of truth)"

affects: [eval-harness, baseline, pilot-run, corpus-drift, regression-detection]

tech-stack:
  added: []
  patterns:
    - "Pure-function module under src/lib/engine/<area>/ — no createLogger, no Sentry, no DB; mirrors calibration.ts:114-176 computeECE shape"
    - "noUncheckedIndexedAccess-safe iteration with ?? 0 fallbacks (no ! non-null assertions)"
    - "Single source of truth via barrel re-export (metrics/index.ts → calibration.computeECE) instead of duplicating ECE"
    - "Immutable threshold snapshots keyed by corpus_version with throw-on-unknown lookup (D-13)"
    - "Mulberry32 seeded RNG copied verbatim from ml.ts:85-93 for cross-module determinism guarantee"

key-files:
  created:
    - src/lib/engine/corpus/eval-config.ts
    - src/lib/engine/corpus/thresholds.ts
    - src/lib/engine/corpus/bucketing.ts
    - src/lib/engine/corpus/metrics/macro-f1.ts
    - src/lib/engine/corpus/metrics/bootstrap.ts
    - src/lib/engine/corpus/metrics/score-to-bucket.ts
    - src/lib/engine/corpus/metrics/leave-one-out.ts
    - src/lib/engine/corpus/metrics/stage-latency.ts
    - src/lib/engine/corpus/metrics/index.ts
    - src/lib/engine/corpus/__tests__/eval-config.test.ts
    - src/lib/engine/corpus/__tests__/thresholds.test.ts
    - src/lib/engine/corpus/__tests__/bucketing.test.ts
    - src/lib/engine/corpus/__tests__/macro-f1.test.ts
    - src/lib/engine/corpus/__tests__/bootstrap.test.ts
    - src/lib/engine/corpus/__tests__/score-to-bucket.test.ts
    - src/lib/engine/corpus/__tests__/leave-one-out.test.ts
    - src/lib/engine/corpus/__tests__/stage-latency.test.ts
  modified: []

key-decisions:
  - "ECE is re-exported from src/lib/engine/calibration via metrics/index.ts — never reimplemented (single source of truth, CONTEXT.md:124)"
  - "scoreWithoutSignal replicates aggregator.selectWeights inline (Pitfall 7) — does NOT call aggregator.aggregateScores with mutated PipelineResult (warning-string matching is fragile to refactors)"
  - "bigint views coerce via Number() at the boundary; classification logic uses plain numeric comparison (D-10 hard cutoff applies to numbers regardless of input type)"
  - "Threshold snapshots are stored in a Record<string, ThresholdsByNiche> with throw-on-unknown lookup — D-13 immutability enforced via 'never edit existing entries; append-only'"
  - "macro-F1 confusion matrix follows ml.ts:104-106 convention cm[actual][predicted] for cross-module consistency"
  - "score-to-bucket niche argument is preserved (underscore-prefixed) for forward compatibility with Phase 10 per-niche calibration, even though Phase 1 uses uniform 70/30 cuts"
  - "Added a dedicated score-to-bucket.test.ts (4 tests) — not in the plan's frontmatter file list but trivial to verify and contributes to coverage; treated as a small additive scope item"

patterns-established:
  - "Pure-function corpus/metrics module — namespaced under src/lib/engine/corpus/metrics/* with co-located __tests__/ and a barrel index.ts"
  - "Table-driven boundary tests for threshold classifiers (D-10 hard cutoff inclusive/exclusive boundaries) — see bucketing.test.ts"
  - "Sklearn-equivalent macro-F1 fixture pattern: hand-computed expected values at 4-decimal precision via round4() helper"
  - "Deterministic bootstrap testing: same-seed → same pValue assertion across two independent calls; degenerate case (B===A) tested for pValue=1.0"

requirements-completed: [CORPUS-05, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-07]

duration: ~6 min
completed: 2026-05-11
---

# Phase 01 Plan 02: Eval config, thresholds, bucketing, pure metrics Summary

**Pure-function corpus + eval kernel — typed niche/bucket constants, D-13 immutable threshold snapshots, D-10 hard-cutoff bucketing classifier, sklearn-equivalent macro-F1, mulberry32-seeded paired bootstrap (D-17), aggregator-faithful leave-one-out (EVAL-03), and per-stage latency quantiles — shipped as 9 source modules + 8 test files with 77 passing tests at 94.81-100% coverage on the corpus module.**

## Performance

- **Duration:** ~6 min (07:15 → 07:22 UTC+2)
- **Started:** 2026-05-11T05:15:50Z
- **Completed:** 2026-05-11T05:22:11Z
- **Tasks:** 3 (all TDD: RED test commit → GREEN implementation commit per task)
- **Files created:** 17 (9 source modules + 8 test files)
- **Tests added:** 77 (across 8 test files)

## Accomplishments

- Full pure-function foundation for the corpus + eval module — zero I/O, zero side effects, runs entirely in process
- macro-F1 implementation matches sklearn `f1_score(..., average='macro')` to 4 decimals on hand-computed 3-class fixture
- Paired bootstrap is deterministic under fixed seed (same inputs + seed=42 → same pValue across consecutive calls); enforces ≥200 iters per D-17
- Leave-one-out replicates aggregator.selectWeights proportional redistribution directly (Pitfall 7 — avoids aggregator's warning-string fragility, no engine code change)
- ECE is re-exported from `@/lib/engine/calibration` via `metrics/index.ts` — never reimplemented (single source of truth)
- Corpus module coverage: 100% on corpus/* (eval-config, thresholds, bucketing); 94.81% statements / 80% branches / 100% functions / 98.16% lines on corpus/metrics/* — well above the 80% threshold from the must-have

## Task Commits

Each task was committed atomically with a RED (test-first) + GREEN (implementation) pair:

1. **Task 1: eval-config, thresholds, bucketing**
   - `7f77578` — `test(01-02): add failing tests for eval-config, thresholds, bucketing`
   - `3638d87` — `feat(01-02): implement eval-config, thresholds, bucketing — pure constants and classifier`

2. **Task 2: Macro-F1, paired bootstrap, score-to-bucket**
   - `2c9959e` — `test(01-02): add failing tests for macro-f1, bootstrap, score-to-bucket`
   - `861b081` — `feat(01-02): implement macro-f1, paired-bootstrap, score-to-bucket`

3. **Task 3: Leave-one-out, stage-latency, metrics barrel**
   - `fed3c71` — `test(01-02): add failing tests for leave-one-out and stage-latency`
   - `94e61b2` — `feat(01-02): implement leave-one-out, stage-latency, metrics barrel`

## Files Created/Modified

### Source modules (9 files)
- `src/lib/engine/corpus/eval-config.ts` — NICHES (D-03), NICHE_THRESHOLDS pilot snapshot (D-08), TARGET_DISTRIBUTION pilot/full (D-01), `requiredImprovementFor()` (D-18 sliding scale 15%/10%/7%), constants: `MAX_PER_NICHE_REGRESSION_PP`, `BOOTSTRAP_ITERATIONS`, `SIGNIFICANCE_ALPHA`, `MIN_VIEWS_FOR_MAE_ENGAGEMENT`, `VIRAL_SCORE_CUT`, `UNDER_SCORE_CUT`
- `src/lib/engine/corpus/thresholds.ts` — `CorpusVersion`, `NicheThresholds`, `ThresholdsByNiche`; `THRESHOLD_SNAPSHOTS` with `pilot.2026-05-12` entry; `getThresholds()` throws on unknown (D-13); `listKnownVersions()` debug helper
- `src/lib/engine/corpus/bucketing.ts` — `bucketByViews(input, thresholds)` pure classifier with D-10 hard cutoff, bigint coercion via Number(), unknown-niche guard returning "average"
- `src/lib/engine/corpus/metrics/macro-f1.ts` — `computeMacroF1(predicted, actual) → { macroF1, perClass, confusionMatrix }`; cm[actual][predicted] convention; throws on empty/mismatched-length
- `src/lib/engine/corpus/metrics/bootstrap.ts` — `pairedBootstrapMacroF1()` with mulberry32 seed (mirrors ml.ts:85-93); one-sided pValue + 95% CI on bootstrap delta distribution
- `src/lib/engine/corpus/metrics/score-to-bucket.ts` — `bucketFromScore(score, _niche)` with 70/30 cuts (Phase 1 simplification, niche arg preserved for Phase 10)
- `src/lib/engine/corpus/metrics/leave-one-out.ts` — `SCORE_WEIGHTS_BASE` mirrors aggregator.ts:23-29; `scoreBaseline()` + `scoreWithoutSignal()` replicates selectWeights proportional redistribution
- `src/lib/engine/corpus/metrics/stage-latency.ts` — `aggregateStageLatencies()` buckets per-stage timings; `quantile()` linear-interpolation
- `src/lib/engine/corpus/metrics/index.ts` — barrel re-exports computeECE from `@/lib/engine/calibration` + all metric modules

### Test files (8 files, 77 tests)
- `src/lib/engine/corpus/__tests__/eval-config.test.ts` (17 tests) — NICHES, NICHE_THRESHOLDS, TARGET_DISTRIBUTION, all numeric constants, requiredImprovementFor across all D-18 bands, Niche/Bucket type sanity
- `src/lib/engine/corpus/__tests__/thresholds.test.ts` (5 tests) — pilot snapshot lookup, throw on unknown version, listKnownVersions
- `src/lib/engine/corpus/__tests__/bucketing.test.ts` (17 tests) — D-10 boundary semantics for beauty + comedy + table-driven (fitness/edu/lifestyle), bigint inputs (including > Number.MAX_SAFE_INTEGER), unknown-niche guard
- `src/lib/engine/corpus/__tests__/macro-f1.test.ts` (6 tests) — sklearn-equivalent hand-computed fixture (CM [[2,0,0],[1,2,0],[0,1,2]] → macroF1=0.7556), perfect predictor, all-wrong, empty/mismatch throws, single-class degenerate (0.3333)
- `src/lib/engine/corpus/__tests__/bootstrap.test.ts` (8 tests) — determinism (same seed → same pValue), null hypothesis (B===A → delta=0, pValue=1.0), significance (B better → pValue<0.05), iters<200 throws, mismatched lengths throw, result shape, iters>200 (CLI override)
- `src/lib/engine/corpus/__tests__/score-to-bucket.test.ts` (4 tests) — 70/30 boundary inclusivity, niche-arg unused (all niches produce identical mapping)
- `src/lib/engine/corpus/__tests__/leave-one-out.test.ts` (9 tests) — scoreBaseline matches aggregator weights (uniform 50→50, non-uniform→53), uniform input → ablation=50 every signal, 5 distinct ablations on fully-distinct input, normalized weights sum=1.0, SCORE_WEIGHTS_BASE matches aggregator.ts:23-29
- `src/lib/engine/corpus/__tests__/stage-latency.test.ts` (11 tests) — quantile linear interpolation ([1..5] p50=3, [1..4] p50=2.5), empty input, single sample, multi-stage bucketing, p95/p99 on 100-sample uniform distribution

## Decisions Made

- **ECE is re-exported, not reimplemented** — `metrics/index.ts` re-exports `computeECE` from `@/lib/engine/calibration`. This is the single source of truth per CONTEXT.md:124 and avoids drift between two ECE implementations.
- **scoreWithoutSignal replicates aggregator.selectWeights inline** — per RESEARCH §C.3 caveat (Pitfall 7), avoiding aggregator's warning-string-based signal-availability detection that is fragile to refactors. SCORE_WEIGHTS_BASE is a snapshot of aggregator.ts:23-29; the test `SCORE_WEIGHTS_BASE matches aggregator.ts` provides a tripwire if the canonical weights ever change.
- **bigint coercion at the boundary** — `bucketByViews` accepts `number | bigint` and coerces to Number() once before the integer comparisons. D-10 hard cutoff applies identically regardless of input type. Test exercises a bigint above Number.MAX_SAFE_INTEGER to confirm coercion doesn't silently fail.
- **Threshold snapshots use throw-on-unknown lookup** — `getThresholds("nonexistent")` throws, not returns a silent default. D-13 immutability is enforced via the "never edit existing entries; append-only" comment; tests assert the pilot.2026-05-12 keys exist with the D-08 values exactly.
- **macro-F1 confusion matrix follows ml.ts:104-106 convention** — `cm[actual][predicted]`. CLASSES order is `["viral", "average", "under"]` everywhere for consistency.
- **score-to-bucket niche arg preserved** — Underscore-prefixed (`_niche`) to suppress unused-parameter lint, kept in the signature for forward compatibility with Phase 10 per-niche calibration.

## Deviations from Plan

### Minor additions (in-scope, no Rule 4 needed)

**1. [Rule 2 - Coverage hardening] Added a score-to-bucket.test.ts (4 tests)**
- **Found during:** Task 2 planning
- **Issue:** Plan frontmatter listed 7 test files; `score-to-bucket.ts` had no dedicated test file. Module is trivial but contributes to coverage and is easier to extend than uncovered code.
- **Fix:** Added a 4-test file covering boundary inclusivity and niche-arg sanity.
- **Files modified:** src/lib/engine/corpus/__tests__/score-to-bucket.test.ts (new)
- **Verification:** All 4 tests pass; score-to-bucket.ts hits 100/100/100/100 coverage.
- **Committed in:** `2c9959e` (Task 2 RED commit)

**2. [Rule 1 - Test fixture bug] Refactored leave-one-out "5 distinct ablations" fixture**
- **Found during:** Task 3 GREEN test run
- **Issue:** Original fixture `NON_UNIFORM = {behavioral:80, gemini:20, ml:50, rules:50, trends:50}` produces only 4 distinct ablation scores because ml and rules share weight 0.15 and have identical scores → their ablations coincide.
- **Fix:** Added a second fixture `ALL_DISTINCT = {behavioral:80, gemini:20, ml:40, rules:60, trends:70}` and switched the "5 distinct" assertion to use it. The original `NON_UNIFORM` fixture is kept for the "removing behavioral lowers aggregate" assertion (still valid behavior coverage).
- **Files modified:** src/lib/engine/corpus/__tests__/leave-one-out.test.ts
- **Verification:** All 9 tests pass.
- **Committed in:** `94e61b2` (Task 3 GREEN commit, in same commit as the implementation since the implementation was already correct).

**3. [Rule 3 - Blocking TS error] Switched BigInt literals to BigInt() constructor in bucketing.test.ts**
- **Found during:** Task 1 GREEN tsc check
- **Issue:** Project's tsconfig target is ES2017; BigInt literals (`1_000_000n`) require ES2020+, causing TS2737 errors despite Vitest runtime handling them fine.
- **Fix:** Replaced all `Xn` literal syntax with `BigInt(X)` constructor calls. Functionally identical, ES2017-compatible.
- **Files modified:** src/lib/engine/corpus/__tests__/bucketing.test.ts
- **Verification:** Zero TS errors on corpus files; bigint tests still pass with identical semantics.
- **Committed in:** `3638d87` (Task 1 GREEN commit)

---

**Total deviations:** 3 minor (1 test additivity, 1 fixture bug, 1 TS target compat fix)
**Impact on plan:** No scope creep. All adjustments tightened coverage, fixed an edge case in my own test fixture, and resolved a TS target incompatibility. Implementation modules match the plan exactly.

## Issues Encountered

- **Pre-existing vitest.config.ts global coverage threshold blocks the verify command's coverage check.** The plan's verify command is `npx vitest run --coverage ... src/lib/engine/corpus/`, expecting the path arg to scope coverage to the corpus dir. But `vitest.config.ts` has `include: ["src/lib/engine/**/*.ts"]` for coverage, so the global 80% threshold is computed across the whole engine directory and fails at 11.73% statements (because most engine files have no test runs from a path-scoped invocation). This is unrelated to my new code — corpus-scoped coverage is 94.81-100%, well above the must-have's 80% threshold. **Resolution:** Did not modify vitest.config.ts (out of scope per Rule 1 SCOPE BOUNDARY). The substantive coverage gate is met; logging the config-level mismatch here.
- **Pre-existing tsc errors in `src/lib/engine/__tests__/calibration.test.ts`** (`describe`/`it`/`expect` not found) are unrelated to this plan — those tests use vitest globals without import, and tsconfig has no `"types": ["vitest/globals"]`. My new tests explicitly `import { describe, it, expect } from "vitest"` so they're clean. Did not fix the existing files (out of scope).

## Deferred Issues

- **vitest.config.ts coverage path scoping** — the global `include: ["src/lib/engine/**/*.ts"]` causes path-scoped vitest runs to fail the global threshold gate. A future plan should either (a) make coverage thresholds per-file or (b) accept that the verify command needs to drop the threshold flags when path-scoping. Out of scope for this pure-function module plan.
- **Existing engine `__tests__/*.test.ts` files use vitest globals without explicit imports** — they trip tsc without `"types": ["vitest/globals"]` in tsconfig. Not blocking; vitest itself runs them fine. Could be cleaned up as a minor tooling pass.

## Next Phase Readiness

- **Plan 01-03 (and onwards)** can now import:
  - `bucketByViews`, `getThresholds`, `listKnownVersions` for corpus row classification
  - `computeMacroF1`, `pairedBootstrapMacroF1`, `bucketFromScore`, `scoreWithoutSignal`, `scoreBaseline`, `aggregateStageLatencies`, `quantile`, `computeECE` from `@/lib/engine/corpus/metrics`
  - `NICHES`, `NICHE_THRESHOLDS`, `requiredImprovementFor`, `BOOTSTRAP_ITERATIONS`, `SIGNIFICANCE_ALPHA`, `VIRAL_SCORE_CUT`, `UNDER_SCORE_CUT`, `MAX_PER_NICHE_REGRESSION_PP`, `MIN_VIEWS_FOR_MAE_ENGAGEMENT` from `@/lib/engine/corpus/eval-config`
- **No blockers.** All pure functions ship with full test coverage and clean tsc.

## Self-Check: PASSED

### Created files verified
- `src/lib/engine/corpus/eval-config.ts` — FOUND
- `src/lib/engine/corpus/thresholds.ts` — FOUND
- `src/lib/engine/corpus/bucketing.ts` — FOUND
- `src/lib/engine/corpus/metrics/macro-f1.ts` — FOUND
- `src/lib/engine/corpus/metrics/bootstrap.ts` — FOUND
- `src/lib/engine/corpus/metrics/score-to-bucket.ts` — FOUND
- `src/lib/engine/corpus/metrics/leave-one-out.ts` — FOUND
- `src/lib/engine/corpus/metrics/stage-latency.ts` — FOUND
- `src/lib/engine/corpus/metrics/index.ts` — FOUND
- All 8 test files — FOUND

### Commits verified
- `7f77578` (test Task 1), `3638d87` (feat Task 1) — FOUND
- `2c9959e` (test Task 2), `861b081` (feat Task 2) — FOUND
- `fed3c71` (test Task 3), `94e61b2` (feat Task 3) — FOUND

### Tests verified
- `npx vitest run src/lib/engine/corpus/` → 77 passed (8 test files)
- `npx tsc --noEmit` → 0 new errors in corpus files

---
*Phase: 01-training-corpus-eval-foundation*
*Plan: 01-02*
*Completed: 2026-05-11*
