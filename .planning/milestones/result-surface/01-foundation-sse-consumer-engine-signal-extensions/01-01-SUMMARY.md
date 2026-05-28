---
phase: 01-foundation-sse-consumer-engine-signal-extensions
plan: 01
subsystem: testing
tags:
  - vitest
  - playwright
  - test-scaffolding
  - sse
  - fixtures
  - tdd-enabler

# Dependency graph
requires:
  - phase: (none — first wave of Phase 01)
    provides: StageEvent union, PredictionResult interface (consumed unmodified)
provides:
  - "Canonical STAGE_EVENT_SEQUENCE + encodeSSE + STARTED_EVENT fixtures (src/test/fixtures/stage-events.ts)"
  - "Canonical COMPLETED_PREDICTION + IN_FLIGHT_ROW fixtures (src/test/fixtures/completed-prediction.ts) with Phase1AdditiveFields forward-compat shape"
  - "11 vitest test stub files + 1 Playwright e2e spec resolving every Wave 1+ MISSING test gate"
  - "63 it.todo entries + 3 test.fixme entries downstream plans replace with real assertions"
affects:
  - 01-02 (SSE consumer hook + reconnect — fills use-analysis-stream*.test.tsx)
  - 01-03 (stream-by-id route — fills stream-route.test.ts + route-started-event.test.ts)
  - 01-04 (emotion arc — fills omni-analysis-emotion-arc.test.ts)
  - 01-05 (optimal-post window — fills optimal-post + aggregator-optimal-post tests)
  - 01-06 (anti-virality threshold — fills anti-virality + aggregator-anti-virality tests)
  - 01-07 (panel-mapping + ResultCard — fills panel-mapping.test.ts + result-card.test.tsx)
  - 01-08 (e2e — fills result-surface-stream.spec.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forward-compat fixture typing via local intersection (Phase1AdditiveFields) to satisfy TS before downstream plans promote fields onto canonical interface"
    - "it.todo placeholder convention for cross-plan Wave 0 scaffolding"
    - "Vitest happy-dom pragma as line-comment (`// @vitest-environment happy-dom`) co-existing with existing block-comment pragma — both forms accepted by Vitest"

key-files:
  created:
    - src/test/fixtures/stage-events.ts
    - src/test/fixtures/completed-prediction.ts
    - src/hooks/queries/__tests__/use-analysis-stream.test.tsx
    - src/hooks/queries/__tests__/use-analysis-stream-reconnect.test.tsx
    - src/app/api/analyze/__tests__/stream-route.test.ts
    - src/app/api/analyze/__tests__/route-started-event.test.ts
    - src/lib/engine/__tests__/panel-mapping.test.ts
    - src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts
    - src/lib/engine/__tests__/aggregator-optimal-post.test.ts
    - src/lib/engine/__tests__/optimal-post.test.ts
    - src/lib/engine/__tests__/anti-virality.test.ts
    - src/lib/engine/__tests__/aggregator-anti-virality.test.ts
    - src/app/(app)/analyze/__tests__/result-card.test.tsx
    - e2e/result-surface-stream.spec.ts
  modified: []

key-decisions:
  - "Phase1AdditiveFields intersection on COMPLETED_PREDICTION fixture — keeps the fixture compiling against the current PredictionResult interface while pre-locking the field shapes Plans 04/05/06 will promote onto the canonical type. Cleaner than `as any` and gives downstream plans an importable type for the additive surface."
  - "Both STARTED_EVENT (value) and STARTED_EVENT_TYPE (string-literal const) exported from stage-events.ts. Plan's verbatim code block requires both; the literal grep in the acceptance criteria conflicts with that requirement (see deviations). Functional intent — STARTED_EVENT is exported — is met."

patterns-established:
  - "Phase1AdditiveFields intersection — fixture authors declare additive interface fields in the fixture file when canonical interface lags behind; downstream plans promote the type once they ship the runtime field."
  - "Stub-first test scaffolding via it.todo — Wave 0 plan creates every test file; Wave 1+ plans replace .todo with assertions. Resolves the Nyquist MISSING-test gate without producing failing tests during scaffolding."

requirements-completed:
  - R2.1
  - R6.1
  - R1.7
  - R1.9

# Metrics
duration: 5min
completed: 2026-05-24
---

# Phase 01 Plan 01: Test scaffolding + canonical fixtures Summary

**14 Wave-0 scaffolding files (2 fixtures + 11 vitest stubs + 1 Playwright e2e) seeded with 63 it.todo placeholders + STAGE_EVENT_SEQUENCE / COMPLETED_PREDICTION canonical exports — resolves every downstream Plan 01-02..01-08 MISSING test gate before Wave 1 starts.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-24T09:02:17Z
- **Completed:** 2026-05-24T09:08:00Z (approx)
- **Tasks:** 2 / 2
- **Files created:** 14
- **Files modified:** 0

## Accomplishments

- `src/test/fixtures/stage-events.ts` — STAGE_EVENT_SEQUENCE (8-event canonical sequence covering wave_1, wave_2, wave_3_personas, aggregator), STARTED_EVENT + StartedEvent interface, encodeSSE helper, 4 event-type string-literal constants (COMPLETE/STARTED/STAGE/PHASE), COMPLETE_EVENT alias.
- `src/test/fixtures/completed-prediction.ts` — COMPLETED_PREDICTION (terminal-state PredictionResult with all Phase 1 additive fields populated), IN_FLIGHT_ROW (placeholder row shape for Pitfall #3 stream-skip test), Phase1AdditiveFields interface for forward-compat typing.
- 2 hook stub files (use-analysis-stream + reconnect) with happy-dom pragma and 14 it.todo entries covering D-02 / D-03 / D-05 contract surface.
- 2 API route stub files (stream-route + route-started-event) covering D-04 GET endpoint + Pitfall #6 placeholder-row flow.
- 6 engine stub files (panel-mapping, omni-emotion-arc, aggregator-optimal-post, optimal-post, anti-virality, aggregator-anti-virality) covering D-05 / D-06 / D-13 / D-15 / R1.7 / R1.9 surface.
- 1 ResultCard stub (happy-dom) covering D-11 SSR-shell + skeleton-scaffold + initialData behavior.
- 1 Playwright e2e spec with 3 test.fixme entries (submit→stream→complete, reconnect→poll, completed-URL replay).

## Files Created/Modified

**Created (14):**

- `src/test/fixtures/stage-events.ts` (45 lines) — canonical SSE fixtures
- `src/test/fixtures/completed-prediction.ts` (91 lines) — canonical PredictionResult fixtures + Phase1AdditiveFields
- `src/hooks/queries/__tests__/use-analysis-stream.test.tsx` (8 it.todo, happy-dom)
- `src/hooks/queries/__tests__/use-analysis-stream-reconnect.test.tsx` (6 it.todo, happy-dom)
- `src/app/api/analyze/__tests__/stream-route.test.ts` (10 it.todo, node)
- `src/app/api/analyze/__tests__/route-started-event.test.ts` (4 it.todo, node)
- `src/lib/engine/__tests__/panel-mapping.test.ts` (6 it.todo, node)
- `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` (5 it.todo, node)
- `src/lib/engine/__tests__/aggregator-optimal-post.test.ts` (4 it.todo, node)
- `src/lib/engine/__tests__/optimal-post.test.ts` (5 it.todo, node)
- `src/lib/engine/__tests__/anti-virality.test.ts` (4 it.todo, node)
- `src/lib/engine/__tests__/aggregator-anti-virality.test.ts` (4 it.todo, node)
- `src/app/(app)/analyze/__tests__/result-card.test.tsx` (7 it.todo, happy-dom)
- `e2e/result-surface-stream.spec.ts` (3 test.fixme, Playwright)

**Modified:** none.

## Decisions Made

- **Phase1AdditiveFields intersection** on COMPLETED_PREDICTION fixture. The canonical PredictionResult in `src/lib/engine/types.ts` does not yet declare `optimal_post_window`, `emotion_arc`, or `anti_virality_gated` — those are added by Plans 04, 05, 06. The fixture author has two options: (a) cast with `as any` and lose typing entirely, or (b) intersect a local `Phase1AdditiveFields` interface that locks the shape now and is later promoted onto PredictionResult by the field-owning plan. Picked (b) so downstream tests get type-safe access from day 1.
- **Both STARTED_EVENT and STARTED_EVENT_TYPE exported** from stage-events.ts. The plan's verbatim code block declares both names. Acceptance criteria grep (`grep -c "export const STARTED_EVENT"` returns 1) is inconsistent with that — substring match returns 2 because `STARTED_EVENT_TYPE` also matches. Resolved by keeping both constants (functional intent is met; the grep is the inconsistency) and documenting in deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Symlinked node_modules from parent worktree for verification commands**

- **Found during:** Task 1 verification (`npx vitest run src/test/fixtures`)
- **Issue:** Fresh worktree has no `node_modules/`. Plan's verify block calls `npx vitest run` + `npx tsc --noEmit` which require the dependency tree. pnpm `npx vitest` resolves to "Command not found".
- **Fix:** `ln -s ~/virtuna-v1.1/node_modules node_modules` inside worktree root. `node_modules` is gitignored, so the symlink does not pollute the commit history.
- **Files modified:** none committed (symlink only)
- **Verification:** `./node_modules/.bin/vitest run src/test/fixtures` resolves, `./node_modules/.bin/tsc --noEmit -p tsconfig.json` runs (only pre-existing `@google/genai` errors surface, unrelated to fixtures).

**2. [Rule 2 — Forward-Compat Typing] COMPLETED_PREDICTION uses Phase1AdditiveFields intersection**

- **Found during:** Task 1 implementation
- **Issue:** Plan's verbatim code block types COMPLETED_PREDICTION as `Partial<PredictionResult> & { overall_score: number }` then assigns `optimal_post_window`, `emotion_arc`, `anti_virality_gated`. These keys do not exist on the current PredictionResult interface (added by Plans 04, 05, 06). `Partial<T>` rejects unknown keys → fixture would fail tsc.
- **Fix:** Added `Phase1AdditiveFields` interface declaring the three additive fields exactly as Plans 04/05/06 will declare them on the canonical type. Fixture type becomes `Partial<PredictionResult> & Phase1AdditiveFields & { overall_score: number }`. Field-owning plans then promote each field onto PredictionResult and the fixture stops needing the intersection.
- **Files modified:** src/test/fixtures/completed-prediction.ts (committed in c29d5a0)
- **Verification:** `tsc --noEmit` no longer reports fixture errors (only the pre-existing `@google/genai` import error unrelated to this plan).
- **Future impact:** Plans 04 / 05 / 06 should reuse `Phase1AdditiveFields` (or copy its field declarations verbatim) when promoting the fields onto PredictionResult to keep the canonical type aligned.

### Plan-Acceptance Grep Inconsistency (no code change, documented for downstream consumers)

**3. `grep -c "export const STARTED_EVENT"` returns 2, not 1, as declared in acceptance criteria**

- **Found during:** Task 1 verification
- **Cause:** Plan's verbatim code block (Task 1 action section) exports both `STARTED_EVENT` (the value) and `STARTED_EVENT_TYPE` (a string-literal constant). Plain `grep -c` substring-matches both, returning 2.
- **Resolution:** Kept both constants — both are referenced by downstream tests (STARTED_EVENT is the value to compare against in route-started-event.test.ts; STARTED_EVENT_TYPE is the event-type literal for SSE frame parsing in stream-route + use-analysis-stream tests). The acceptance grep is the inconsistency, not the code.
- **Suggested grep refinement for future plans:** `grep -c "^export const STARTED_EVENT:"` (colon anchor) returns exactly 1.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 forward-compat) + 1 acceptance-grep inconsistency (no code change).
**Impact on plan:** All work matches the plan's functional intent. Phase1AdditiveFields keeps downstream fill-in tasks type-safe. No scope creep.

## Issues Encountered

- Vitest fails when invoked with `--reporter=basic` due to a Vitest 4.0.18 + custom-reporter loader resolution quirk in pnpm-wrapped node_modules. Worked around by dropping `--reporter=basic` from the verify run — default reporter produces the same Test Files / Tests / todo summary lines the acceptance grep matches.

## Stub Tracking

All 11 vitest test files + 3 Playwright test bodies are intentional `it.todo()` / `test.fixme()` placeholders — this is the plan's explicit deliverable. The fixture files (`stage-events.ts`, `completed-prediction.ts`) contain real data, not stubs. No unintended stubs surfaced.

## Threat Flags

None. Plan's threat register declares the only relevant threat (T-01-FIX-01 — fixture data is synthetic, accepted). No new network endpoints, auth paths, or schema changes introduced by this scaffolding.

## TDD Gate Compliance

Plan type is `execute` (not `tdd`), so the RED/GREEN/REFACTOR commit triplet does not apply. Both commits use the `test(01-01): ...` prefix per task content (scaffolding tests), satisfying the conventional-commits convention.

## Self-Check

- ✓ `src/test/fixtures/stage-events.ts` — FOUND
- ✓ `src/test/fixtures/completed-prediction.ts` — FOUND
- ✓ `src/hooks/queries/__tests__/use-analysis-stream.test.tsx` — FOUND
- ✓ `src/hooks/queries/__tests__/use-analysis-stream-reconnect.test.tsx` — FOUND
- ✓ `src/app/api/analyze/__tests__/stream-route.test.ts` — FOUND
- ✓ `src/app/api/analyze/__tests__/route-started-event.test.ts` — FOUND
- ✓ `src/lib/engine/__tests__/panel-mapping.test.ts` — FOUND
- ✓ `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` — FOUND
- ✓ `src/lib/engine/__tests__/aggregator-optimal-post.test.ts` — FOUND
- ✓ `src/lib/engine/__tests__/optimal-post.test.ts` — FOUND
- ✓ `src/lib/engine/__tests__/anti-virality.test.ts` — FOUND
- ✓ `src/lib/engine/__tests__/aggregator-anti-virality.test.ts` — FOUND
- ✓ `src/app/(app)/analyze/__tests__/result-card.test.tsx` — FOUND
- ✓ `e2e/result-surface-stream.spec.ts` — FOUND
- ✓ Commit `c29d5a0` — FOUND (test(01-01): add canonical stage-event + completed-prediction fixtures)
- ✓ Commit `34f6872` — FOUND (test(01-01): stub 11 vitest + 1 playwright placeholder files for Phase 1 Wave 1+)

## Self-Check: PASSED

## Next Phase Readiness

- All 12 test stub files exist; downstream Wave 1+ plans (01-02 through 01-08) can replace `it.todo()` with assertions without creating new files.
- Canonical fixtures unblock every hook + route + engine test that imports STAGE_EVENT_SEQUENCE / encodeSSE / COMPLETED_PREDICTION / IN_FLIGHT_ROW / STARTED_EVENT.
- Phase1AdditiveFields intersection gives Plans 04/05/06 a typed shape to mirror when promoting the additive fields onto PredictionResult.
- No blockers for Wave 1.

---
*Phase: 01-foundation-sse-consumer-engine-signal-extensions*
*Plan: 01 (Wave 1 — Test Scaffolding)*
*Completed: 2026-05-24*
