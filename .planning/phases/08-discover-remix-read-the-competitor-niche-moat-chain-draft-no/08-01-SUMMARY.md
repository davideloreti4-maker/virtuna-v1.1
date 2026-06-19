---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
plan: 01
subsystem: audience
tags: [persona-tuning, weight-presets, temperature-disposition, goal-intent, regression-gate]

requires:
  - phase: 07-audience-manager
    provides: "GOAL_INTENT_BIAS + TEMPERATURE_DISPOSITION tables (with [ASSUMED] placeholder values), WEIGHT_PRESETS, audience-regression-gate"
provides:
  - "GOAL_INTENT_BIAS with locked values (no [ASSUMED]) — each intent maps to a real WEIGHT_PRESETS preset summing to 1.0"
  - "TEMPERATURE_DISPOSITION lens with locked values (no [ASSUMED]) — meaningful low/hot spread for who-it's-NOT-for (D-10) + verbatim grouping (D-11)"
  - "Tests asserting both tables carry real, stable values and no [ASSUMED] marker remains"
affects: [W4 multi-audience compare, read-only personas UI, weak-signal fallback, who-it's-NOT-for]

tech-stack:
  added: []
  patterns:
    - "Source-marker assertion: test reads the .ts source via readFileSync and asserts no [ASSUMED]/structure-not-values marker remains (locks values at the source level, not just runtime)"

key-files:
  created: []
  modified:
    - src/lib/audience/goal-intent.ts
    - src/lib/audience/temperature-disposition.ts
    - src/lib/audience/__tests__/goal-intent.test.ts
    - src/lib/audience/__tests__/temperature-disposition.test.ts

key-decisions:
  - "W0 LOCKS values, not structure — P7's key mappings were already correct; the change is removing [ASSUMED] markers + adding source-marker + spread/preset assertions"
  - "sell and authority deliberately share WEIGHT_PRESETS.niche_heavy — both are depth plays whose audience lives in-niche; per-intent flavour carried by repaint prose (GOAL_INTENT_SUFFIX), not the weight mix"
  - "flash-aggregate STRONG/MIXED_THRESHOLD untouched (Pitfall 4) — they are calibrated, not [ASSUMED]; changing them shifts every skill gate"

patterns-established:
  - "Source-marker test guard: readFileSync the source + assert /\\[ASSUMED\\]/i absent — prevents placeholder markers silently surviving a 'tuning' pass"

requirements-completed: [AUD-W0]

duration: 8min
completed: 2026-06-19
---

# Phase 08 Plan 01: W0 Persona-Bias Value Tuning Summary

**Locked the two deterministic persona-bias tables (GOAL_INTENT_BIAS + TEMPERATURE_DISPOSITION) — removed the `[ASSUMED]` placeholder markers, asserted every value is a real WEIGHT_PRESETS preset / meaningful temperature×disposition label, and re-confirmed the engine regression gate (ENGINE_VERSION 3.19.0).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-19T07:55:00Z
- **Completed:** 2026-06-19T08:02:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `GOAL_INTENT_BIAS` values LOCKED — `[ASSUMED]`/"structure-not-values" markers removed, replaced with locked-value rationale per entry; each intent maps to a sanctioned `WEIGHT_PRESETS` preset summing to exactly 1.0 (no invented mix).
- `TEMPERATURE_DISPOSITION` lens LOCKED — `[ASSUMED] per D-02` marker removed; spread tuned so ≥2 archetypes carry a low/negative disposition (who-it's-NOT-for, D-10) and ≥2 carry a hot/positive disposition (verbatim cluster, D-11).
- New source-marker tests assert no `[ASSUMED]` marker survives in either source file, plus preset-membership (Task 1) and low/hot spread (Task 2) assertions.
- Engine regression gate re-confirmed green: `ENGINE_VERSION === "3.19.0"`, General → DEFAULT mix at source `'default'`, no `analysis_override` injected.
- W4 (multi-audience compare) and persona-value-reading features unblocked (D-02 hard prerequisite cleared).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Tune GOAL_INTENT_BIAS** — RED test auto-committed `f2301e16`, GREEN `dcb89ea0` (feat)
2. **Task 2: Tune TEMPERATURE_DISPOSITION + re-assert regression gate** — `41737025` (feat)

_Note: an `auto-wip` post-commit/working-tree hook on this worktree pre-committed the Task 1 RED test as `f2301e16 chore(auto-wip)`; the proper `feat(08-01)` commit folds the source change + test into the canonical history._

## Files Created/Modified

- `src/lib/audience/goal-intent.ts` — `GOAL_INTENT_BIAS` values locked, `[ASSUMED]` removed, per-entry rationale added
- `src/lib/audience/temperature-disposition.ts` — `TEMPERATURE_DISPOSITION` lens locked, `[ASSUMED]` removed, D-10/D-11 spread rationale added
- `src/lib/audience/__tests__/goal-intent.test.ts` — added preset-membership + no-`[ASSUMED]`-marker assertions
- `src/lib/audience/__tests__/temperature-disposition.test.ts` — added low/hot spread + no-`[ASSUMED]`-marker assertions

## Decisions Made

- **W0 locks values, not structure.** P7's `GOAL_INTENT_BIAS` key→preset mapping (grow→new_creator, sell/authority→niche_heavy, nurture→established) was already the correct locked structure; the only outstanding debt was the `[ASSUMED]` markers and the lack of a guard asserting the values are real. Removing the markers + adding source/spread/preset tests is the entirety of W0.
- **sell and authority share `niche_heavy`** by design — both are depth plays whose audience is in-niche (buyer vs. scout); the deterministic weight bias is identical, with per-intent flavour carried by repaint prose, not the mix.
- **Left `flash-aggregate` thresholds untouched** (Pitfall 4) — `STRONG_THRESHOLD`/`MIXED_THRESHOLD` are calibrated, not `[ASSUMED]`; re-tuning them would shift every skill's band gate, a deliberate engine change out of W0 scope.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- An `auto-wip` hook on this worktree auto-committed the Task 1 RED test (`f2301e16`) the moment the RED `pnpm test` ran, before the canonical `feat` commit. No data lost — the source change + test were folded into `dcb89ea0`. Noted so the extra `chore(auto-wip)` commit in history is understood, not mistaken for stray work.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- W0 complete: both persona-bias tables carry real, asserted-stable values with no `[ASSUMED]` markers. The hard D-02 prerequisite is cleared.
- W4 (multi-audience compare), read-only personas in the UI, and the who-it's-NOT-for / weak-signal fallback can now read persona values as signal, not placeholder noise.
- Engine invariants intact: `ENGINE_VERSION 3.19.0`, General no-op, `flash-aggregate` thresholds unchanged.

## Self-Check: PASSED

- FOUND: src/lib/audience/goal-intent.ts (0 `[ASSUMED]` matches)
- FOUND: src/lib/audience/temperature-disposition.ts (0 `[ASSUMED]` matches)
- FOUND: commit dcb89ea0 (Task 1 GREEN)
- FOUND: commit 41737025 (Task 2)
- VERIFIED: WEIGHT_PRESETS.default unchanged `{ fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 }`
- VERIFIED: audience-regression-gate green (ENGINE_VERSION 3.19.0)

---
*Phase: 08-discover-remix-read-the-competitor-niche-moat-chain-draft-no*
*Completed: 2026-06-19*
