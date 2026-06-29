---
phase: 01-engine-pack-seam
plan: 06
subsystem: engine
tags: [pack-seam, harness-dispatch, PACK-01, eval-runner, learning-predict, identity-wrap, in-place-cut]

# Dependency graph
requires:
  - phase: 01-03
    provides: "SOCIALS_PACK + resolvePack(mode) — pack.run = runPredictionPipeline, pack.scoring.run = aggregateScores (identity wraps)"
  - phase: 01-04
    provides: "pack-seam-smoke.test.ts — the BLOCKING D-03 structural gate guarding the rewire against regression"
  - phase: 01-05
    provides: "Route pack-dispatch pattern (resolvePack inline + run/scoring.run) mirrored here for the two harness call sites"
provides:
  - "Both non-route call sites (corpus/eval-runner.ts, learning/predict.ts) reach orchestration + scoring ONLY via resolvePack(\"socials\").run + .scoring.run — direct aggregateScores import removed from both; ENGINE_VERSION import retained (PACK-01 closed across ALL 4 call sites)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Harness call sites dispatch via resolvePack(mode) — neither harness holds a direct scorer/pipeline import; the socials overall_score math is behind the seam (PACK-01)"
    - "Identity-wrap rewire: pack.run === runPredictionPipeline, pack.scoring.run === aggregateScores — behaviour unchanged; eval-runner's behavioralSource conditional preserved verbatim"
    - "Split import: aggregateScores removed, ENGINE_VERSION retained from the aggregator (both harnesses key cache/version off ENGINE_VERSION)"

key-files:
  created: []
  modified:
    - src/lib/engine/corpus/eval-runner.ts
    - src/lib/engine/learning/predict.ts

key-decisions:
  - "Pack resolved inline in each file (const pack = resolvePack(\"socials\")) — mirrors the route pattern (01-05); eval-runner hoists it above the batch loop (resolve once, not per-row), predict resolves it adjacent to the two-step call."
  - "Split the combined `aggregateScores, ENGINE_VERSION` import: dropped aggregateScores, kept ENGINE_VERSION (T-01-CP — both harnesses use it for cache/version keying). Also dropped the now-dead runPredictionPipeline import (reached via pack.run)."
  - "eval-runner behavioralSource conditional kept EXACTLY (opts.behavioralSource ? { behavioralSource } : undefined) — avoids passing `{ behavioralSource: undefined }`; byte-identical to prior behaviour."

requirements-completed: [PACK-01]

# Metrics
duration: 4min
completed: 2026-06-26
---

# Phase 01 Plan 06: Harness Pack-Dispatch Summary

**The two remaining non-route call sites now reach orchestration + scoring ONLY through `resolvePack("socials")` — `corpus/eval-runner.ts` and `learning/predict.ts` each dispatch via `pack.run(...)` + `pack.scoring.run(...)`, and the direct `aggregateScores`/`runPredictionPipeline` imports are gone (ENGINE_VERSION retained). Identity wraps: same functions, same args, eval-runner's behavioralSource conditional preserved verbatim — behaviour unchanged. PACK-01 is now closed across ALL 4 call sites (route JSON + route SSE + 2 harnesses) — Pitfall 1 (harnesses still importing the scorer directly) resolved.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2 (`src/lib/engine/corpus/eval-runner.ts`, `src/lib/engine/learning/predict.ts`)

## Accomplishments
- **eval-runner (call site #3):** added `const pack = resolvePack("socials");` above the batch loop (resolved once, not per-row); `runPredictionPipeline(input)` → `pack.run(input)`; `aggregateScores(pipelineResult, undefined, opts.behavioralSource ? {...} : undefined)` → `pack.scoring.run(...)` with the behavioralSource conditional preserved EXACTLY. Import line split: `aggregateScores` dropped, `ENGINE_VERSION` kept; dead `runPredictionPipeline` import removed; `resolvePack` imported from `@/lib/engine/packs`.
- **learning/predict (call site #4):** added `const pack = resolvePack("socials");` adjacent to the two-step; `runPredictionPipeline(input)` → `pack.run(input)`; `aggregateScores(pipelineResult)` → `pack.scoring.run(pipelineResult)`. Import line split: `aggregateScores` dropped, `ENGINE_VERSION` kept; dead `runPredictionPipeline` import removed; `resolvePack` imported relative (`../packs`). Doc-comment fn references (lines 5-12) left untouched.
- **Gates green:** `tsc --noEmit` clean for both files; full `src/lib/engine` suite green (95 files / 1170 passed | 20 skipped, ~12.6s) — incl. the D-03 pack-seam smoke + regression gate. No `^import` of `aggregateScores` remains in either harness; both retain `ENGINE_VERSION`; both expose `pack.scoring.run`.

## Task Commits

1. **Task 1 — dispatch eval-runner through the pack** - `f662ddd4` (refactor)
2. **Task 2 — dispatch learning/predict through the pack** - `a53588ce` (refactor)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP.

## Files Created/Modified
- `src/lib/engine/corpus/eval-runner.ts` - import line 5 split (`ENGINE_VERSION` only) + dead `runPredictionPipeline` import (line 4) removed, `resolvePack` import added; `const pack = resolvePack("socials")` hoisted above the batch loop; the two-call rewired to `pack.run` + `pack.scoring.run` with the behavioralSource conditional verbatim.
- `src/lib/engine/learning/predict.ts` - import line 15 split (`ENGINE_VERSION` only) + dead `runPredictionPipeline` import (line 14) removed, `resolvePack` import added; `const pack = resolvePack("socials")` + the two-step rewired to `pack.run` + `pack.scoring.run`.

## Decisions Made
- Pack resolved inline per-file (mirrors 01-05). eval-runner hoists the const above the loop so it resolves once per batch run, not per row — pure micro-clarity, no behaviour change. predict resolves it adjacent to the call.
- Combined `aggregateScores, ENGINE_VERSION` import split deliberately: `ENGINE_VERSION` is load-bearing (cache/version keying, T-01-CP) and stays; only `aggregateScores` (now reached via `pack.scoring.run`) is removed. Dead `runPredictionPipeline` import also dropped (reached via `pack.run`).
- behavioralSource conditional in eval-runner kept character-for-character — it avoids passing `{ behavioralSource: undefined }` into the scorer; identity behaviour (RESEARCH note).

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None. tsc clean for both files; full engine suite green on first run after the rewire.

## Known Stubs
None. Both harnesses bind the REAL pack (`pack.run` = `runPredictionPipeline`, `pack.scoring.run` = `aggregateScores`); no placeholder or mock data introduced.

## Threat Flags
None. No new trust boundary, endpoint, input, or schema — internal batch/learning harness indirection only. T-01-RR (refactor regression) mitigated by the full `src/lib/engine` suite + the D-03 smoke (both green); ENGINE_VERSION retained at 3.20.0 so cache keying is unchanged (T-01-CP).

## Self-Check: PASSED

- FOUND: src/lib/engine/corpus/eval-runner.ts (modified)
- FOUND: src/lib/engine/learning/predict.ts (modified)
- FOUND: no `^import` of aggregateScores in either harness; ENGINE_VERSION retained in both
- FOUND: pack.scoring.run present in both harnesses
- FOUND commit: f662ddd4 (Task 1)
- FOUND commit: a53588ce (Task 2)

---
*Phase: 01-engine-pack-seam*
*Completed: 2026-06-26*
