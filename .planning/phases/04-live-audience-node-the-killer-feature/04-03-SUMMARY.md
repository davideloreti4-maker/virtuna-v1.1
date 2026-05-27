---
phase: "04-live-audience-node-the-killer-feature"
plan: "03"
subsystem: "streaming-hook"
tags: ["sse", "hook", "filmstrip", "phase4", "wave2"]
dependency_graph:
  requires: ["04-01"]
  provides: ["useAnalysisStream().filmstrips"]
  affects: ["04-05-Filmstrip", "04-07-choreography"]
tech_stack:
  added: []
  patterns: ["functional-state-updater", "discriminated-union-narrowing"]
key_files:
  modified:
    - src/hooks/queries/use-analysis-stream.ts
    - src/app/(app)/analyze/__tests__/result-card.test.tsx
  created:
    - src/hooks/queries/__tests__/use-analysis-stream.filmstrips.test.ts
decisions:
  - "filmstrip_segment_ready handled as a stage-type event (branch in existing stage dispatch block), not a new top-level eventType — matches Phase 3 server emission pattern"
  - "filmstrips reset only on start(), not on reconnect() — segments delivered before drop must persist across reconnect"
  - "result-card.test.tsx mock patched with filmstrips: {} to maintain TS correctness (Rule 1 fix)"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-27T13:35:36Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 2
  files_created: 1
---

# Phase 04 Plan 03: filmstrip_segment_ready dispatch + filmstrips return key — Summary

**One-liner:** Additive extension to the Phase 1 shared SSE hook that routes `filmstrip_segment_ready` stage events into a live `filmstrips: Record<number, string>` map returned as the 10th key.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dispatch filmstrip_segment_ready + expose filmstrips in return | a2bb480 | use-analysis-stream.ts, filmstrips.test.ts, result-card.test.tsx |

## What Was Built

Extended `useAnalysisStream` (single-file additive change) to:

1. Declare `const [filmstrips, setFilmstrips] = useState<Record<number, string>>({})` alongside existing partial state
2. In the `dispatch` `useCallback`, after the existing `pass2_persona_end` branch, add `filmstrip_segment_ready` handler using type-narrowed `ev.type` check (no `as` cast) — TypeScript narrows to `{ segment_idx: number; keyframe_uri: string }` from the StageEvent union
3. Reset `filmstrips` to `{}` inside `mutationFn` alongside `setStages([])` and `setError(null)` on new analysis start
4. Preserve `filmstrips` in `reconnect()` — no reset (comment added: "preserve filmstrips across reconnect")
5. Add `filmstrips: Record<number, string>` as final field of `AnalysisStreamReturn` interface with JSDoc
6. Include `filmstrips` in hook return object

## Tests

New test file `use-analysis-stream.filmstrips.test.ts` with 4 `it()` blocks:
- Initial `filmstrips` is `{}`
- Single `filmstrip_segment_ready` event → `filmstrips[3] === 'https://example.com/k3.jpg'`
- Multiple events accumulate (segment 3 + 5 → both present, others undefined)
- `start()` resets to `{}`

All 17 tests pass (4 new + 7 existing + 6 reconnect).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed result-card.test.tsx mock missing filmstrips key**
- **Found during:** Task 1 TypeScript check
- **Issue:** `result-card.test.tsx` line 119 mocks `AnalysisStreamReturn` inline without `filmstrips` field — TS2345 after interface extension
- **Fix:** Added `filmstrips: {}` to the mock object
- **Files modified:** `src/app/(app)/analyze/__tests__/result-card.test.tsx`
- **Commit:** a2bb480 (included in same commit)

## Known Stubs

None — plan is fully wired. The `filmstrips` map is populated live from SSE; Phase 4 Plan 04-05 (Filmstrip component) will consume `useAnalysisStream().filmstrips` to swap placeholder cells to `<img>` elements.

## Threat Flags

None — `filmstrip_segment_ready` events were already in the threat model (T-04-06, T-04-07). No new network endpoints or auth paths introduced.

## Self-Check: PASSED

- `src/hooks/queries/use-analysis-stream.ts` — FOUND
- `src/hooks/queries/__tests__/use-analysis-stream.filmstrips.test.ts` — FOUND
- `src/app/(app)/analyze/__tests__/result-card.test.tsx` — FOUND
- Commit a2bb480 — FOUND
- 17/17 tests pass
- TS errors: 27 (down from 28 pre-change) — no new errors introduced
