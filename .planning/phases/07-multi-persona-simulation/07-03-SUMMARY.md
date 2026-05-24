---
phase: "07"
plan: "03"
subsystem: engine.aggregator
tags:
  - persona
  - aggregator
  - signal-availability
  - behavioral-source
  - ab-eval
  - additive-only
  - phase-7

requires:
  - phase: 07-multi-persona-simulation/07-01
    provides: SignalAvailability.personas optional key, PersonaBehavioralAggregate, PersonaSimulationResult
  - phase: 07-multi-persona-simulation/07-02a
    provides: PipelineResult.personaBehavioralAggregate, PredictionResult.persona_behavioral_aggregate, makePipelineResult factory default
  - phase: 07-multi-persona-simulation/07-02b
    provides: real personaBehavioralAggregate surfaced from runWave3 Wave3Outcome
provides:
  - AggregateScoresOptions interface (optional behavioralSource: "deepseek" | "personas")
  - aggregateScores third-arg widening (back-compat — undefined preserves production behavior)
  - signal_availability.personas wired from pipelineResult.personaBehavioralAggregate !== null
  - FALLBACK_BEHAVIORAL constant + branching behavioral_predictions resolution
  - 8 new aggregator.test.ts tests covering D-08 / D-14 / D-15 / Pitfall 10 / PERSONA-11 / D-09 / D-20
affects: [07-04-eval-harness-ab, 10-ml-audit-calibration]

tech-stack:
  added: []
  patterns:
    - "Additive third-argument options pattern on aggregateScores (preserves all 4 production callers byte-for-byte)"
    - "Provenance-flag-only widening of SignalAvailability (does NOT participate in selectWeights math per SCORE_WEIGHT_KEYS filter)"
    - "Branching behavioral_predictions source via guarded ternary (behavioralSource === \"personas\" AND aggregate non-null → persona; else deepseek fallback)"

key-files:
  created: []
  modified:
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/aggregator.test.ts

key-decisions:
  - "D-08 honored — production callers (route.ts × 2, eval-runner.ts, scripts/benchmark.ts) pass no third arg; aggregateScores default behavior is byte-identical to pre-Phase-7 (assert via Test 6: explicit \"deepseek\" deep-equals default)"
  - "D-14 substrate landed — Plan 07-04's A/B run calls aggregateScores(pipelineResult, undefined, { behavioralSource: \"personas\" }) and gets persona aggregate substituted at the behavioral_predictions slot"
  - "D-15 personas flag wired on availability block immediately after content_type/niche keys (Phase 4 D-20 pattern mirrored)"
  - "FALLBACK_BEHAVIORAL kept as a local const (not exported) — N/A percentile shape only fires when BOTH deepseek AND persona aggregate are null/missing; matches pre-Phase-7 inline literal"
  - "Pitfall 10 guarded by Test 6 — explicit behavioralSource=\"deepseek\" produces deep-equal behavioral_predictions to default omitted call; prevents silent regression where production accidentally picks up a hardcoded \"personas\" default"
  - "SCORE_WEIGHTS + SCORE_WEIGHT_KEYS + selectWeights body untouched per PATTERNS Critical Cross-File Constraint #3 — personas key is provenance-only, filtered out of weight math"
  - "Stage 10 + Stage 11 hooks downstream of behavioral_predictions assembly remain unchanged — no impact on critique/counterfactual surface"

patterns-established:
  - "Optional third-arg AggregateScoresOptions on aggregateScores — additive surface for eval/A-B harness tooling that production never touches"
  - "Personas provenance flag set at the same aggregator step where content_type/niche flags are set (Phase 4 D-20 pattern carried forward verbatim)"

requirements-completed: [PERSONA-07, PERSONA-10, PERSONA-11]

duration: 4m
completed: 2026-05-19
---

# Plan 07-03 Summary

Additive widening of `aggregateScores` in `src/lib/engine/aggregator.ts` for Phase 7's A/B eval substrate (D-14). Two surfaces added:

1. **Optional `behavioralSource: "deepseek" | "personas"`** on the third arg. Default `"deepseek"` preserves byte-identical production behavior (D-08 milestone-wide additive-only constraint). Plan 07-04's eval harness opts in to the persona substrate by passing `{ behavioralSource: "personas" }`.
2. **`signal_availability.personas` flag** set from `pipelineResult.personaBehavioralAggregate !== null`. Mirrors the Phase 4 D-20 pattern for `content_type` and `niche` provenance keys — purely provenance, does NOT participate in `selectWeights` math (filtered out by `SCORE_WEIGHT_KEYS`).

The Plan 07-02a placeholder field assignments on `PredictionResult` (`persona_behavioral_aggregate`, `persona_simulation_results`) are now load-bearing — they receive real (non-default) values from Wave 3 in production.

## Performance

- **Duration:** ~4 min single-shot execution (no transport errors, single-task plan)
- **Tasks:** 1
- **Files modified:** 2
- **Files created:** 0
- **Tests:** 8 new (all pass), 0 regressions across 826-test suite

## Accomplishments

- Added `AggregateScoresOptions` interface (5 LOC) above `aggregateScores`
- Widened `aggregateScores` signature with optional `options?: AggregateScoresOptions` third arg
- Inserted `personas: pipelineResult.personaBehavioralAggregate !== null` into the `availability` SignalAvailability block (4 lines incl. JSDoc trail)
- Replaced inline `behavioral_predictions` initializer with `FALLBACK_BEHAVIORAL` constant + branching ternary keyed on `behavioralSource` and persona-aggregate null-check (14 LOC)
- Added 8 new tests in a `describe("aggregateScores Phase 7 widening", ...)` block at the end of `aggregator.test.ts`

## Task Commits

1. **Task 1: Widen aggregateScores with behavioralSource + personas signal_availability + 8 tests** — `b6d281e` (feat) — single atomic commit, +154 / −2 LOC across the 2 files

## Files Created/Modified

- `src/lib/engine/aggregator.ts` — Added `AggregateScoresOptions` interface; widened `aggregateScores` signature; inserted `personas` provenance flag into `availability` object; refactored `behavioral_predictions` initialization to branch on `options?.behavioralSource ?? "deepseek"` with `FALLBACK_BEHAVIORAL` fallback for the dual-null case
- `src/lib/engine/__tests__/aggregator.test.ts` — Added type-only imports `PersonaBehavioralAggregate`, `PersonaSimulationResult`; appended new `describe("aggregateScores Phase 7 widening", ...)` block with 8 unit tests

## Behavioral Source Resolution Truth Table

This is the load-bearing contract the Plan 07-04 eval harness will rely on:

| `options?.behavioralSource` | `pipelineResult.personaBehavioralAggregate` | `deepseek.behavioral_predictions` | Resolved `behavioral_predictions` source |
|---|---|---|---|
| `undefined` (production default) | any (null or non-null) | non-null | `deepseek.behavioral_predictions` |
| `undefined` (production default) | any | `null` (deepseek failed) | `FALLBACK_BEHAVIORAL` (all-zero, N/A percentiles) |
| `"deepseek"` (explicit, identical to default) | any | non-null | `deepseek.behavioral_predictions` |
| `"deepseek"` (explicit) | any | `null` | `FALLBACK_BEHAVIORAL` |
| `"personas"` (Plan 07-04 A/B) | **non-null** | any | `pipelineResult.personaBehavioralAggregate` ← **substitution** |
| `"personas"` (Plan 07-04 A/B) | `null` | non-null | `deepseek.behavioral_predictions` ← **graceful fallback** |
| `"personas"` (Plan 07-04 A/B) | `null` | `null` | `FALLBACK_BEHAVIORAL` |

The Plan 07-04 eval harness substitution can only swap when the persona aggregate cleared the D-13 ≥7-of-10 threshold; below threshold, the substituted run inherits the same `deepseek` baseline as the default run — by design, since the persona substrate isn't trustworthy at that point.

## signal_availability.personas Truth Table

| `pipelineResult.personaBehavioralAggregate` | `result.signal_availability.personas` |
|---|---|
| `null` (D-13 threshold not met OR circuit-breaker fast-fail OR Wave 3 fully degraded) | `false` |
| non-null `PersonaBehavioralAggregate` object | `true` |

Persisted to `analysis_results.signal_availability` JSONB column unchanged from Phase 4's mechanism. Does NOT participate in `selectWeights` math (filtered out by `SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends"]`).

## Decisions Made

### Plan-driven decisions (honored as written)

- **D-08 additive-only**: `aggregateScores(pipelineResult)` (no third arg) reads `deepseek.behavioral_predictions` exactly as before Phase 7. Asserted by Test 1 (default path equals deepseek source) AND Test 6 (explicit `"deepseek"` source deep-equals default behavior).
- **D-14 substrate**: `aggregateScores(pipelineResult, undefined, { behavioralSource: "personas" })` substitutes `pipelineResult.personaBehavioralAggregate` at the `behavioral_predictions` slot when the aggregate is non-null. Plan 07-04's lightweight A/B eval calls this signature on every corpus row.
- **D-15 personas key**: Set on `availability` block at the same step as `content_type` and `niche` keys (Phase 4 D-20 pattern carried forward). The key was already added to `SignalAvailability` as optional in Plan 07-01 (per Plan 07-01 deviation); this plan does NOT promote it to required — leaving optional preserves the ability for legacy fixtures that omit the key to compile, and Plan 07-04 / Phase 10 callers always go through `aggregateScores` which now sets it unconditionally.
- **PATTERNS Critical Cross-File Constraint #3**: `SCORE_WEIGHT_KEYS` and `SCORE_WEIGHTS` are unchanged — `personas` is a provenance flag only, filtered out of `selectWeights` math.
- **Graceful fallback for null persona aggregate** (D-14 + D-13 interaction): When `behavioralSource = "personas"` but `personaBehavioralAggregate === null`, fall back to `deepseek.behavioral_predictions` rather than `FALLBACK_BEHAVIORAL`. This preserves the v2 baseline signal for rows where Wave 3 below-threshold-failed, so the A/B comparison only ever reflects the **substituted** subset, not a doubly-degraded outcome.

### Cross-cutting decisions

- **Plan 07-02a placeholder lines unchanged**: The `persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null, persona_simulation_results: pipelineResult.wave3Result` block on the `PredictionResult` assembly is preserved verbatim from Plan 07-02a. They are correct for D-09 + D-20; this plan widens the surrounding logic so they now receive real data.
- **No CLI flag added to eval-runner.ts**: Out of scope — Plan 07-04 owns the eval-harness integration. This plan only delivers the aggregator-level substrate.
- **No changes to route.ts or scripts/benchmark.ts**: All 4 production callers of `aggregateScores` (`route.ts:298`, `route.ts:387`, `eval-runner.ts:104`, `scripts/benchmark.ts ~line 25`) pass no third arg → all get default `"deepseek"` behavior → zero behavior change.

## Deviations from Plan

None — plan executed verbatim. 1 task, 1 commit, 8 new tests, 0 regressions, 0 scope-creep edits.

## Plan 07-04 Hand-off

Plan 07-04 (lightweight A/B eval harness) will:

1. Extend `src/lib/engine/corpus/eval-runner.ts` (or a sibling) to run TWO `aggregateScores` calls per pipeline result: one default (`"deepseek"` baseline) and one substituted (`"personas"` candidate).
2. Persist both result rows to `benchmark_results` with distinct `engine_version` tags (e.g., `3.0.0-dev-personasA` / `3.0.0-dev-personasB`).
3. Optionally add a CLI flag (e.g., `--behavioral-source personas`) to the eval entrypoint script.
4. Compare `macro_f1`, `ECE`, `viral_recall`, `under_precision` between the two runs and emit a `.planning/research/persona-aggregate-ab-2026-05-XX.md` comparison report.

Callable contract Plan 07-04 inherits from this plan:

```typescript
// Default — production read (unchanged)
const baselineResult = await aggregateScores(pipelineResult);

// Substituted — A/B candidate
const candidateResult = await aggregateScores(pipelineResult, undefined, {
  behavioralSource: "personas",
});
```

When `pipelineResult.personaBehavioralAggregate === null` (D-13 below threshold OR Wave 3 fully degraded), `candidateResult.behavioral_predictions === baselineResult.behavioral_predictions` — same source, same numbers. The A/B comparison is meaningful only on the subset of rows where Wave 3 met the threshold.

## Production Caller Confirmation (Zero-Change Verification)

| Caller | File:Line | 3rd arg passed? | Result |
|---|---|---|---|
| Route handler (analyze) | `src/app/api/analyze/route.ts:~298` | NO | Default `"deepseek"` → byte-identical to pre-Phase-7 |
| Route handler (SSE branch) | `src/app/api/analyze/route.ts:~387` | NO (passes `onStageEvent` only) | Default `"deepseek"` → byte-identical to pre-Phase-7 |
| Eval runner | `src/lib/engine/corpus/eval-runner.ts:~104` | NO | Default `"deepseek"` → byte-identical to pre-Phase-7 (Plan 07-04 will branch on a CLI flag) |
| Benchmark script | `scripts/benchmark.ts:~25` | NO | Default `"deepseek"` → byte-identical to pre-Phase-7 |

Production behavior unchanged for all callers. Phase 10 owns the eventual production swap based on Plan 07-04's A/B evidence.

## Verification Results

```bash
$ pnpm test -- run src/lib/engine/__tests__/aggregator.test.ts --reporter=verbose
Test Files  60 passed | 2 skipped (62)
Tests       826 passed | 4 skipped (830)

$ grep -c "options?: AggregateScoresOptions," src/lib/engine/aggregator.ts
1
$ grep -c "export interface AggregateScoresOptions {" src/lib/engine/aggregator.ts
1
$ grep -c "personas: pipelineResult.personaBehavioralAggregate !== null," src/lib/engine/aggregator.ts
1
$ grep -c 'behavioralSource === "personas" && pipelineResult.personaBehavioralAggregate !== null' src/lib/engine/aggregator.ts
1
$ grep -c "const FALLBACK_BEHAVIORAL = {" src/lib/engine/aggregator.ts
1
$ grep -c 'SCORE_WEIGHT_KEYS = \["behavioral", "gemini", "ml", "rules", "trends"\] as const' src/lib/engine/aggregator.ts
1
$ grep -c "behavioral: 0.35," src/lib/engine/aggregator.ts
1
$ grep -c 'describe("aggregateScores Phase 7 widening"' src/lib/engine/__tests__/aggregator.test.ts
1
$ awk '/describe\("aggregateScores Phase 7 widening"/,/^}\);$/' src/lib/engine/__tests__/aggregator.test.ts | grep -c "  it("
8

$ git diff --name-only
src/lib/engine/__tests__/aggregator.test.ts
src/lib/engine/aggregator.ts

$ git diff src/lib/engine/wave3.ts src/lib/engine/pipeline.ts src/lib/engine/types.ts
(empty — scope guard honored: those files unchanged from Plan 07-02b final state)
```

Pre-existing TypeScript errors in `src/app/api/profile/*.ts`, `src/lib/engine/__tests__/video-e2e.test.ts`, and `src/lib/engine/pipeline.ts` (DEFAULT_CREATOR_CONTEXT missing fields) are unrelated to Plan 07-03 — `pnpm tsc --noEmit` reports zero new errors in either `src/lib/engine/aggregator.ts` or `src/lib/engine/__tests__/aggregator.test.ts`.

Total test surface: 826 → was 818 before this plan + 8 new = 826 ✓.

## Self-Check: PASSED

- `src/lib/engine/aggregator.ts` (modified): FOUND
- `src/lib/engine/__tests__/aggregator.test.ts` (modified): FOUND
- Commit `b6d281e` (Task 1: aggregator Phase 7 widening + tests): FOUND
- 8 new tests in `describe("aggregateScores Phase 7 widening", ...)` all pass
- 826 / 826 active tests pass; 0 regressions across pipeline + aggregator + Wave 0/3 suites
- `git diff src/lib/engine/wave3.ts src/lib/engine/pipeline.ts src/lib/engine/types.ts` empty (scope guard honored)
- 9 / 9 acceptance criteria grep-counts match exactly
- Production callers (route.ts × 2, eval-runner.ts, scripts/benchmark.ts) require ZERO changes — confirmed by `grep -n "aggregateScores(" src/app/api/analyze/route.ts src/lib/engine/corpus/eval-runner.ts scripts/benchmark.ts` showing no third-arg invocations
