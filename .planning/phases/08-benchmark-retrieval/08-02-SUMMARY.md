---
phase: 08-benchmark-retrieval
plan: 02
subsystem: types
tags: [types, zod, schemas, contracts, pgvector, retrieval, interfaces]

# Dependency graph
requires:
  - phase: 03-pipeline-infrastructure
    provides: SignalAvailability interface (D-07 forward-compat) — extended here with retrieval key
  - phase: 04-wave-0-content-type-niche-detection
    provides: SignalAvailability.content_type + niche keys — Phase 8 retrieval key follows the same additive pattern
provides:
  - RetrievalEvidenceItemSchema (Zod) + RetrievalEvidenceItem type — D-02 10-field shape for "similar videos" panel
  - BenchmarkRetrievalResultSchema (Zod) + BenchmarkRetrievalResult type — return shape of runBenchmarkRetrieval
  - SignalAvailability.retrieval boolean (D-10) — provenance gate for retrieval signal
  - PredictionResult.retrieval_score (number | null) + PredictionResult.retrieval_evidence (RetrievalEvidenceItem[]) (D-11)
  - PredictionResult.score_weights.retrieval (number) (D-03b) — aggregator weight key
affects: [08-03-embedder, 08-03-bucket-derivation, 08-03-pgvector-client, 08-04-retrieval-stage, 08-04-pipeline, 08-04-aggregator, 08-05-evaluation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 8 Zod schema block placed after BehavioralPredictionsSchema, mirrors Wave0NicheResultSchema source-tagged enum pattern"
    - "Interface-first contract definition — types land BEFORE any downstream implementation in Plans 03-05"
    - "Cross-plan TS error as intentional gate — aggregator.ts + aggregator.test.ts missing retrieval key is the Plan 04 close-out signal"

key-files:
  created: []
  modified:
    - src/lib/engine/types.ts (+56 lines: 2 schemas, 2 types, 1 interface key, 2 PredictionResult fields, 1 score_weights key)

key-decisions:
  - "Schema insertion point: after BehavioralPredictionsSchema (line 352) under new Phase 8 section header — keeps all Zod schemas grouped"
  - "score_weights.retrieval added as bare 'number' (no default literal) — actual 0.05 default lives in aggregator.ts SCORE_WEIGHTS constant per D-03b, set by Plan 04"
  - "Field order on SignalAvailability preserved: original Phase 3 keys → Phase 4 keys (content_type/niche) → Phase 8 (retrieval) for diff readability"
  - "PredictionResult.retrieval_score + retrieval_evidence placed AFTER signal_availability per plan instruction (end of interface, grouped with single Phase 8 comment)"

patterns-established:
  - "Zod schema + z.infer<typeof X> type alias pattern — consistent with BehavioralPredictionsSchema, Wave0NicheResultSchema"
  - "Bucket label vocabulary 'viral' | 'average' | 'under' — locked at the type level via z.enum, load-bearing for Plan 03 deriveBucket()"
  - "Relaxation tag vocabulary 'strict' | 'niche+platform' | 'niche_only' — locked at the type level, load-bearing for Plan 04 hierarchical relaxation"
  - "Provenance vocabulary 'corpus' | 'derived' (bucket_source) — distinguishes labeled training_corpus rows from threshold-derived scraped_videos rows"

requirements-completed: [RETRIEVAL-05]

# Metrics
duration: 4min
completed: 2026-05-18
---

# Phase 8 Plan 02: types.ts extension — Zod schemas + interfaces Summary

**Phase 8 retrieval contracts locked in `src/lib/engine/types.ts`: 2 new Zod schemas, 2 new TS types, 3 extended interfaces — Plans 03-05 now import a stable shape for `RetrievalEvidenceItem`, `BenchmarkRetrievalResult`, `SignalAvailability.retrieval`, and `PredictionResult.{retrieval_score, retrieval_evidence, score_weights.retrieval}`.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-18T19:09:02Z
- **Completed:** 2026-05-18T19:13:17Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `RetrievalEvidenceItemSchema` (16 fields per D-02 — exact shape M2's "similar videos" panel reads without DB joins) and its inferred TS type
- Added `BenchmarkRetrievalResultSchema` (4 fields — `evidence` max 5, `score` nullable [0,1], `availability` bool, `cost_cents` nonneg) and its inferred TS type
- Extended `SignalAvailability` with `retrieval: boolean` (D-10) — provenance gate for the new signal
- Extended `PredictionResult` with `retrieval_score: number | null` + `retrieval_evidence: RetrievalEvidenceItem[]` (D-11) — top-level outputs of the retrieval stage
- Extended `PredictionResult.score_weights` with `retrieval: number` (D-03b) — aggregator weight key, default 0.05 to be set by Plan 04 in `aggregator.ts` SCORE_WEIGHTS
- `types.ts` itself has zero TS errors; all 762 existing tests still pass (BENCH-05 — no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RetrievalEvidenceItem + BenchmarkRetrievalResult Zod schemas** — `b0cd171` (feat)
2. **Task 2: Extend SignalAvailability + PredictionResult + score_weights interface** — `e9307fa` (feat)

## Files Created/Modified
- `src/lib/engine/types.ts` — +56 lines additive. New `Phase 8 — Benchmark Retrieval (pgvector) Schemas` section header after `DeepSeekReasoning` containing both new Zod schemas + types. Three precise edits inside existing `SignalAvailability` (line ~206) and `PredictionResult` (line ~187) interfaces.

## Decisions Made

- **Schema location**: Placed Phase 8 schemas after `BehavioralPredictionsSchema` / `DeepSeekResponseSchema` under a new `// Phase 8 — Benchmark Retrieval (pgvector) Schemas` header instead of immediately before `SignalAvailability` (line ~198). Keeps all Zod schemas grouped together in the file; section header documents the D-rules covered. The plan's "before SignalAvailability" hint was a positional approximation — Zod block cohesion is the stronger pattern.
- **score_weights.retrieval typed as bare `number`** (no comment-embedded default value) so the runtime default lives in exactly one place: `aggregator.ts` SCORE_WEIGHTS table (set by Plan 04 per D-03b). Type signature stays neutral to weight redistribution.
- **No regression to existing 762-test suite** despite 13 new TypeScript errors in `aggregator.ts` + `aggregator.test.ts` — those are the EXPECTED cross-plan signals (literal `SignalAvailability` objects missing the new `retrieval` key) that Plan 04 must close. Vitest still executes the affected tests because the missing key only matters at compile-time, not runtime.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<done>` note for Task 2 explicitly anticipated the 13 new TS errors in `aggregator.ts` + `aggregator.test.ts` ("EXPECTED cross-plan signal that Plan 04 must close"). These are not deviations — they are the intentional compile-time gate that forces Plan 04 to update its `SignalAvailability` literals.

**Total deviations:** 0
**Impact on plan:** Zero scope creep — pure interface-first contract addition exactly as planned.

## Issues Encountered

- **`pnpm tsc` not directly invokable** — the project has no `typecheck` script and the `tsc` binary wasn't in `node_modules/.bin/` because dependencies weren't installed in this fresh worktree. Resolved by running `pnpm install --frozen-lockfile` (already in plan-implicit setup) and then `npx tsc --noEmit`. Documented for future executors landing in unprovisioned worktrees.
- **Pre-existing TS errors in unrelated files** (~966 baseline errors in `src/app/api/profile/*`, `src/app/api/team/*`, etc., from `user_settings` / `team_members` tables not present in current Supabase types) are PRE-EXISTING and out of scope per the Scope Boundary rule. Logged here for transparency only.

## Threat Flags

None — no new security-relevant surface introduced. Threat model T-08-07 (JSONB shape drift) is mitigated by `RetrievalEvidenceItemSchema` becoming the single source of truth; T-08-09 (SignalAvailability contract) is mitigated by the added `retrieval: boolean` becoming a compile-time gate (which is exactly what trips the 13 new errors and forces Plan 04 to populate the key — working as designed).

## User Setup Required

None - no external service configuration required for this plan.

## Carry-forward to Plans 03-05

- **Plan 03 (embedder + bucket-derivation + pgvector-client)** imports `RetrievalEvidenceItem` from `src/lib/engine/types.ts` for the pgvector RPC return shape and `BenchmarkRetrievalResult` for the stage return signature. The locked `bucket_label` + `bucket_source` enums constrain `deriveBucket()`'s return type at the type level.
- **Plan 04 (retrieval-stage + pipeline.ts + aggregator.ts)** imports both new schemas + types, AND will MUST close the 13 cross-plan TS errors by:
  1. Adding `retrieval: <bool>` to every `SignalAvailability` literal in `aggregator.ts` (line 330 — the `availability` return object) and in `aggregator.test.ts` (~11 test fixtures).
  2. Adding `retrieval: 0.05` to the `SCORE_WEIGHTS` literal in `aggregator.ts` (line 536) and proportionally redistributing existing weights ×0.95 per D-03b.
  3. Wiring `pipelineResult.retrievalResult.score` + `.evidence` into the `PredictionResult` assembly in `pipeline.ts` (line ~519).
- **Plan 05 (evaluation harness)** imports `RetrievalEvidenceItem` to assert retrieval-evidence shape in eval test fixtures.

## Self-Check: PASSED

- File exists: `src/lib/engine/types.ts` (modified)
- Commits exist:
  - Task 1 `b0cd171` — `git log` shows `feat(08-02): add RetrievalEvidenceItem + BenchmarkRetrievalResult Zod schemas` ✓
  - Task 2 `e9307fa` — `git log` shows `feat(08-02): extend SignalAvailability + PredictionResult + score_weights for retrieval` ✓
- All 7 success criteria boxes from `<success_criteria>` verified via grep + inspection.
- TypeScript check: `types.ts` itself has 0 errors; 13 EXPECTED cross-plan errors in `aggregator.ts` + `aggregator.test.ts` per plan's `<done>` note.
- Test suite: 762/762 tests passed (4 skipped, 0 failed) — BENCH-05 satisfied.

---
*Phase: 08-benchmark-retrieval*
*Completed: 2026-05-18*
