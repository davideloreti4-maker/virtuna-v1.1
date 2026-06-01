---
phase: 02-remix-mode-one-board-two-config
plan: 01
subsystem: database
tags: [supabase, zod, typescript, vitest, content-hash, migration]

# Dependency graph
requires: []
provides:
  - analysis_results.mode column (TEXT NOT NULL DEFAULT 'score' CHECK(mode IN ('score','remix'))) applied to live DB
  - AnalysisInputSchema z.enum mode field with default 'score' + remix+text refine guard
  - computeContentHash folds ::mode=remix before each digest (score path byte-identical)
  - mode persisted at both INSERT sites in /api/analyze (buildInsertRow + placeholder)
  - database.types.ts Row/Insert/Update carry mode field
  - Wave-0 regression tests: schema enum/default/refine + hash score-stability + mode-distinctness
affects: [02-02, 02-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: test against current code (RED), then implement to pass (GREEN)"
    - "Score-path-safe hash fold: guard remix segment with input.mode === 'remix' so every score hash stays byte-identical"
    - "Migration shape cloned from analog (heatmap migration): ALTER TABLE ADD COLUMN IF NOT EXISTS with inline DEFAULT for backfill"

key-files:
  created:
    - supabase/migrations/20260601000000_add_mode_to_analysis_results.sql
    - src/lib/engine/__tests__/analysis-input-schema.test.ts
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/cache/prediction-cache.ts
    - src/app/api/analyze/route.ts
    - src/types/database.types.ts
    - src/lib/engine/__tests__/prediction-cache.test.ts

key-decisions:
  - "D-12/D-13: ADD COLUMN with DEFAULT 'score' backfills all historical rows atomically — no separate UPDATE needed"
  - "D-14: ::mode=remix segment injected before each of the three computeContentHash digest() calls (score path untouched)"
  - "D-15: select('*') in /api/analysis/[id] carries mode through without any route change"
  - "Task 3 was handled by orchestrator via Supabase MCP (non-TTY safe path) — not pushed from terminal"

patterns-established:
  - "Hash-fold guard: if (input.mode === 'remix') h.update('::mode=remix') before each return h.digest('hex')"
  - "Zod chained refine: add second .refine() after existing refine for cross-field validation"
  - "Database types hand-edit: add mode: string to Row, mode?: string to Insert/Update (matches live column)"

requirements-completed: [REMIX-01, REMIX-02]

# Metrics
duration: orchestrator-managed (2 executor waves + human-action checkpoint)
completed: 2026-06-01
---

# Phase 02 Plan 01: Mode Column Data Spine Summary

**mode column on analysis_results applied to live Supabase DB with Zod boundary validation, score-path-safe hash fold, and dual-INSERT persistence — the data spine Plans 02/03 depend on**

## Performance

- **Duration:** Orchestrator-managed across 2 executor waves + human-action checkpoint
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 3 (Tasks 1+2 auto; Task 3 human-action handled by orchestrator)
- **Files modified:** 6

## Accomplishments

- Wave-0 RED tests written first (analysis-input-schema.test.ts + prediction-cache extensions) — confirmed failing before any implementation
- All 5 implementation artifacts shipped GREEN: migration, Zod schema, hash fold, API persistence, generated types
- Live DB column applied and verified by orchestrator: NOT NULL DEFAULT 'score', CHECK constraint rejects 'bogus', NULL count = 0 (historical backfill), database.types.ts agrees with live shape
- 29 tests pass, tsc --noEmit clean, `grep -c "mode: validated.mode"` == 2, `grep -c "::mode=remix"` == 3

## Task Commits

1. **Task 1: Wave-0 RED tests (schema mode enum/refine + hash mode fold)** — `3ca1cc1d` (test)
2. **Task 2: Migration + schema + hash + types + API persistence (GREEN)** — `bf52dfbe` (feat)
3. **Task 3: Push migration to live DB** — handled by orchestrator via Supabase MCP (no additional commit; migration file already in `bf52dfbe`)

## Live DB Verification Evidence (Task 3 — Orchestrator-Applied)

- `information_schema.columns` — analysis_results.mode = text, NOT NULL, DEFAULT 'score'::text — PASS
- `select count(*) from analysis_results where mode is null` = 0 (historical backfill applied) — PASS
- `mode='bogus'` INSERT rejected by CHECK — catalog constraint `analysis_results_mode_check = CHECK (mode = ANY (ARRAY['score','remix']))` — PASS
- `database.types.ts` hand-edit (mode: string) agrees with live column shape — PASS

## Files Created/Modified

- `supabase/migrations/20260601000000_add_mode_to_analysis_results.sql` — ALTER TABLE ADD COLUMN mode TEXT NOT NULL DEFAULT 'score' CHECK (mode IN ('score','remix'))
- `src/lib/engine/__tests__/analysis-input-schema.test.ts` — ≥4 assertions: enum accept, default, bogus-reject, remix+text-refine-reject
- `src/lib/engine/__tests__/prediction-cache.test.ts` — extended: score-path-stability (hardcoded hex fixture) + mode-distinctness
- `src/lib/engine/types.ts` — z.enum(["score","remix"]).default("score") + chained refine for remix+text guard; PredictionResult optional mode field
- `src/lib/engine/cache/prediction-cache.ts` — 3× `if (input.mode === "remix") h.update("::mode=remix")` before each digest()
- `src/app/api/analyze/route.ts` — mode: validated.mode at buildInsertRow return + placeholder INSERT (2 sites)
- `src/types/database.types.ts` — mode: string in Row; mode?: string in Insert and Update

## Decisions Made

- Cloned heatmap migration shape (additive ALTER, IF NOT EXISTS, COMMENT ON COLUMN) for consistency
- Score-path hash stability: guarded by `input.mode === "remix"` — not `!== "score"` — so any future mode value doesn't silently affect score hashes
- Task 3 executed non-interactively by orchestrator via Supabase MCP `apply_migration` (blocking-human checkpoint, not automatable from terminal)

## Deviations from Plan

None — plan executed exactly as written. Task 3 human-action checkpoint proceeded via the designated Supabase MCP path.

## Issues Encountered

None.

## User Setup Required

None — migration applied to live DB by orchestrator. No env changes needed.

## Must-Haves / Success Criteria Status

| Criterion | Status |
|-----------|--------|
| analysis_results.mode TEXT NOT NULL DEFAULT 'score' CHECK in live DB | PASS |
| AnalysisInputSchema accepts mode, defaults 'score', rejects remix+text and bogus enum | PASS |
| computeContentHash score-path byte-identical (hardcoded fixture assertion green) | PASS |
| computeContentHash score vs remix distinct for same URL | PASS |
| mode persisted at both INSERT sites (grep -c == 2) | PASS |
| /api/analysis/[id] select('*') carries mode through with zero route change | PASS |
| Wave-0 tests all GREEN (29 pass, 0 fail) | PASS |
| tsc --noEmit no new errors | PASS |

## Next Phase Readiness

- Plan 02-02 (board rehydrates mode on permalink reload) can read `analysis_results.mode` as source of truth — column exists and is populated
- Plan 02-03 (content-form two-config UI) has the Zod boundary and API persistence it needs
- No blockers

---

*Phase: 02-remix-mode-one-board-two-config*
*Completed: 2026-06-01*
