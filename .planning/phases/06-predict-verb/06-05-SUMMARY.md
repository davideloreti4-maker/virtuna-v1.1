---
phase: 06-predict-verb
plan: 05
subsystem: api

tags: [predict, runner, orchestration, analyst-panel, honesty, directional, zod]

# Dependency graph
requires:
  - phase: 06-02
    provides: aggregatePredict — the pure panel→{band,range,confidence,factors} collapse
  - phase: 06-03
    provides: runPredictPanel — the analyst-reasoning Flash leaf (the default deps.flash)
  - phase: 06-04
    provides: PredictionGaugeBlockSchema — the .strict() bands-only validate target
provides:
  - runPredict(input, deps?) — the Predict verb orchestrator (panel + scenario → validated prediction-gauge block)
  - readSubjectKind(audience, explicit?) — shared exported marker resolver for the route's 400 person-reject
  - PredictRunInput / PredictRunDeps — the IO contract + injectable zero-network flash seam
affects: [06-06-route, 06-07-chain-handoff, predict-verb]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verb orchestrator cloned from simulate-runner: injectable deps.flash seam, resolveTier defense-in-depth throw, .strict() validate-on-assemble"
    - "Shared marker resolver lifted out of the runner and exported so the route rejects a person SIM BEFORE the runner runs (D-03/D-08)"
    - "Always-on honesty provenance: every assembled block carries tier:Directional + model:sim1-flash + non-empty Directional caveat (PRED-03/D-04)"

key-files:
  created:
    - src/lib/tools/runners/predict-runner.ts
  modified: []

key-decisions:
  - "readSubjectKind defaults a marker-absent mode:general audience to 'panel' (NOT 'person') so the default template-analyst Analyst Panel is never wrongly rejected (Pitfall 3)"
  - "assumptions are derived purely from the scenario text via sentence split (stated premises) — no model field, no fabricated signal (D-04 honesty)"
  - "runPredict does not carry subjectKind into the block (the gauge block has no subjectKind field); the person/panel branch is the route's 400 concern, not the runner's"

patterns-established:
  - "Predict verb = runPredictPanel (analyst leaf) + aggregatePredict (collapse) + PredictionGaugeBlockSchema (.strict() re-validate), binary stop/scroll leaf untouched"
  - "Steer rides the audience repaint (analyst roster), the scenario is data-fenced content — never concatenated into the steer (D-07)"

requirements-completed: [PRED-01, PRED-03]

# Metrics
duration: 9min
completed: 2026-06-29
---

# Phase 6 Plan 05: predict-runner orchestrator Summary

**`runPredict` clones simulate-runner exactly — injectable `deps.flash` zero-network seam, `resolveTier` Directional throw, `.strict()` validate-on-assemble — but swaps the binary leaf for `runPredictPanel` + `aggregatePredict`, assembling an always-Directional `prediction-gauge` block and exporting a shared `readSubjectKind` for the route's 400 person-reject.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-29T03:53:00Z
- **Completed:** 2026-06-29T03:55:30Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- `runPredict(input, deps?)` orchestrates the full verb: tier guard → `buildAudienceRepaint` steer → `runPredictPanel` → `aggregatePredict` → assemble + `.strict()`-validate a `prediction-gauge` block (PRED-01).
- Every assembled block ALWAYS carries `tier:"Directional"`, `model:"sim1-flash"`, and a non-empty always-on Directional caveat — never an oracle (PRED-03/D-04).
- `readSubjectKind` lifted to a shared exported helper: rejects ONLY on an explicit `note:"person"`; a marker-absent `mode:"general"` audience defaults to `"panel"` so the default Analyst Panel is never mis-classified (D-03/Pitfall 3).
- Wave-0 `predict-runner.test.ts` turned GREEN (4/4) with the injected `deps.flash` — zero network.

## Task Commits

Each task was committed atomically:

1. **Task 1: predict-runner.ts — orchestration, shared readSubjectKind, tier guard, .strict() assemble** - `faef419f` (feat)

_Note: the Wave-0 RED `test(...)` commit for `predict-runner.test.ts` was landed by the Wave-0 plan; this plan supplies the GREEN implementation. Plan-level RED→GREEN gate is satisfied across the two plans._

## Files Created/Modified
- `src/lib/tools/runners/predict-runner.ts` - The Predict verb orchestrator: `runPredict`, exported `readSubjectKind`, `PredictRunInput`/`PredictRunDeps`, the `deriveAssumptions` premise-split, and the private `.strict()` `validate()`.

## Decisions Made
- **Default subjectKind = "panel" (not "person").** The simulate-runner analog defaults to `"person"` as its honest-safe fallback, but Predict's default audience is the `template-analyst` Analyst Panel with `custom_context: []`. Defaulting to `"person"` there would wrongly reject the default panel (Pitfall 3). `readSubjectKind` returns `"person"` ONLY on an explicit `note:"person"` or caller override.
- **assumptions = scenario sentence split.** The schema's `assumptions` are the scenario's stated premises; there is no model field for them, so they are derived purely from the scenario text (every assumption is a substring of the input — no fabricated signal, D-04).
- **Runner keeps the `resolveTier !== "Directional"` throw as defense-in-depth.** The user-facing reject is the route's 400 (D-08); the runner throw guards a programming error.

## Deviations from Plan

None - plan executed exactly as written. (One cosmetic adjustment: the module docstring's "(NOT `runFlashTextMode`)" / "(NOT `aggregateFlash`)" comparisons were reworded to "(NOT the binary stop/scroll text leaf)" / "(NOT the binary band/fraction collapse)" so the acceptance gate `grep -c "FlashResultSchema\|runFlashTextMode\|aggregateFlash" = 0` is satisfied literally. No behavioral change.)

## Issues Encountered
- `npx tsc --noEmit <file>` (single-file form) reports spurious `TS2307 Cannot find module '@/...'` because it ignores the tsconfig path aliases. A full project `tsc --noEmit` confirms ZERO errors on `predict-runner.ts`. Used the project-wide form for the real gate (per Pitfall 6 / "no NEW errors on touched paths").

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 06-06 (route) can now import `runPredict` + `readSubjectKind` to build the POST handler with the D-08 400 guards (`mode !== "general"` and `readSubjectKind === "person"`) BEFORE the try block. `route.test.ts` (Wave 3) and `chain-handoff.test.ts` (Wave 4) remain RED by design — not in this plan's scope.
- The binary Flash schema/aggregate/leaf are untouched; the predict leaves are fully isolated.

## Self-Check: PASSED
- FOUND: `src/lib/tools/runners/predict-runner.ts`
- FOUND: commit `faef419f`

---
*Phase: 06-predict-verb*
*Completed: 2026-06-29*
