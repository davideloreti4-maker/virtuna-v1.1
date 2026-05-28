---
phase: "04-live-audience-node-the-killer-feature"
plan: "04"
subsystem: "choreography-hook"
tags: ["hook", "state-machine", "sse", "animation", "a11y", "anti-virality", "phase4", "wave3"]
dependency_graph:
  requires: ["04-02", "04-03"]
  provides: ["useAudienceChoreography"]
  affects: ["04-08-AudienceNode", "04-06-HeatmapDrawer", "04-04-RetentionCurve"]
tech_stack:
  added: []
  patterns: ["merged-effect-state-machine", "test-injection-via-optional-param", "vitest-alias-stub"]
key_files:
  created:
    - src/components/board/audience/use-audience-choreography.ts
    - src/components/board/audience/__tests__/use-audience-choreography.test.ts (was stub)
    - src/components/board/audience/__tests__/use-audience-choreography.streaming.test.ts (was stub)
    - src/__mocks__/detect-gpu.ts
  modified:
    - vitest.config.ts (added @pmndrs/detect-gpu alias)
decisions:
  - "Merged curve state Effects 4+5 into single effect to prevent multi-render race when phase=complete + heatmap present simultaneously at mount"
  - "Extended ARCHETYPE_TO_SLOT with tough_crowd, purposeful_viewer, niche_deep_buyer, niche_deep_scout to match streaming-fixture.ts archetypes"
  - "announce() arg order is (message, politeness) — reversed from plan docs; used correct signature from a11y.ts"
  - "vitest.config.ts alias for @pmndrs/detect-gpu → src/__mocks__/detect-gpu.ts to prevent Vite import-analysis failure (package not installed in worktree)"
metrics:
  duration: "~9 minutes"
  completed: "2026-05-27T13:50:56Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 04 Plan 04: useAudienceChoreography Hook Summary

Wave 3 plan: pure orchestration hook over `useAnalysisStream` that drives the Audience node's live-streaming animation state machine.

**One-liner:** useAudienceChoreography hook orchestrates skeleton row seeding, pass2 row state transitions, curve idle→baseline→morphing→final progression, anti-virality live computation, and aria-live announcements — all with reduced-motion + low-perf-tier jump-cut paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Skeleton emit + row state machine | 1c7c5df | use-audience-choreography.ts, use-audience-choreography.test.ts, detect-gpu.ts, vitest.config.ts |
| 2 | Curve state machine + anti-virality + streaming integration | 4d3068d | use-audience-choreography.ts, use-audience-choreography.streaming.test.ts |

## What Was Built

### useAudienceChoreography hook (`src/components/board/audience/use-audience-choreography.ts`)

Full state machine hook with:

1. **ARCHETYPE_TO_SLOT mapping** — maps 12 archetype variants to their slot_type (fyp/niche/loyalist/cross_niche). Extended beyond plan's 8 to cover fixture archetypes (tough_crowd, purposeful_viewer, niche_deep_buyer, niche_deep_scout).

2. **Skeleton seeding** — `wave_0_complete` detection seeds 10 `slot-0..slot-9` placeholder keys in PERSONA_SLOT_ORDER. Idempotent via `wave0SeededRef`.

3. **Row state machine**:
   - `pass2_persona_start` → scans `stages` array for events, assigns first available slot per slot_type, replaces `slot-N` key with real `persona_id` at `'streaming'` state
   - `pass2_persona_end` → transitions to `'filling'` then schedules `CELL_FILL_WAVE_MS=180ms` timer for `'complete'`; reduced-motion path skips `'filling'` and writes `'complete'` immediately

4. **Curve state machine** (single merged effect):
   - `idle → baseline` on `phase='complete'` + `persona_behavioral_aggregate` truthy
   - `idle/baseline → morphing` when `heatmap` non-null; schedules `CURVE_MORPH_MS=800ms` timer for `'final'`
   - Reduced-motion: `idle → final` directly when heatmap present

5. **Anti-virality** — `useMemo` calling `isAntiViralityGatedFull(result.confidence, result.heatmap)`. `isAntiViralityActive = result.gated`. `isMorphInProgress = curveState === 'morphing'`.

6. **aria-live announcements** (via `announce(message, politeness)` from a11y.ts):
   - `'Reading your audience…'` on streaming start (once)
   - `'Audience analysis ready'` on all rows complete (once)
   - `'Critical drop detected at segments ${idxList}'` on anti-virality active (once per unique idxList)

7. **Timer cleanup** — all `setTimeout` refs tracked in `timersRef` + `morphTimerRef`; both cleared in unmount effect.

8. **Test injection** — accepts optional `stream?: StreamReturn` parameter. Always calls `useAnalysisStream()` internally (Rules of Hooks compliance) but uses injected stream when provided.

### Test infrastructure

- Added `src/__mocks__/detect-gpu.ts` stub + `vitest.config.ts` alias for `@pmndrs/detect-gpu` (not installed in worktree — same pattern as react-konva/konva aliases already present).
- 6 unit tests in `use-audience-choreography.test.ts` (skeleton + row state machine)
- 7 integration tests in `use-audience-choreography.streaming.test.ts` (curve state + anti-virality + E2E STREAMING_FIXTURE)

## Verification Results

- `npx vitest run src/components/board/audience/__tests__/use-audience-choreography*` — 13 tests, 0 failed
- `npx tsc --noEmit` — 0 new errors (27 pre-existing errors unchanged per 04-02 baseline)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `announce()` argument order**
- **Found during:** Implementation — plan docs show `announce('polite', message)` but actual `src/lib/a11y.ts` signature is `announce(message, politeness)`
- **Fix:** Used correct signature `announce('Reading your audience…', 'polite')`
- **Files modified:** use-audience-choreography.ts
- **Commit:** 1c7c5df

**2. [Rule 1 - Bug] Fixed missing archetype variants in ARCHETYPE_TO_SLOT**
- **Found during:** Task 1 — streaming-fixture.ts uses `tough_crowd`, `purposeful_viewer`, `niche_deep_buyer`, `niche_deep_scout` which the plan's map omitted
- **Fix:** Added all 4 missing variants with correct slot_type mappings
- **Files modified:** use-audience-choreography.ts
- **Commit:** 1c7c5df

**3. [Rule 3 - Blocking] Added @pmndrs/detect-gpu vitest alias + mock stub**
- **Found during:** Task 1 test run — Vite's import-analysis transform failed because `@pmndrs/detect-gpu` not installed in worktree, even though `@/lib/perf-tier` was mocked
- **Fix:** Created `src/__mocks__/detect-gpu.ts` stub + added alias to `vitest.config.ts` (same pattern as existing react-konva/konva stubs)
- **Files modified:** vitest.config.ts, src/__mocks__/detect-gpu.ts
- **Commit:** 1c7c5df

**4. [Rule 1 - Bug] Merged curve state Effects 4+5 to prevent multi-render race**
- **Found during:** Task 2 tests — when `phase=complete` + `heatmap` both present at mount, Effect 4 set `curveState='baseline'` and Effect 5 read stale `curveState='idle'`, so baseline→morphing transition never fired in same render
- **Fix:** Merged into single effect that computes full desired state in one cycle (`idle → morphing` directly when both conditions met)
- **Files modified:** use-audience-choreography.ts
- **Commit:** 4d3068d

**5. [Rule 1 - Bug] Fixed `makeResult()` helper ignoring overrides in test**
- **Found during:** Task 2 test run — anti-virality test passed `confidence: 0.35` override but `makeResult()` body didn't spread `overrides`, so confidence stayed 0.85
- **Fix:** Added `...overrides` spread inside `makeResult()` return
- **Files modified:** use-audience-choreography.streaming.test.ts
- **Commit:** 4d3068d

## Known Stubs

None — hook fully implemented. The `curveState = 'idle'` initial value is the correct starting state, not a stub. The hook is ready to be consumed by AudienceNode.tsx (Plan 04-08).

## Threat Flags

None — this plan implements client-side state management only. No new network endpoints or trust boundaries.

## Self-Check

Files created/modified:
- `src/components/board/audience/use-audience-choreography.ts`: FOUND
- `src/components/board/audience/__tests__/use-audience-choreography.test.ts`: FOUND
- `src/components/board/audience/__tests__/use-audience-choreography.streaming.test.ts`: FOUND
- `src/__mocks__/detect-gpu.ts`: FOUND
- `vitest.config.ts`: FOUND

Commits:
- 1c7c5df (Task 1): FOUND
- 4d3068d (Task 2): FOUND

Test results: 13/13 passed, 0 failed

## Self-Check: PASSED
