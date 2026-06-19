---
phase: 10-account-read-saved-shelf-recalibration-flywheel
plan: 01
subsystem: flywheel
tags: [signatures, disposition, reconciliation, recalibration, persona-weights, pure-functions, tdd]

# Dependency graph
requires:
  - phase: 07-audience
    provides: "TEMPERATURE_DISPOSITION lens, Disposition union, PersonaWeights + normalizeWeights, analysis_override slot"
  - phase: 08-discover-remix
    provides: "W0-locked TEMPERATURE_DISPOSITION values (the 10→6 collapse)"
provides:
  - "predictedSignature(personas): pure FlashPersona[] → 6-disposition share vector"
  - "realizedSignature(metrics): pure metrics → partial disposition vector + per-channel provenance (absent ≠ zero)"
  - "reconcile(predicted, realized): divergence vector + calibration-vs-craft classifier (A1 split)"
  - "evaluateGate(rows): N_MIN/DIV_THRESHOLD/AGREE_THRESHOLD confidence gate → ProposalSet | null"
  - "buildOverride(proposal, currentWeights): bounded, clamped, re-normalized PersonaWeights delta"
affects: [10-02-persistence, 10-03-outcome-capture, 10-05-recalibration-wiring, 10-07-regression-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure deterministic math core: no Date.now/Math.random/I/O — cache-stable, regression-gate-free by construction"
    - "Honesty spine: absent engagement channel EXCLUDED, never zero-filled (Pitfall 3)"
    - "A1 calibration-vs-craft disposition split as the D-03 protection (craft never reaches the override path)"

key-files:
  created:
    - src/lib/flywheel/signature.ts
    - src/lib/flywheel/realized-signature.ts
    - src/lib/flywheel/reconcile.ts
    - src/lib/flywheel/confidence-gate.ts
    - src/lib/flywheel/recalibration.ts
    - src/lib/flywheel/__tests__/signature.test.ts
    - src/lib/flywheel/__tests__/reconcile.test.ts
    - src/lib/flywheel/__tests__/confidence-gate.test.ts
    - src/lib/flywheel/__tests__/recalibration.test.ts
  modified: []

key-decisions:
  - "watch_through_pct feeds BOTH scanner and lurker (same retention signal, two readings) — both are craft, so no calibration impact"
  - "connector realized rate = average of present shares/views and comments/views (primary + secondary channel)"
  - "skeptic has no realized channel in the aggregate metrics set (early-drop inverse needs a retention curve) — excluded here, craft-side only"
  - "DISPOSITION_TO_SLOTS: collector→fyp, converter→niche, connector→fyp+loyalist (RESEARCH §2 slot grouping)"

patterns-established:
  - "Pattern: every flywheel math fn is a pure function of its inputs — unit-testable, deterministic, no model/I/O"
  - "Pattern: [ASSUMED] A1/A2/A3 code comments flag owner-tunable constants/splits for confirmation before phase verify"

requirements-completed: [FLYWHEEL-02, FLYWHEEL-03, FLYWHEEL-04]

# Metrics
duration: 18min
completed: 2026-06-19
---

# Phase 10 Plan 01: Flywheel Math Core Summary

**Five pure, deterministic flywheel modules — predicted/realized signature derivation, calibration-vs-craft reconciliation, a >=N_MIN confidence gate, and a bounded re-normalized recalibration delta — the moat's demonstrably-sound math spine, 38 unit tests green.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-19
- **Completed:** 2026-06-19
- **Tasks:** 3 (all TDD)
- **Files created:** 9 (5 modules + 4 test files)

## Accomplishments
- `predictedSignature` collapses SIM-1 Flash STOP/scroll verdicts into a normalized 6-disposition share vector via the P8-locked TEMPERATURE_DISPOSITION lens; all-zero stays all-zero (no NaN); unknown archetypes skipped (never fabricated).
- `realizedSignature` maps real post metrics onto the same dispositions with the honesty spine intact: a null channel is **excluded, never zero-filled** (Pitfall 3); normalization happens across present channels only; per-channel provenance (`public_scrape` | `creator_supplied`) preserved.
- `reconcile` computes the divergence over the intersection of present dispositions and routes each to calibration (collector/connector/converter — the WHO) or craft (scanner/lurker/skeptic — the HOW-WELL) per the A1 split; a craft divergence can **never** appear in the calibration set (D-03 protection).
- `evaluateGate` aggregates n/mean/agree per calibration disposition and PROPOSES only at >=N_MIN consistent same-direction divergences past the div/agree thresholds; craft dispositions can never produce a proposal.
- `buildOverride` turns one confirmed proposal into a clamped, `normalizeWeights`-re-summed PersonaWeights vector touching only the passed-in current weights — never `DEFAULT_PERSONA_WEIGHT_CONFIG`/`ARCHETYPE_DEFINITIONS` (Pitfall 5).

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Signature derivation (predicted + realized)** — `a28cfb3c` (test) → `9b6de48f` (feat)
2. **Task 2: Reconcile + calibration-vs-craft classifier** — `5fb066ab` (test) → `916b4a74` (feat)
3. **Task 3: Confidence gate + bounded recalibration delta** — `5dc2d945` (test) → `d43ced29` (feat)

_TDD plan: each task carries a RED test commit followed by a GREEN feat commit._

## Files Created/Modified
- `src/lib/flywheel/signature.ts` — `DISPOSITIONS` const + `predictedSignature()`.
- `src/lib/flywheel/realized-signature.ts` — `RealizedMetrics`/`MetricChannel` types + `realizedSignature()` with provenance.
- `src/lib/flywheel/reconcile.ts` — `CALIBRATION_DISPOSITIONS`/`CRAFT_DISPOSITIONS` (A1) + `reconcile()`.
- `src/lib/flywheel/confidence-gate.ts` — `N_MIN`/`DIV_THRESHOLD`/`AGREE_THRESHOLD` + `evaluateGate()`.
- `src/lib/flywheel/recalibration.ts` — `ASSUMED_STEP` + `buildOverride()` (disposition→slot nudge + clamp + normalize).
- `src/lib/flywheel/__tests__/*.test.ts` — 38 unit tests across the four suites.

## Decisions Made
- **watch_through_pct → scanner AND lurker:** the same retention signal answers two craft readings; both are craft so neither reaches calibration.
- **connector realized rate = mean of present shares/views + comments/views:** primary + secondary channel, averaged over whichever are present.
- **skeptic excluded from realized vector:** the early-drop inverse signal needs a retention curve not in the aggregate metric set; surfaced craft-side in a later plan, never calibration.
- **`[ASSUMED]` markers kept in code** for A1 (the calibration-vs-craft split), A2 (gate constants), A3 (step size) — the single highest-value owner confirmations before `/gsd-verify-phase 10`.

## Deviations from Plan

None — plan executed exactly as written.

Note: Task 2's `<read_first>` referenced `10-SPIKE.md` (the owner-confirmed A1 split from a 10-02 spike checkpoint). That file does not exist in this worktree; the A1 split is fully and consistently specified in `10-RESEARCH.md` §1 + §3 (collector/connector/converter = calibration; scanner/lurker/skeptic = craft), so the research-locked split was used and the `[ASSUMED] A1` marker retained for owner confirmation. No behavioural deviation.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. Zero new packages (RESEARCH §"Package Legitimacy Audit": phase adds zero packages — verified, no install task).

## Verification
- `npx vitest run src/lib/flywheel/` → **4 files / 38 tests passed.**
- `npx eslint src/lib/flywheel/ --max-warnings=0` → **clean (exit 0).**
- `grep '^import.*(DEFAULT_PERSONA_WEIGHT_CONFIG|ARCHETYPE_DEFINITIONS)' src/lib/flywheel/` → **no prohibited imports** (the only textual hits are negated statements in code comments).

## Next Phase Readiness
- The deterministic math spine is ready to be wired into persistence (10-02) and outcome capture (10-03); `buildOverride` is the only write-shape the recalibration wiring (10-05) needs.
- **REQUIREMENTS.md note (carried from plan):** FLYWHEEL-02/03/04 are not yet enumerated in `.planning/REQUIREMENTS.md` (established Phase-8 provisional gap). `requirements mark-complete` will report `not_found` until REQUIREMENTS.md is reconciled before `/gsd-verify-phase 10`.

## Self-Check: PASSED

- All 9 files verified on disk (5 modules + 4 test files).
- All 7 commits verified in git history (6 task commits a28cfb3c→d43ced29 + docs 8c8018f4).
- Working tree clean.

---
*Phase: 10-account-read-saved-shelf-recalibration-flywheel*
*Completed: 2026-06-19*
