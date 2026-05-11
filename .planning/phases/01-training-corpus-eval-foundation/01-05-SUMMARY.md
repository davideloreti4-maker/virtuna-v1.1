---
phase: 01-training-corpus-eval-foundation
plan: "05"
subsystem: engine

tags: [vitest, typescript, eval-harness, macro-f1, tdd, baseline, leave-one-out, ece, cost-cap, cli]

# Dependency graph
requires:
  - phase: 01-training-corpus-eval-foundation/01-01
    provides: "training_corpus + benchmark_results schema + TypeScript types"
  - phase: 01-training-corpus-eval-foundation/01-02
    provides: "computeMacroF1, computeECE, bucketFromScore, aggregateStageLatencies, scoreWithoutSignal, NICHES, eval-config constants"
  - phase: 01-training-corpus-eval-foundation/01-04
    provides: "corpus-version reader, orchestrator (package.json build-corpus entry)"

provides:
  - "runEvalOverCorpus(opts) — paginated training_corpus loop, text-mode AnalysisInput, awaited aggregateScores (benchmark.ts:515 bug fixed), cost cap via CostCapExceededError, per-row isolation"
  - "runEvalHarness(opts) — full BenchmarkReport assembly: macro-F1, per-niche F1, ECE, LOO signal contribution, latency p50/p95/p99, viral_recall, under_precision, MAE, failure_cases, benchmark_results persist"
  - "measureV21Baseline(corpusVersion) — D-20 entrypoint: hardcodes ENGINE_VERSION ('2.1.0'), persists one benchmark_results row"
  - "top10Mispredictions(results) — severity-ranked failure curation for JSONB column"
  - "parseEvalArgs(argv) — pure-function CLI arg parser (BLOCKER-5 resolution), EvalArgsError with usage string"
  - "tsx scripts/eval.ts — operator CLI wrapping harness; --baseline flag, --leave-one-out, --max-total-cost-cents, --delay-ms, --output"
  - "package.json 'eval' npm script entry"
  - "29 passing TDD tests across 4 new test files"

affects:
  - "01-06+ (Plan G pilot run: calls tsx scripts/eval.ts --baseline to produce first benchmark_results row)"
  - "Phase 12 (paired bootstrap comparison against future engine versions)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Text-mode corpus evaluation: input_mode='text' + content_text=caption constructs a real AnalysisInput (types.ts:53-85) — no 'as never' cast, no video bytes required (BLOCKER-2 resolution)"
    - "Always-await aggregateScores pattern — fixes the benchmark.ts:515 missing-await bug in new code"
    - "CostCapExceededError typed exception propagates through per-row try/catch to abort the whole loop (Pitfall 5)"
    - "LOO signal contribution uses scoreWithoutSignal from metrics/leave-one-out.ts — never calls aggregator with mutated PipelineResult (Pitfall 7)"
    - "computeECE returns {ece, bins} — extract .ece field (plan's type cast was incorrect)"
    - "JSONB insert cast pattern: complex TypeScript types cast via 'as never' on Supabase insert (matches competitor_tables cron pattern)"
    - "CLI CJS shell: require() after tsconfig-paths register() (same as build-corpus.ts — avoids top-level-await CJS limitation)"

key-files:
  created:
    - src/lib/engine/corpus/eval-runner.ts
    - src/lib/engine/corpus/eval-harness.ts
    - src/lib/engine/corpus/baseline.ts
    - src/lib/engine/corpus/failure-cases.ts
    - src/lib/engine/corpus/cli/eval-args.ts
    - scripts/eval.ts
    - src/lib/engine/corpus/__tests__/eval-runner.test.ts
    - src/lib/engine/corpus/__tests__/eval-harness.test.ts
    - src/lib/engine/corpus/__tests__/failure-cases.test.ts
    - src/lib/engine/corpus/__tests__/eval-args.test.ts
  modified:
    - package.json (added eval script entry)

key-decisions:
  - "Text-mode corpus evaluation (BLOCKER-2): Phase 1 uses input_mode='text' + caption. Video-mode (tiktok_url) deferred to Phase 10/12 — avoids re-fetch cost/latency and constructs a real AnalysisInput without casts"
  - "computeECE returns {ece,bins} not a plain number: the plan's cast `(computeECE as ...) => number` was incorrect; fixed to call computeECE(ecePairs, 10).ece"
  - "LOO test fixture redesigned for mathematical consistency: behavioral=80 at average boundary produces ablation score ~22 (under) when removed; trends=10 removal keeps score ~46 (average) — achievable differential at 70/30 thresholds"
  - "JSONB insert uses 'as never' cast on the full insert object — matches existing corpus cron pattern; complex types (per_class_metrics, signal_contribution, failure_cases) are not directly assignable to Supabase Json"
  - "CLI uses require() after tsconfig-paths register() — matches build-corpus.ts (tsx CJS default doesn't support top-level await dynamic import)"

patterns-established:
  - "TDD RED/GREEN per task (3 tasks × 2 commits = 6 feat/test commit pairs)"
  - "Separate behavioral LOO test using self-consistent signal fixtures: both predicted bucket AND ablation bucket are derived from the same signal math (not from mocked predictedScore)"
  - "Sentry.captureException in per-row catch with engineVersion tag — mirrors refresh-competitors cron per-config isolation"

requirements-completed: [EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-08]

# Metrics
duration: ~8min
completed: 2026-05-11
---

# Phase 01 Plan 05: Eval harness + baseline measurement + eval CLI Summary

**End-to-end eval harness: text-mode corpus loop, awaited aggregateScores (benchmark.ts bug fix), cost cap, LOO signal contribution, ECE, bucket metrics, failure curation, benchmark_results persist, and measureV21Baseline (D-20) — 29 TDD tests across 4 modules.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-11T05:38:13Z
- **Completed:** 2026-05-11T05:46:31Z
- **Tasks:** 3 (all TDD: RED test commit + GREEN implementation commit per task)
- **Files created:** 10 (5 source modules + 4 test files + 1 CLI script)
- **Files modified:** 1 (package.json)
- **Tests added:** 29 (across 4 test files; 182 total corpus tests now pass)

## Accomplishments

- **eval-runner.ts** — `runEvalOverCorpus(opts)`: paginated training_corpus fetch (50-row batches), constructs real `AnalysisInput` (text-mode, no casts), always-awaits `aggregateScores` (BLOCKER-2 + benchmark.ts:515 fix), per-row try/catch with Sentry capture, `CostCapExceededError` typed exception when cumulative cost exceeds cap (Pitfall 5), per-row spike monitor (3 consecutive 2× avg rows), reads typed PredictionResult top-level fields for signalScores (no Record<string,unknown> casts)
- **eval-harness.ts** — `runEvalHarness(opts)`: assembles full BenchmarkReport — macro-F1 (D-14), per-niche F1 (D-15), ECE via `computeECE(...).ece`, LOO signal contribution per signal when `leaveOneOut=true`, p50/p95/p99 global + per-stage latency, viral_recall + under_precision, MAE engagement rate (Pitfall 4), top-10 failure cases — persists to benchmark_results via service client
- **baseline.ts** — `measureV21Baseline(corpusVersion)`: D-20 canonical entrypoint, hardcodes ENGINE_VERSION = "2.1.0" (D-21), persist=true
- **failure-cases.ts** — `top10Mispredictions(results)`: severity rubric (viral↔under=2, others=1), severity-first sort, max 10, first 3 warnings
- **cli/eval-args.ts** — `parseEvalArgs(argv)`: pure function, typed EvalArgs, EvalArgsError with .usage, all 7 flags, conflicting-flag guard, `--flag=value` syntax (BLOCKER-5 resolution)
- **scripts/eval.ts** — thin CJS shell: `require()` after `tsconfig-paths register()`, delegates to parseEvalArgs, calls measureV21Baseline or runEvalHarness, prints summary, optional JSON dump
- **package.json** — `"eval": "npx tsx scripts/eval.ts"` added alongside `build-corpus`

## Task Commits

TDD RED + GREEN pattern per task:

1. **Task 1: eval-runner + failure-cases (RED)** — `fe9ed9f` (test)
2. **Task 1: eval-runner + failure-cases (GREEN)** — `72a338c` (feat)
3. **Task 2: eval-harness (RED)** — `509c48d` (test)
4. **Task 2: eval-harness + baseline (GREEN)** — `cc5499f` (feat)
5. **Task 3: eval-args (RED)** — `a2c25f9` (test)
6. **Task 3: eval-args + scripts/eval.ts + package.json (GREEN)** — `4766ddc` (feat)
7. **TypeScript fix (Rule 1)** — `eb8d965` (fix)

## Files Created/Modified

### Source modules (6 files)
- `src/lib/engine/corpus/eval-runner.ts` — `runEvalOverCorpus`, `RawEvalResult`, `CostCapExceededError`, `EvalRunnerOptions`, `extractSignalScores`
- `src/lib/engine/corpus/eval-harness.ts` — `runEvalHarness`, `BenchmarkReport`, `RunEvalHarnessOptions`, `persistBenchmarkRow`
- `src/lib/engine/corpus/baseline.ts` — `measureV21Baseline`
- `src/lib/engine/corpus/failure-cases.ts` — `top10Mispredictions`, `CuratedFailureCase`
- `src/lib/engine/corpus/cli/eval-args.ts` — `parseEvalArgs`, `EvalArgsError`, `EVAL_USAGE`, `EvalArgs`
- `scripts/eval.ts` — CLI entry point

### Test files (4 files, 29 tests)
- `src/lib/engine/corpus/__tests__/eval-runner.test.ts` (5 tests) — all rows processed + aggregateScores awaited, AnalysisInput shape (no `as never`), signalScores typed fields, CostCapExceededError abort, per-row failure isolation
- `src/lib/engine/corpus/__tests__/failure-cases.test.ts` (7 tests) — empty, all-correct, null-predicted, severity ordering, 10-cap, field correctness, severity-1
- `src/lib/engine/corpus/__tests__/eval-harness.test.ts` (4 tests) — BenchmarkReport shape, BLOCKER-6 LOO behavioral non-zero, ECE null when no scores, failure_cases capped at 10
- `src/lib/engine/corpus/__tests__/eval-args.test.ts` (13 tests) — all 7 flags, defaults, conflicting-flag rejection, `--flag=value` syntax, EVAL_USAGE content

### Modified
- `package.json` — added `"eval": "npx tsx scripts/eval.ts"` in scripts block

## Decisions Made

- **Text-mode corpus evaluation** (BLOCKER-2): Phase 1 uses `input_mode: "text"` with `content_text = row.caption`. The corpus stores captions but not raw video bytes; video_upload requires Supabase Storage path and tiktok_url forces live re-fetch (slow, costly). Text-mode matches the v2.1 "describe your idea" production path and produces all 5 signal scores via graceful degradation in the aggregator. Deferred to Phase 10/12 if video-resolution accuracy proves necessary.
- **computeECE return type** (Rule 1): The plan's action block cast `computeECE` as returning a plain `number`. The actual function (calibration.ts:114) returns `{ ece: number; bins: CalibrationBin[] }`. Fixed to call `.ece` on the result.
- **LOO test fixture mathematical consistency** (Rule 1): The original fixture used `predictedScore=80` (viral bucket) but `signalScores.behavioral=95` produces a score of ~65.75 via `scoreBaseline` — averaging bucket, not viral. Removing either behavioral OR trends from flat-50 rows produces the same ablation result, making `behavioral contribution == trends contribution`. Fixed with a fixture where behavioral=80 + low other signals (gemini=30, ml=20, rules=20, trends=10): baseline=42.5 (average); without behavioral=22.3 (under); without trends=46.1 (average) — clear differential.
- **JSONB insert cast**: Complex TypeScript types (MacroF1Result["perClass"], Record<Signal, number>, etc.) are not directly assignable to Supabase's `Json` type. Applied `as never` on the full insert object, matching the competitor_tables cron pattern already established in the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] computeECE returns {ece,bins} not a plain number**
- **Found during:** Task 2 GREEN — examining the actual calibration.ts:114 signature
- **Issue:** The plan's action block contained `(computeECE as (p: typeof ecePairs, n: number) => number)(ecePairs, 10)`. The actual signature is `computeECE(pairs: OutcomePair[], numBins?: number): { ece: number; bins: CalibrationBin[] }`. The cast would have returned a `{ ece, bins }` object where a number was expected, silently corrupting the ECE field in BenchmarkReport.
- **Fix:** Called `computeECE(ecePairs, 10).ece` — extracts the numeric ECE from the returned object.
- **Files modified:** `src/lib/engine/corpus/eval-harness.ts`
- **Verification:** `report.ece` is null when ecePairs is empty (test passes); tsc reports no errors
- **Committed in:** `cc5499f`

**2. [Rule 1 - Bug] LOO test fixture redesigned for mathematical consistency (BLOCKER-6)**
- **Found during:** Task 2 GREEN test run — `LOO produces non-zero contribution` test failed with `expected 0.9394 to be greater than 0.9394`
- **Issue:** The original fixture had `predictedScore=80` (viral) but `signalScores.behavioral=95` and other signals at 50. `scoreWithoutSignal({behavioral:95,gemini:50,ml:50,rules:50,trends:50}, "behavioral") = 50 (average)` AND `scoreWithoutSignal({...}, "trends") = 67.5 (average)` — both ablations produce the same "average" bucket, so both signals get identical F1 delta = identical contribution. The assertion `|behavioral| > |trends|` fails (0.9394 == 0.9394).
- **Fix:** Redesigned fixture with low other-signal values (gemini=30, ml=20, rules=20, trends=10) so `behavioral=80` sits at average boundary (~42.5). Without behavioral: score drops to ~22 (under). Without trends: score stays at ~46 (average). This creates a real differential — removing behavioral changes buckets, removing trends does not.
- **Files modified:** `src/lib/engine/corpus/__tests__/eval-harness.test.ts`
- **Verification:** All 4 eval-harness tests pass; BLOCKER-6 assertion verified
- **Committed in:** `cc5499f`

**3. [Rule 1 - Bug] TypeScript errors in eval-harness.ts**
- **Found during:** Post-implementation tsc check
- **Issue 1:** `RawEvalResult` imported as type but not referenced as a named type symbol (only used via inference from `runEvalOverCorpus` return type). TS6133 unused import error.
- **Issue 2:** Supabase `insert()` overload resolution fails when complex TypeScript types (MacroF1Result["perClass"], Record<Signal, number>) are passed for JSONB columns typed as `Json`. TS2769 no overload match.
- **Fix:** Removed the `RawEvalResult` import. Applied `as never` cast on the full insert object (matches existing cron patterns in the codebase).
- **Files modified:** `src/lib/engine/corpus/eval-harness.ts`
- **Verification:** `npx tsc --noEmit` — zero errors in new eval-harness/baseline/eval-runner/failure-cases/eval-args files
- **Committed in:** `eb8d965`

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in plan action block and test fixture design)
**Impact on plan:** No scope creep. All three fixes were necessary for correctness. Implementation contracts match the plan spec exactly; only the ECE call and test fixture values were adjusted.

## Issues Encountered

- **computeECE signature mismatch**: The plan's inline cast would have silently corrupted the ECE field. Fixed by reading the actual calibration.ts source before implementing.
- **LOO test math**: With 70/30 bucket thresholds and max behavioral weight 0.35, the max achievable score from behavioral alone is 35+32.5=67.5 (always "average"). Test fixtures with viral predicted_score from mocked engine output don't align with signal-derived LOO scores. Resolved by designing self-consistent fixtures that use signal values achievable at the average-under boundary.

## Known Stubs

- `spearman_within_niche` is set to `0` for all niches in every BenchmarkReport. Documented as placeholder in both the source code comment and the plan's out-of-scope section. Plan G or Phase 10 adds the actual Spearman ρ computation if time permits.
- `drift_metrics` is an empty object `{}` in every BenchmarkReport. Populated when 2+ corpus_versions exist (Plan G or later). Plan comment explains this is Phase 1: empty.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. eval-harness calls service client with service-role auth (same pattern as existing engine code). Threat model from plan is fully mitigated:
- T-01-E-01 (cost runaway): CostCapExceededError enforced — cap fires after row cost added, one over-budget row tolerated within 33% buffer
- T-01-E-06 (wrong signal extraction): BLOCKER-6 LOO test catches behavioral=0 regression at test time

## Self-Check: PASSED

### Created files verified
- `src/lib/engine/corpus/eval-runner.ts` — FOUND
- `src/lib/engine/corpus/eval-harness.ts` — FOUND
- `src/lib/engine/corpus/baseline.ts` — FOUND
- `src/lib/engine/corpus/failure-cases.ts` — FOUND
- `src/lib/engine/corpus/cli/eval-args.ts` — FOUND
- `scripts/eval.ts` — FOUND
- All 4 test files — FOUND

### package.json script verified
- `"eval"` entry in package.json — FOUND

### Commits verified
- `fe9ed9f` (test Task 1) — FOUND
- `72a338c` (feat Task 1) — FOUND
- `509c48d` (test Task 2) — FOUND
- `cc5499f` (feat Task 2) — FOUND
- `a2c25f9` (test Task 3) — FOUND
- `4766ddc` (feat Task 3) — FOUND
- `eb8d965` (fix tsc) — FOUND

### Tests verified
- `npx vitest run src/lib/engine/corpus/` → 182 passed (18 test files)
- `npx tsc --noEmit` → zero errors in new eval* files
- `npx tsx scripts/eval.ts` (no args) → exits 1 with usage output

---
*Phase: 01-training-corpus-eval-foundation*
*Plan: 01-05*
*Completed: 2026-05-11*
