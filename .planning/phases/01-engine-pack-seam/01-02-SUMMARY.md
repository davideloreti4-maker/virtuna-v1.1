---
phase: 01-engine-pack-seam
plan: 02
subsystem: engine
tags: [domain-pack, typescript, type-contract, pack-seam, aggregateScores, pure-types]

# Dependency graph
requires:
  - phase: 01-01
    provides: restored node_modules (vitest 4.1.9, tsc), green pre-seam engine baseline, ENGINE_VERSION pinned 3.20.0
provides:
  - "DomainPack 7-field type contract (src/lib/engine/domain-pack.ts) — id/run + populations/grounding/stimulusTypes/reactionFrame/scoring/outputSchema/calibration"
  - "DomainPackScoring seam type mirroring aggregateScores verbatim (the Plan-03 wrap target)"
  - "Compile-time contract probe proving aggregateScores is assignable to scoring.run"
affects: [01-03 (SOCIALS_PACK populates this contract), 01-06 (Predict pack mounts same contract), pack-seam dispatch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed-object-not-class contract: plain export interface + export type, no class/DI container (D-08)"
    - "import type only for cross-module refs — zero runtime coupling in a pure-types module"
    - "typeof of real functions in type position to prove the pack references the real ones (anti under-typing)"

key-files:
  created:
    - src/lib/engine/domain-pack.ts
    - src/lib/engine/__tests__/domain-pack.contract.test.ts
  modified: []

key-decisions:
  - "Landed the contract in a sibling domain-pack.ts (not types.ts) — types.ts is already 1047 lines; keeps the contract co-located without ballooning it (PATTERNS D-05)."
  - "Cut Line A scope lock recorded in the file header: grounding/reactionFrame/populations/calibration are populated by REFERENCE this phase; NOT threaded into pipeline.ts/deepseek.ts (Plan 03 wires them)."
  - "ReactionFrameSpec members typed via typeof selectPersonaSlots / typeof buildAudienceRepaint so tsc proves the pack binds the real functions (D-05 do-not-under-type)."

patterns-established:
  - "DomainPackScoring.run mirrors aggregateScores arity + AggregateScoresOptions shape verbatim — the Plan-03 seam wrap type-checks against this."
  - "Compile-time assignability binding (const _probe: DomainPackScoring['run'] = aggregateScores) as a BLOCKING regression gate against contract drift (T-01-RR)."

requirements-completed: [PACK-03]

# Metrics
duration: 7min
completed: 2026-06-26
---

# Phase 01 Plan 02: DomainPack Type Contract Summary

**Pure-types 7-field `DomainPack` contract (id/run + populations/grounding/stimulusTypes/reactionFrame/scoring/outputSchema/calibration), with a compile-time probe proving `aggregateScores` is assignable to `scoring.run` — de-risking the Plan-03 seam wrap.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-26T13:00:00Z
- **Completed:** 2026-06-26T13:07:05Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Defined the full 7-field `DomainPack` interface NOW (D-05) so P3 (General) / P6 (Predict) packs mount the same contract without a mid-milestone re-cut.
- `DomainPackScoring.run` mirrors `aggregateScores` (aggregator.ts:520) verbatim; `DomainPack.run` mirrors `runPredictionPipeline` (pipeline.ts:332).
- All 7 deferred spec types are thin-but-precise (no `any`/`unknown`); reaction-frame members typed via `typeof` of the real `selectPersonaSlots` / `buildAudienceRepaint`.
- Compile-time + runtime contract probe proves `aggregateScores` binds to `scoring.run` (the Plan-03 de-risk) and that deferred specs instantiate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the DomainPack interface + 7 spec types** - `0f0d4170` (feat)
2. **Task 2: Contract probe — prove the scoring shape matches aggregateScores** - `ac39958e` (test)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP.

_Note: this plan is type-contract work; Task 1 is the interface (impl), Task 2 the contract probe — committed impl-then-test per the plan's task order._

## Files Created/Modified
- `src/lib/engine/domain-pack.ts` - Pure-types `DomainPack` contract: `DomainPack`, `DomainPackScoring`, `PopulationsSpec`, `GroundingSpec`, `ReactionFrameSpec`, `CalibrationSpec`, `OutputSchemaSpec`, `StimulusType`. `import type` only; header records the Cut Line A scope lock.
- `src/lib/engine/__tests__/domain-pack.contract.test.ts` - BLOCKING contract gate (PACK-03): compile-time binding `aggregateScores → DomainPackScoring["run"]` + runtime instantiation of the 4 deferred spec types.

## Decisions Made
- Contract lands in a sibling `domain-pack.ts` rather than appending to the 1047-line `types.ts` (PATTERNS D-05 discretion note).
- `scoring.run` and `run` mirror the real signatures verbatim — no arity/option-shape drift — so Plan 03's `run: aggregateScores` wrap type-checks.
- `StimulusType` = `"text" | "tiktok_url" | "video_upload"` (the input_mode/stimulus axis), kept orthogonal to the `id: "socials"` domain key (D-08 anti-pattern "collapsing input_mode into the pack key").
- Cut Line A scope lock documented in the file header: the declarative spec fields are NOT threaded into `pipeline.ts`/`deepseek.ts` this phase (would break ~60 callers; breaches D-08).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `tsc --noEmit` reports no `domain-pack` errors; the contract probe is green (2 passed) via the vitest binary.

## Known Stubs
None. The deferred spec types (`PopulationsSpec`, `GroundingSpec`, `CalibrationSpec`, `OutputSchemaSpec`) are intentionally thin-but-precise per D-05 — they are type declarations to be populated by `SOCIALS_PACK` in Plan 03, not runtime stubs. This is the planned phasing, not unfinished work.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The `DomainPack` contract is ready for Plan 03 to populate as `SOCIALS_PACK satisfies DomainPack`.
- The Task-2 compile-time binding guards against any future drift between the interface and the real `aggregateScores` — if Plan 03's wrap regresses the shape, this gate goes red.
- No blockers. Cut Line A remains scoped (no pipeline threading) per the header lock.

## Self-Check: PASSED

- FOUND: src/lib/engine/domain-pack.ts
- FOUND: src/lib/engine/__tests__/domain-pack.contract.test.ts
- FOUND: .planning/phases/01-engine-pack-seam/01-02-SUMMARY.md
- FOUND commit: 0f0d4170 (Task 1)
- FOUND commit: ac39958e (Task 2)

---
*Phase: 01-engine-pack-seam*
*Completed: 2026-06-26*
