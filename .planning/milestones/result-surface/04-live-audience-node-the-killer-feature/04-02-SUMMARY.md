---
phase: 04-live-audience-node-the-killer-feature
plan: 02
subsystem: engine-types + client-aggregator + audience-constants
tags: [types, pure-functions, constants, client-safe, parity-tested]
dependency_graph:
  requires: [04-01]
  provides: [weighted-aggregator-client, audience-types, audience-constants, slot_type-on-payload]
  affects: [04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11]
tech_stack:
  added: []
  patterns: [pure-function-port, interface-first, client-server-parity]
key_files:
  created:
    - src/lib/engine/wave3/weighted-aggregator-client.ts
    - src/components/board/audience/audience-types.ts
    - src/components/board/audience/audience-constants.ts
  modified:
    - src/lib/engine/types.ts
    - src/lib/engine/wave3/weighted-aggregator.ts
    - src/components/board/audience/__tests__/fixtures/heatmap-fixture.ts
    - src/lib/engine/__tests__/anti-virality.test.ts
    - src/lib/engine/wave3/__tests__/weighted-aggregator-client.test.ts
decisions:
  - slot_type added as non-optional field to HeatmapPayload.personas[] (Option A from RESEARCH OQ-1)
  - weighted_completion_pct uses per-persona mean formula (matches server exactly, not simplified mean-of-curve)
  - niche_deep guard uses string cast to silence TS overlap error since slot_type is already narrowly typed
metrics:
  duration: ~15 minutes
  completed: "2026-05-27"
  tasks_completed: 3
  files_changed: 8
---

# Phase 04 Plan 02: Engine Type Contract + Client Helpers Summary

Wave 1 foundation: locked the interface surface before Wave 2 component plans start.

**One-liner:** slot_type added to HeatmapPayload.personas[], pure client-safe weighted-curve helpers ported with numerical parity, audience-local types+constants defined as single source of truth.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend HeatmapPayload.personas[] with slot_type | 9bf7758 | types.ts, weighted-aggregator.ts, heatmap-fixture.ts, anti-virality.test.ts |
| 2 | weighted-aggregator-client.ts pure-function port | b8e09e7 | weighted-aggregator-client.ts, weighted-aggregator-client.test.ts |
| 3 | audience-types.ts + audience-constants.ts | 77b6112 | audience-types.ts, audience-constants.ts (+ fixes to Task 2 files) |

## Verification Results

- `npx vitest run src/lib/engine/wave3/__tests__/weighted-aggregator-client.test.ts` — 4 tests passed
- `npx vitest run src/lib/engine/__tests__/weighted-aggregator.test.ts` — 9 tests passed (no Phase 3 regressions)
- `npx vitest run src/lib/engine/__tests__/anti-virality.test.ts` — 16 tests passed
- `npx tsc --noEmit` — 0 errors in files modified by this plan; 27 pre-existing errors in unrelated files (react-konva, ffmpeg-static, missing deps) remain unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed anti-virality test fixture missing slot_type**
- **Found during:** Task 1 — after adding non-optional slot_type to HeatmapPayload.personas[], the anti-virality test's inline fixture builder was missing the field
- **Fix:** Added slot_type assignment using PERSONA_SLOT_ORDER pattern (modulo 10 index)
- **Files modified:** src/lib/engine/__tests__/anti-virality.test.ts
- **Commit:** 9bf7758

**2. [Rule 1 - Bug] Fixed TypeScript errors in weighted-aggregator-client.ts**
- **Found during:** Task 3 tsc check — `PersonaWeights` cast to `Record<string,number>` needed `unknown` intermediate, niche_deep comparison on narrowly-typed field needed string cast
- **Fix:** Added `as unknown as Record<string,number>` and `(p.slot_type as string) === 'niche_deep'`
- **Files modified:** src/lib/engine/wave3/weighted-aggregator-client.ts
- **Commit:** 77b6112

**3. [Rule 1 - Bug] Fixed test fixture visual_event undefined coercion**
- **Found during:** Task 3 tsc check — HeatmapPayload `segment.label` is `string | undefined` but SegmentGrid `visual_event` requires `string`
- **Fix:** Added `?? ''` null coalesce in test fixture
- **Files modified:** src/lib/engine/wave3/__tests__/weighted-aggregator-client.test.ts
- **Commit:** 77b6112

## Key Decisions Made

1. **slot_type as non-optional** — Added as required field (not optional) to enforce contract at every consumer. All existing fixtures updated accordingly. No backwards-compat concern since Phase 4 is new code.
2. **weighted_completion_pct formula** — Used the per-persona-mean formula (matches server exactly) rather than the simplified `mean(weighted_curve) * 100` from the plan action block. The plan's behavior block says "numerical parity vs server buildWeightedCurve" — parity takes precedence over the simplified formula.
3. **niche_deep guard defensive cast** — Plan requires the guard on client as a defensive measure even though `slot_type` on `HeatmapPayload.personas[]` is already typed without `niche_deep`. Used string cast to preserve the intent without breaking TypeScript strict mode.

## Known Stubs

None — this plan ships pure types, constants, and math. No UI rendering, no data sources.

## Threat Flags

None — slot_type is a non-PII archetype tag (T-04-05: accept disposition in plan threat model). No new network endpoints or trust boundaries.

## Self-Check: PASSED

- weighted-aggregator-client.ts: FOUND
- audience-types.ts: FOUND
- audience-constants.ts: FOUND
- Commit 9bf7758 (Task 1): FOUND
- Commit b8e09e7 (Task 2): FOUND
- Commit 77b6112 (Task 3): FOUND
