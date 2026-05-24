---
phase: 04-wave-0-content-type-niche-detection
plan: 01
subsystem: engine
tags: [zod, typescript, taxonomy, content-type, niche-detection, wave0]

# Dependency graph
requires:
  - phase: 03-wave-0-stubs
    provides: Wave0Result stub interface, SignalAvailability scaffolding, runWave0 emit pattern
provides:
  - Wave0 typed result schemas (Wave0ContentTypeResult, Wave0NicheResult) + Zod validation
  - ContentTypeSlug enum (7-cat: talking_head, b_roll, slideshow, action, tutorial, vlog, other)
  - CONTENT_TYPE_WEIGHT_MATRIX (locked 7×4 per D-12) + applyContentTypeWeights pure helper
  - PersonaMix + BenchmarkFilters types on NichePrimary (10 primaries populated)
  - SignalAvailability widened with content_type + niche keys (D-20)
affects: [04-02-detectors, 04-03-orchestration, 07-personas, 08-retrieval, 10-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locked-matrix pattern: data-only module with verbatim CONTEXT constants + load-bearing comment"
    - "Pure-function clamp + cap: Math.min(10, raw * Math.max(FLOOR, Math.min(CEILING, m)))"
    - "Type widening with backwards-compat: new fields nullable so existing stub literals still satisfy"

key-files:
  created:
    - src/lib/engine/wave0/content-type-weights.ts
    - src/lib/engine/__tests__/content-type-weights.test.ts
  modified:
    - src/lib/engine/types.ts
    - src/lib/niches/taxonomy.ts
    - src/lib/niches/__tests__/taxonomy.test.ts

key-decisions:
  - "Wave0Result widened via z.infer (replaces stub interface) — both fields kept nullable so D-16 null-safety contract holds"
  - "SignalAvailability widening explicitly tolerates engine-wide TS errors — fixed in Plan 04-03"
  - "PersonaMix + BenchmarkFilters live in taxonomy.ts (D-15 single-file scope), not split"
  - "Locked D-12 matrix copied verbatim — modifications require Phase 10 commit + version bump"
  - "applyContentTypeWeights clamps adjusted signal at 10 defensively (mitigates T-04-V5-01)"

patterns-established:
  - "Wave0 module dir convention: src/lib/engine/wave0/ for new pure-data + pure-function helpers"
  - "Persona archetype vocabulary: fyp-{gender}-{generation} | niche-{topic}-enthusiast | loyalist-existing-follower | cross-niche-curious"
  - "Tag-filter convention: lowercase alphanumeric only, no `#` prefix, no spaces"

requirements-completed: [CONTENT-03, CONTENT-04]

# Metrics
duration: 8min
completed: 2026-05-18
---

# Phase 04 Plan 01: Foundations — Wave 0 Result Schemas, Content-Type Matrix, Taxonomy Extensions Summary

**Zod-validated Wave 0 result types (Wave0ContentTypeResult, Wave0NicheResult) + locked 7×4 content-type weight matrix module + 10 primary-niche taxonomy entries populated with personas + benchmark_filters**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-18T03:40:50Z
- **Completed:** 2026-05-18T03:48:20Z
- **Tasks:** 3 (all type=auto, all tdd=true)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Wave 0 type contracts shipped FIRST so Plan 04-02 (detectors) + Plan 04-03 (orchestration) can import already-typed schemas without ad-hoc interface work
- Locked D-12 7×4 weight matrix codified verbatim into a pure-function module — Phase 10 calibration can revise without touching detector code
- All 10 NICHE_TREE primaries now expose persona allocations (weight-sum=10 each) + benchmark retrieval filters, unblocking Phase 7 persona simulation + Phase 8 pgvector retrieval
- T-04-V5-01 (Tampering — out-of-range adjusted signal) mitigated via `Math.min(10, ...)` cap inside applyContentTypeWeights

## Task Commits

Each task was committed atomically (RED → GREEN cycle for TDD tasks):

1. **Task 1: Widen types.ts with Wave0 result schemas + Zod validation** — `67ae7fb` (feat)
2. **Task 2: Build content-type weight matrix module + tests**
   - RED — `f559abb` (test: failing tests, module missing)
   - GREEN — `b268902` (feat: module created, 12/12 passing)
3. **Task 3: Extend taxonomy.ts with personas + benchmark_filters + tests**
   - RED — `bc806a8` (test: failing tests, 6 new fail / 12 existing pass)
   - GREEN — `2a033c9` (feat: 10 primaries populated, 18/18 passing)

## Files Created/Modified

**Created (2 files, 175 LOC):**
- `src/lib/engine/wave0/content-type-weights.ts` (55 LOC) — Locked CONTENT_TYPE_WEIGHT_MATRIX + MULTIPLIER_FLOOR/CEILING constants + applyContentTypeWeights pure helper
- `src/lib/engine/__tests__/content-type-weights.test.ts` (120 LOC) — 12 test cases covering matrix invariants, mutation safety, cap enforcement, passthrough

**Modified (3 files, +244 LOC):**
- `src/lib/engine/types.ts` (+50, -5 LOC) — ContentTypeEnumSchema + Wave0ContentTypeResultSchema + Wave0NicheResultSchema + Wave0ResultSchema (z.infer-derived Wave0Result replaces stub interface); SignalAvailability extended with content_type + niche keys (D-20)
- `src/lib/niches/taxonomy.ts` (+149 LOC) — PersonaMix + BenchmarkFilters types + extended NichePrimary type + personas + benchmark_filters for all 10 primaries
- `src/lib/niches/__tests__/taxonomy.test.ts` (+50 LOC) — 6 new Phase 4 invariant tests appended; PersonaMix imported for explicit-typed reduce in weight-sum test

## Test Results

| Suite | Existing | New | Total | Status |
| --- | --- | --- | --- | --- |
| `content-type-weights.test.ts` | 0 | 12 | 12 | green |
| `taxonomy.test.ts` (extended) | 12 | 6 | 18 | green |
| `stubs.test.ts` (regression — Wave0Result backwards-compat) | 9 | 0 | 9 | green |
| **Total** | **21** | **18** | **39** | **green** |

Locked D-12 matrix values copied verbatim — verified by Test 1 "has exactly 7 rows" + Tests 3-4 asserting exact slideshow.pacing_score (0.5) and action multipliers (all ≥1.0).

## Decisions Made

- **Used z.infer-derived Wave0Result over `interface extends`**: Single source of truth (the Zod schema), runtime validation available for free in Plan 04-02 detectors. Existing `{content_type: null, niche: null}` literals (factories.ts:257, wave0.ts:20) still type-check because both fields are `.nullable()`.
- **PersonaMix kept simple (`{archetype: string; weight: number}`)**: Followed RESEARCH Topic #6 — Phase 7 can layer richer fields (gender, generation, interest_strength) without touching the taxonomy data shape. Archetype-as-string-with-vocabulary-prefix gives Phase 7 a stable wire format.
- **Persona/benchmark mappings copied verbatim from RESEARCH Topics #6 + #7**: No deviations from the [ASSUMED] starting values. Phase 7/8 may refine based on simulation/retrieval evidence.
- **min_corpus_size set per niche based on corpus density expectations**: 15 for sparse niches (education, tech-gadgets), 20 default, 25 for comedy (high corpus volume on TikTok).

## Deviations from Plan

None — plan executed exactly as written. All Task 1/2/3 acceptance criteria met:

- Task 1: 8 grep assertions all pass; stubs.test.ts green; SignalAvailability now has 7 keys; Wave0Result is z.infer-derived (old interface deleted).
- Task 2: 6 grep assertions all pass; 12/12 tests passing in content-type-weights.test.ts.
- Task 3: 8 grep assertions all pass; 18/18 tests passing in taxonomy.test.ts (12 existing + 6 new).

## Expected Cascading TypeScript Errors (Plan 04-03 will resolve)

As explicitly anticipated in the plan body, the SignalAvailability widening triggers TypeScript errors at 8 consumer sites (aggregator.ts:289 + 7 sites in aggregator.test.ts that pass SignalAvailability literals). These are the "ENGINE-WIDE build is expected and EXPLICITLY ACCEPTABLE" failures — Plan 04-03 adds `content_type` + `niche` keys to those literals. No action needed in 04-01.

Baseline pre-existing TypeScript errors: 933 (from video-e2e.test.ts vitest import issues, pipeline.ts CreatorContext mismatch). Post-Plan-04-01 count: 941 (Δ +8 from SignalAvailability widening — all expected). No regressions in unrelated modules.

## Issues Encountered

None. Dev environment required `pnpm install` on first run (node_modules absent in fresh worktree) — resolved immediately, not a code issue.

## User Setup Required

None — no external service configuration changes.

## Next Phase Readiness

**Ready for Plan 04-02 (detectors):**
- Import `Wave0ContentTypeResult`, `Wave0NicheResult`, `ContentTypeSlug`, plus matching Zod schemas from `@/lib/engine/types`
- Import `applyContentTypeWeights` + `CONTENT_TYPE_WEIGHT_MATRIX` from `@/lib/engine/wave0/content-type-weights`
- Use `NICHE_TREE` primaries' personas + benchmark_filters fields directly (typed via extended NichePrimary)

**Ready for Plan 04-03 (orchestration):**
- Wave0Result is fully typed; aggregator.ts:289 literal needs `content_type` + `niche` keys added (Plan 04-03 Task 1)
- Eval-harness reads `signal_availability.content_type` + `.niche` via standard JSONB column path — no migration needed (Phase 3 forward-compat preserved)

**No blockers.**

## Self-Check: PASSED

- Created files: `src/lib/engine/wave0/content-type-weights.ts` ✓ FOUND, `src/lib/engine/__tests__/content-type-weights.test.ts` ✓ FOUND
- Modified files: `src/lib/engine/types.ts` ✓, `src/lib/niches/taxonomy.ts` ✓, `src/lib/niches/__tests__/taxonomy.test.ts` ✓
- Commits: 67ae7fb ✓, f559abb ✓, b268902 ✓, bc806a8 ✓, 2a033c9 ✓ — all 5 present in git log
- Tests: 39/39 passing (12 content-type-weights + 18 taxonomy + 9 stubs)
- Plan acceptance criteria: 8 + 6 + 8 = 22/22 grep assertions match expected counts

---
*Phase: 04-wave-0-content-type-niche-detection*
*Completed: 2026-05-18*
