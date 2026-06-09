---
phase: 04-audience-sim-fold-brain-2-the-bet
plan: "01"
subsystem: engine/wave3/fold
tags: [scaffold, tdd, wave0, referee, fold, audience-sim]
dependency_graph:
  requires: []
  provides:
    - fold-schema.test.ts (Nyquist gate for Plan 02 FoldResponseSchema)
    - fold-adapter.test.ts (Nyquist gate for Plan 02/03 adaptFold* functions)
    - fold-diversity-guard.test.ts (Nyquist gate for Plan 02/03 computeAvgCurveRange)
    - ab-fold-referee.ts (real-API A/B skeleton for Plan 04 composite)
  affects:
    - scripts/ab-fold-referee.ts (VIDEO_SET confirmed; referee runnable after Plan 03)
tech_stack:
  added: []
  patterns:
    - vitest describe/it scaffolds (unresolved imports intentional — Wave 0)
    - dotenv + tsconfig-paths bootstrap (copied from measure-pipeline.ts)
    - COST_CAP_CENTS + totalCostCents accumulator (T-04-COST mitigation)
key_files:
  created:
    - src/lib/engine/wave3/__tests__/fold-schema.test.ts
    - src/lib/engine/wave3/__tests__/fold-adapter.test.ts
    - src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts
    - scripts/ab-fold-referee.ts
  modified: []
decisions:
  - "REDUCED referee VIDEO_SET (2 of 6) — user decision 2026-06-05; D-03 composite degrades gracefully per-video; deferred 4 D-04 slots to be added before Plan 04 referee run"
  - "VIDEO_SET includes .mov file (IMG_0012); upload generalized to detect ext + set correct contentType (video/quicktime for .mov); no transcoding"
  - "eval-harness.ts NOT revived — RESEARCH Pitfall 2 evidence; fresh referee built on measure-pipeline.ts scaffold instead"
metrics:
  duration: "~25 min"
  completed: "2026-06-05"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 4 Plan 1: Wave 0 Fold Scaffolds + Referee Skeleton Summary

**One-liner:** Wave 0 Nyquist scaffolds for FoldResponseSchema / adaptFold* / diversity-guard, plus ab-fold-referee.ts skeleton with confirmed reduced VIDEO_SET (2 of 6), cost cap, and both-paths × 2-runs loop shell.

## What Was Built

**Task 1 — Three vitest unit test scaffolds**

- `fold-schema.test.ts`: 5 cases for `FoldResponseSchema` — valid 10-archetype output, attention outside [0,1], fewer than 10 archetypes (D-01 `.length(10)` guard), out-of-range segment reaction value, optional reason ≤/> 200 chars.
- `fold-adapter.test.ts`: 3 lossless-mapping cases (D-11/D-12) — `adaptFoldToPersonaSimResults` → `aggregatePersonaResults` accepts; `adaptFoldToPass2Results` → `buildWeightedCurve` accepts; `niche_deep`→`niche` slot_type normalization (Pitfall 5 assertion present).
- `fold-diversity-guard.test.ts`: 3 cases — varied curves return positive avgRange; flat curves warn but don't throw; formula-parity assertion vs measure-pipeline.ts:146-160 (per-persona max−min, mean over all 10).

All 3 suites fail exclusively on `Cannot find module '../fold-prompts'` / `Cannot find module '../fold'` — the Plan 02/03 modules that don't exist yet. This is the correct Wave 0 state.

**Task 2 — ab-fold-referee.ts skeleton**

- Bootstrap header copied verbatim from measure-pipeline.ts:14-21 (dotenv + tsconfig-paths).
- Env guard copied from measure-pipeline.ts:37-40.
- `COST_CAP_CENTS` (default 2000, env-overridable) + running `totalCostCents` accumulator with `console.warn` on exceed (T-04-COST mitigation).
- `runPath()` helper calls `aggregateScores` with `behavioralSource: "personas" | "fold"`; `@ts-expect-error` on the `"fold"` site (Plan 03 removes it).
- Per-video loop: upload → `runPredictionPipeline(bypassCache:true)` → both paths × 2 runs → cleanup.
- Composite verdict is a marked `// TODO Plan 04` block.
- Eval-harness deviation note in file header.

**Task 3 — VIDEO_SET confirmed (reduced set)**

- Replaced 6 placeholder paths with 2 confirmed on-disk files.
- Generalized storage path ext + `contentType` to accept `.mov` (no transcoding).
- Placeholder guard updated.

## Deviations from Plan

### User Decision

**[Reduced Referee Set] VIDEO_SET populated with 2 of 6 videos (user decision, Task 3 checkpoint)**

- **Found during:** Task 3 checkpoint resolution
- **Decision:** User provided 2 confirmed files rather than 6. Proceeding with reduced set per D-03 graceful degradation — drop-point agreement is per-video, composite still runs.
- **Files in VIDEO_SET:**
  - `gwxLeHphZCxK` → `/Users/davideloreti/Downloads/TikTok Video Downloader.mp4` (good rating, P2 determinism baseline)
  - `IMG_0012` → `/Users/davideloreti/Downloads/IMG_0012.mov` (bad rating, weak hook / low quality)
- **Deferred:** 4 D-04 slots (hook-strength × niche spread) — add before running Plan 04 referee against real API.
- **Impact on Plan 04:** Composite verdict will be based on 2 videos instead of 6. The D-03 confidence interval is narrower. The Plan 04 executor should note this and optionally prompt for remaining videos before declaring a production flip decision.

### Auto-fix (Rule 2)

**[Rule 2 - Missing] .mov content-type support**

- **Found during:** Task 3
- **Issue:** Skeleton hardcoded `"video/mp4"` contentType and `.mp4` storage path extension; second confirmed video is a `.mov` file.
- **Fix:** Detect extension from `video.path`; set `contentType` to `"video/quicktime"` for `.mov`, `"video/mp4"` otherwise; use actual ext in `storagePath`. No transcoding.
- **Files modified:** `scripts/ab-fold-referee.ts`
- **Commit:** `2c7ff659`

## Verification Results

**vitest (fold scaffolds):**
- 3 suites: 0 passed, 3 failed
- All failures: `Cannot find module '../fold'` or `'../fold-prompts'` — correct (Plan 02/03 modules not yet created)
- No syntax or structure errors in the test files

**tsc --noEmit:**
- `ab-fold-referee.ts`: ZERO errors (only the intentional `@ts-expect-error` for the fold-union pending Plan 03)
- Test scaffolds: errors only on the unresolved `../fold` / `../fold-prompts` modules — expected Wave 0 state

## Acceptance Criteria Checklist

- [x] Three vitest scaffolds exist under `src/lib/engine/wave3/__tests__/`
- [x] `fold-schema.test.ts` contains 5 named cases; imports `FoldResponseSchema` from `../fold-prompts`
- [x] `fold-adapter.test.ts` contains 3 lossless-mapping cases; `niche_deep` assertion present (`grep -c "niche_deep" ≥ 1`)
- [x] `fold-diversity-guard.test.ts` contains 3 cases incl. formula-parity assertion
- [x] No fixtures invent fields outside the FoldArchetype contract
- [x] `scripts/ab-fold-referee.ts` exists; bootstraps via dotenv + tsconfig-paths
- [x] `VIDEO_SET` present (2 confirmed entries); `COST_CAP_CENTS` present
- [x] Eval-harness deviation note present (`grep -c "NOT corpus/eval-harness" ≥ 1`)
- [x] `aggregateScores` called with both `"personas"` and `"fold"` per video
- [x] No active `corpus/eval` import (only in header comment)
- [x] Composite is a marked `// TODO Plan 04` block

## Known Stubs

- `VIDEO_SET` is a reduced set of 2 (of intended 6). The other 4 D-04 slots are intentionally deferred and recorded in-code. Plan 04 executor must be aware — the A/B verdict will cover only 2 videos until the set is expanded.
- Composite computation in `ab-fold-referee.ts` is a `// TODO Plan 04` stub — no metric math yet (intentional; Plan 04 owns the 3-metric composite logic).

## Self-Check: PASSED

- `src/lib/engine/wave3/__tests__/fold-schema.test.ts` — EXISTS
- `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` — EXISTS
- `src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` — EXISTS
- `scripts/ab-fold-referee.ts` — EXISTS
- Commits: `dc139bcf` (Task 1), `c934b206` (Task 2), `2c7ff659` (Task 3) — all verified in `git log`
