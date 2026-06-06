---
phase: 04-audience-sim-fold-brain-2-the-bet
plan: "04"
subsystem: scripts/referee
tags: [referee, composite, a-b-test, fold, audience-sim, r7, r10, d03]
dependency_graph:
  requires:
    - 04-03 (aggregator "fold" branch + pipeline foldOutcome)
  provides:
    - ab-fold-referee.ts complete (3-metric composite, R7 call-count, per-video table, advisory verdict)
  affects:
    - Plan 05 (real-API run + production-flip decision — the referee is now runnable)
tech_stack:
  added: []
  patterns:
    - makeEventCounter() stage-event-based R7 call-count assertion (wave_3_fold=1 vs wave_3_persona_*+wave_3_pass2_persona_*=20)
    - computeAvgCurveRange() VERBATIM measure-pipeline.ts:146-160 formula (Math.max-Math.min per persona, mean)
    - swipeSegmentIndex() t-value→segment-index conversion with fallback to min-attention index
    - avgMetrics() R8 band averaging (2 runs per path, swipeSegments from run1)
    - computeComposite() 3-metric gate (parity<=5, diversity>=0.8x, drop>=6/10)
    - Advisory advisory verdict (REPRODUCE/BEAT/PARTIAL/MISS) — no exit-1 on metric miss (D-05)
    - useFold:true cast to PipelineOptions (duck-typed by pipeline.ts:880 — no type change needed)
key_files:
  created: []
  modified:
    - scripts/ab-fold-referee.ts
decisions:
  - "Both aggregateScores paths (personas + fold) share ONE pipeline call per run with useFold:true — keeps R7 call-count honest (fold LLM call happens once per pipeline, not per aggregateScores call)"
  - "swipeSegments uses run1 values as representative for drop-point comparison — segment ordering is stable across runs; averaging segment indices would be lossy"
  - "wave_3_persona_* + wave_3_pass2_persona_* stage_end regex pattern counts the 20 individual persona calls (10 Pass1 + 10 Pass2) — matches the actual stage names in wave3.ts + pass2.ts"
  - "diversityRatio = Infinity when tenpass avgCurveRange=0 and fold>0 — treated as diversity >= 0.8 (pass), not a division-by-zero abort"
  - "behavioral_score extracted via (result as unknown as {behavioral_score?: number}) cast — behavioral_score is on PredictionResult in types.ts:275 but not on the exported interface shape used by aggregateScores return type"
metrics:
  duration: "~25 min"
  completed: "2026-06-05"
  tasks_completed: 1
  files_created: 0
  files_modified: 1
---

# Phase 4 Plan 4: A/B Referee 3-Metric Composite Summary

**One-liner:** Complete ab-fold-referee.ts with D-03 3-metric composite (behavioral parity ±5, diversity >=0.8x, drop-point agreement >=6/10) over variable-length VIDEO_SET × both paths × 2 runs, R7 call-count assertion (fold=1 vs tenpass=20), per-video table, and advisory overall verdict.

## What Was Built

**Task 1 — 3-metric composite + R7 assertion (ab-fold-referee.ts)**

Replaced the `// TODO Plan 04` stub block with complete composite logic:

**Infrastructure:**
- `makeEventCounter()`: captures stage events from pipeline execution; `getFoldCalls()` counts `wave_3_fold` stage_ends; `getTenpassCalls()` counts `wave_3_persona_*` + `wave_3_pass2_persona_*` stage_ends. Both paths share one pipeline call per run (useFold:true) so fold LLM call is counted exactly once per run.

**Metric functions:**
- `computeAvgCurveRange(heatmap)`: VERBATIM measure-pipeline.ts:146-160 formula. Per persona: `range = Math.max(...att) - Math.min(...att)`. Mean over all personas.
- `swipeSegmentIndex(heatmap, personaIdx)`: converts `swipe_predicted_at` (t value) to segment index by finding the segment whose `[t_start, t_end)` window contains t. Fallback: segment with minimum attention when `swipe_predicted_at` is null.
- `extractMetrics(result)`: pulls `behavioral_score`, `avgCurveRange`, per-archetype `swipeSegments`, `cost_cents`, `overall_score` from a `PredictionResult`.

**R8 band averaging:**
- `avgMetrics(run1, run2)`: averages `behavioral_score` and `avgCurveRange` over 2 runs; accumulates `cost_cents`; uses run1 `swipeSegments` as representative (segment ordering is stable across runs).

**Composite gate:**
- `computeComposite(...)`:
  - Metric 1 (parity): `|fold.behavioral_score - tenpass.behavioral_score| <= 5`
  - Metric 2 (diversity): `fold.avgCurveRange / tenpass.avgCurveRange >= 0.8` (also `>= 1.0` for "beat" flag)
  - Metric 3 (drop agreement): count archetypes where `|foldSeg - tenpasSSeg| <= 1`; pass if `>= 6`
  - R7: `foldCalls === 1 && tenpassCalls === 20`
  - Verdict: "beat" if all 3 + diversity beat; "reproduce" if all 3; "miss" otherwise.

**Per-video table:** prints parity Δ, OK flag, diversity ratio, OK flag, drop agreement n/10, OK flag, R7 status, verdict — plus fold vs tenpass behavioral score, avgRange, call counts.

**Advisory overall verdict (D-05):** prints video count, reproduce/beat totals, per-metric summary, R7 aggregate, total cost. No `process.exit(1)` on metric miss. `process.exit(1)` reserved for infra failures in `main().catch()` only (matching measure-pipeline.ts:175-178).

**Cost cap:** `COST_CAP_CENTS` (default 2000c, env-overridable) checked after each path's `aggregateScores` call; throws on exceed (infra-level abort, not metric miss).

**Commit:** `aa3a8428`

## Deviations from Plan

None — plan executed exactly as written.

The `useFold:true` flag passes via a `Parameters<typeof runPredictionPipeline>[1]` cast. Pipeline.ts:880 duck-types it as `(opts as {useFold?:boolean})?.useFold` — no PipelineOptions type change needed. This is consistent with the Plan 03 duck-typing pattern for the ENGINE_USE_FOLD guard.

## Verification Results

**tsc --noEmit:** Zero errors in `scripts/ab-fold-referee.ts`. Pre-existing test scaffold errors (12 in fold-adapter.test.ts / fold-diversity-guard.test.ts / fold-schema.test.ts) are unchanged from Plan 03 state — all in Wave 0 scaffolds with unresolved module imports intentional at this stage.

**Acceptance criteria:**

- [x] `npx tsc --noEmit` — no errors in ab-fold-referee.ts
- [x] Composite metrics present: `grep -E -c "behavioral parity|avgCurveRange|0\.8|wave_3_fold"` = 23
- [x] Parity `<= 5` present: `grep -c "<= 5"` = 3
- [x] Diversity `0.8` present: `grep -c "0\.8"` = 4
- [x] Drop `>= 6` present: `grep -c ">= 6"` = 4
- [x] `Math.max` + `Math.min` in avgCurveRange formula: `grep -c "Math\.max\|Math\.min"` = 3
- [x] `wave_3_fold` assertion present: `grep -c "wave_3_fold"` = 3
- [x] No corpus harness import: `grep "corpus/eval"` = 1 (header comment only, no import)
- [x] Advisory exit semantics: `process.exit(1)` only in `main().catch()` (infra failure path)
- [x] 2-runs-per-video loop (R8 band): `for (let run = 1; run <= 2; run++)` present
- [x] `avgMetrics()` averages behavioral_score + avgCurveRange across 2 runs
- [x] Variable-length VIDEO_SET: no hardcoded `6` in composite logic; all counts use `verdicts.length` / `VIDEO_SET.length`

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Script is a standalone measurement tool; it calls the existing pipeline + aggregator stack.

Threat mitigations verified present:
- T-04-COST: `COST_CAP_CENTS` + `totalCostCents` accumulator checked after each `aggregateScores` call; `console.warn` + throw on exceed
- T-04-07: Advisory verdict only — no `process.exit(1)` on metric miss; D-05 note printed in output

## Known Stubs

None — composite logic is fully implemented. The referee is ready to run against the real API (Plan 05).

The VIDEO_SET remains at 2 of 6 (user decision 2026-06-05 from Plan 01). The other 4 D-04 slots are documented in the VIDEO_SET comment and must be added before the Plan 05 real-API run for full D-04 coverage.

## Self-Check: PASSED

- `scripts/ab-fold-referee.ts` — EXISTS (modified)
- Commit `aa3a8428` — VERIFIED in git log
