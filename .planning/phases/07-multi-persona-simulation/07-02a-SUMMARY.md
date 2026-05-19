---
phase: 07-multi-persona-simulation
plan: 02a
subsystem: engine
tags: [persona, types, pipeline, aggregator, pure-function, deepseek]

requires:
  - phase: 07-multi-persona-simulation/07-01
    provides: PersonaSimulationResult, PersonaBehavioralAggregate, ARCHETYPES, PersonaResponseSchema
provides:
  - PipelineResult.personaBehavioralAggregate field (default null)
  - PredictionResult.persona_behavioral_aggregate + persona_simulation_results (additive, D-20)
  - makePipelineResult factory default sets personaBehavioralAggregate: null
  - aggregatePersonaResults pure-math helper with top-3-enthusiast-weighted 60/40 split + ≥7-survivor threshold
  - TOP_N / TOP_WEIGHT_TOTAL / REMAINING_WEIGHT_TOTAL named constants for downstream reuse
affects: [07-02b-wave3-orchestrator, 07-03-aggregator-integration]

tech-stack:
  added: []
  patterns:
    - "Pure-function aggregator helpers in wave3/aggregator.ts — no I/O, no DeepSeek dependency, fully unit-testable"
    - "Additive PredictionResult field widening (D-20) — never replace, only add, so legacy consumers keep working"

key-files:
  created:
    - src/lib/engine/wave3/aggregator.ts
    - src/lib/engine/__tests__/wave3-aggregator.test.ts
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/pipeline.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/factories.ts

key-decisions:
  - "D-06 per-metric different aggregation: completion_pct is flat mean; share/comment/save are top-3-enthusiast-weighted (60/40)"
  - "D-13 threshold of ≥7 survivors enforced inside aggregatePersonaResults; below threshold returns aggregate=null + wave_3_below_threshold warning"
  - "Pitfall 4 defense: when remaining.length === 0 (n ≤ TOP_N), return topMean directly — never apply silent 0.60 shrinkage"
  - "Tie-break deterministic: stable sort by metric DESC then ARCHETYPES.indexOf ASC"
  - "Placeholder PredictionResult assignments in aggregator.ts (additive only) — full signal_availability.personas + behavioralSource integration deferred to Plan 07-03"

patterns-established:
  - "Pure-math wave3 helper: takes survivors array + threshold → returns { aggregate, warnings }; no side effects"
  - "Decile-bucketed percentileLabel (lightweight Phase 7 ship; Phase 10 may revise to corpus-driven percentile bands)"

requirements-completed: [PERSONA-08, PERSONA-09, PERSONA-11, PIPE-08]

duration: 65m (initial spawn 50m partial + recovery 15m)
completed: 2026-05-19
---

# Plan 07-02a Summary

**Type system widening + pure-math persona aggregator helper — foundation for Wave 3 orchestrator (07-02b) and aggregator integration (07-03).**

## Performance

- **Duration:** ~65 min (initial 50m partial-completion + 15m manual completion after two transport errors)
- **Tasks:** 2
- **Files modified:** 6 (4 modified, 2 created)
- **Tests:** 11 new (all pass); 0 regressions

## Accomplishments
- Widened `PipelineResult` + `PredictionResult` with persona aggregate fields (additive D-20)
- Added `makePipelineResult` factory default `personaBehavioralAggregate: null` so all 19 existing pipeline.test.ts + 30+ aggregator.test.ts callers compile without change
- Shipped `aggregatePersonaResults(survivors, threshold=7)` pure-math helper passing 11 D-06/D-13/Pitfall-4 unit tests
- Placeholder PredictionResult field assignments in `aggregator.ts` — types compile end-to-end without disturbing the existing `behavioral_predictions` consumer

## Task Commits

1. **Task 1: Widen PredictionResult + PipelineResult + factories** — `b40ea9c` (feat) — committed inside the executor worktree before transport error
2. **Task 2: aggregatePersonaResults pure-math helper + tests** — `6aaa4cf` (feat) — completed manually on main worktree after second ECONNRESET; files copied verbatim from agent worktree and committed atomically

**Merge commit:** `3db3ee5` (chore: merge executor worktree for Task 1)

## Files Created/Modified

- `src/lib/engine/types.ts` — Added `persona_behavioral_aggregate` + `persona_simulation_results` to PredictionResult (D-20 additive widening)
- `src/lib/engine/pipeline.ts` — Added `personaBehavioralAggregate: PersonaBehavioralAggregate | null` to PipelineResult; imports `PersonaBehavioralAggregate` from `./types`
- `src/lib/engine/__tests__/factories.ts` — `makePipelineResult` now defaults `personaBehavioralAggregate: null` (preserves 19 pipeline test callers + future 07-03 aggregator tests)
- `src/lib/engine/aggregator.ts` — Placeholder field assignments only — `persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate, persona_simulation_results: pipelineResult.wave3Result` — full integration in Plan 07-03
- `src/lib/engine/wave3/aggregator.ts` *(new, 109 LOC)* — Pure-math `aggregatePersonaResults` + `TOP_N` / `TOP_WEIGHT_TOTAL` / `REMAINING_WEIGHT_TOTAL` named exports
- `src/lib/engine/__tests__/wave3-aggregator.test.ts` *(new, 132 LOC, 11 tests)* — D-06 per-metric rule, D-13 threshold edges (n=7/n=6/n=0), Pitfall 4 defensive remaining=0 path, constants invariant

## Decisions Made

- **Decile-bucketed percentileLabel** for Phase 7 ship (top 10%/25%/50%/75%/bottom 25%). Phase 10 may revise to corpus-driven percentile bands when calibration data is richer.
- **Placeholder field assignments in aggregator.ts** rather than full signal_availability.personas wiring — keeps this plan tightly scoped (B-4 split rationale) and defers behavioral-source switching to Plan 07-03 where the test surface is more complete.
- **TOP_N exported alongside TOP_WEIGHT_TOTAL/REMAINING_WEIGHT_TOTAL** for downstream reuse (07-03 may surface them; Phase 10 may tune them based on corpus calibration).

## Deviations from Plan

None functional — plan executed as written.

**Process deviations:**
1. **Spawned executor died twice mid-execution** (529 Overloaded → ECONNRESET). The first death lost only narration (Task 1 was committed before the crash). The second crash left two files untracked in the agent worktree (`wave3/aggregator.ts` + `wave3-aggregator.test.ts`).
2. **Manual recovery:** Orchestrator merged the executor's committed Task 1 (commit `b40ea9c`) via `--no-ff` merge (`3db3ee5`), then copied the two untracked files verbatim from the agent worktree, ran the 11 unit tests (all pass), and committed atomically (`6aaa4cf`). SUMMARY.md committed in this same recovery step.
3. **No SUMMARY.md commit was made by the executor** — orchestrator wrote and committed it directly on main as part of the recovery.

## Issues Encountered

- **Two transport-layer failures** (Anthropic API 529 Overloaded, then ECONNRESET) during executor spawn. Both happened deep inside the executor's session (54+ tool uses on the second attempt) and prevented the executor from reaching its SUMMARY.md commit. The committed work was preserved; only the executor's narration was lost. Manual completion took ~15 min and verified all 11 unit tests pass.

## Next Phase Readiness

Plan 07-02b (Wave 3) can now consume:
- `PipelineResult.personaBehavioralAggregate` field (currently null in all production paths)
- `aggregatePersonaResults` helper for the Wave 3 orchestrator's post-Promise.allSettled aggregation step
- `makePipelineResult` factory's null default for any test stub it needs
- `ARCHETYPES`-ordered tie-breaks (deterministic across runs)

Zero changes to `wave3.ts`, `wave0.ts`, `deepseek.ts`, `taxonomy.ts`, or route handlers — surface area is exactly as scoped.

---
*Phase: 07-multi-persona-simulation*
*Plan: 02a*
*Completed: 2026-05-19*
