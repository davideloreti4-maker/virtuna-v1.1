---
phase: 02-board-substrate-navigation
plan: 13
subsystem: board-engine-group
tags: [sse, streaming, engine-stages, aria, auto-pan, camera, tdd, accessibility]

# Dependency graph
requires:
  - phase: 02-board-substrate-navigation (Plan 02)
    provides: GroupFrameOverlay with children slot
  - phase: 02-board-substrate-navigation (Plan 04)
    provides: board-store with camera + state machine
  - phase: 02-board-substrate-navigation (Plan 09)
    provides: animated goToPreset + auto-pan contract
  - phase: 01 (Plan 02)
    provides: useAnalysisStream + StageEvent types
dependency_graph:
  provides:
    - src/components/board/EngineGroup.tsx (5-stage SSE progress, aria-live, collapse)
    - src/components/board/EngineStageGlyph.tsx (per-stage glyph primitive)
    - src/components/board/__tests__/EngineGroup.test.tsx (8 passing tests)
  affects:
    - src/components/board/Board.tsx (EngineGroup mounted + activePreset→goToPreset wired)
    - src/components/board/board-types.ts (CameraPresetKey + 'engine')
    - src/components/board/board-constants.ts (CAMERA_PRESET_TARGETS engine entry)
    - src/components/board/use-camera.ts (VALID_PRESET_KEYS + 'engine')
    - src/components/board/CameraOverlay.tsx (engine key added to records, not user-facing)
    - src/stores/board-store.ts (lastUserInteractionAt + currentStageLabel + transition action)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "deriveEngineStageStatus pure function — StageEvent[] × Stage → EngineStageStatus"
    - "hasWave() discriminated-union guard — pipeline_warning events filtered before wave check"
    - "TDD RED→GREEN: failing test committed before implementation"
    - "activePreset store bridge: EngineGroup sets activePreset, Board.tsx goToPreset subscription"
    - "transition({ type: 'STAGE_UPDATE', stage }) action in board-store for command bar wiring"

key-files:
  created:
    - "src/components/board/EngineGroup.tsx (115 LOC)"
    - "src/components/board/EngineStageGlyph.tsx (44 LOC)"
    - "src/components/board/__tests__/EngineGroup.test.tsx (65 LOC)"
  modified:
    - "src/components/board/Board.tsx (EngineGroup import + mount + activePreset effect)"
    - "src/components/board/board-types.ts (engine added to CameraPresetKey)"
    - "src/components/board/board-constants.ts (engine preset rect)"
    - "src/components/board/use-camera.ts (engine in VALID_PRESET_KEYS)"
    - "src/components/board/CameraOverlay.tsx (engine key in PRESET_LABELS/KEYS)"
    - "src/stores/board-store.ts (lastUserInteractionAt, currentStageLabel, transition)"
    - "src/components/board/__tests__/Board.test.tsx (useAnalysisStream mock)"
    - "src/components/board/__tests__/GroupFrame.test.tsx (useAnalysisStream mock)"

key-decisions:
  - "Wave → preset mapping: waves 0/1 → engine, 2/3 → audience, aggregator → verdict (D-09 aligned)"
  - "deriveEngineStageStatus exported as pure function — Phase 3 can extend with per-persona Pass 2 events"
  - "activePreset store bridge pattern: EngineGroup cannot call goToPreset directly (it lives in useCamera inside Board); sets activePreset on store, Board.tsx subscribes and calls goToPreset"
  - "hasWave() guard added to handle pipeline_warning union member (TypeScript strict discriminant)"
  - "lastUserInteractionAt added to board-store and updated in userOverrideCameraFollow for 3s cooldown"
  - "transition action added to board-store (STAGE_UPDATE → currentStageLabel) for command bar wiring"
  - "Board.test.tsx + GroupFrame.test.tsx: mock useAnalysisStream to avoid QueryClientProvider in unit tests"

# Metrics
duration: ~13min
completed: 2026-05-26T09:13:10Z
tasks_completed: 4
files_created: 3
files_modified: 8
---

# Phase 02 Plan 13: Engine Group SSE Visualization Summary

**Engine frame body populated with 5 SSE-driven stage glyphs (○→◐→✓), aria-live label, collapse-to-badge on complete, and wave-boundary camera auto-pan — wires SSE stream to board visual end-to-end.**

## Performance

- **Duration:** ~13 min
- **Completed:** 2026-05-26T09:13:10Z
- **Tasks:** 4 of 4
- **Files created:** 3 (EngineGroup.tsx, EngineStageGlyph.tsx, EngineGroup.test.tsx)
- **Files modified:** 8

## Accomplishments

### Task 0: `engine` Camera Preset

Added `'engine'` to `CameraPresetKey` union (board-types.ts), `CAMERA_PRESET_TARGETS` (board-constants.ts), and `VALID_PRESET_KEYS` (use-camera.ts).

**Target rect:** `{ x: 0, y: 0, width: 240, height: 512 }` — Input + Engine column, per D-09 "Engine + Hook decomp area".

CameraOverlay stays at 5 user-facing buttons; `engine` is internal-only (empty label/key in PRESET_LABELS/KEYS, absent from PRESET_ORDER).

### Task 1: EngineStageGlyph Primitive

`src/components/board/EngineStageGlyph.tsx` — per-stage row with:
- `Circle` (waiting / `text-foreground-muted`)
- `CircleHalf` (active / `text-accent` + `animate-pulse` when !reducedMotion)
- `CheckCircle` fill (complete / `text-success`)
- R2.7 plain-English sub-label shown only when status = active

Size fixed to `16` (Icon component only accepts 16|20|24|32).

### Task 2: EngineGroup (TDD RED → GREEN)

**`deriveEngineStageStatus(stages, stage) → EngineStageStatus`** — pure function, exported for Phase 3 extension.

**Wave → EngineStageStatus mapping:**

| Stage | Wave | Plain-English label |
|-------|------|---------------------|
| Qwen-VL segmentation | 0 | "Reading the hook…" |
| Hook decomp | 1 | "Reading the audience…" |
| Retention model | 2 | "Reading the audience…" |
| Persona simulator | 3 | "Reading the audience…" |
| Aggregator | aggregator | "Synthesizing…" |

**Auto-pan wave → preset mapping (D-09):**

| Active stage index | Preset key |
|-------------------|------------|
| 0, 1 (waves 0, 1) | `engine` |
| 2, 3 (waves 2, 3) | `audience` |
| 4 (aggregator) | `verdict` |

**aria-live:** `<span aria-live="polite" className="sr-only">{liveLabel}</span>` — announces active plain-English label. Collapses to `null` when no stage active.

**Collapse:** `setCollapsed(true)` on `phase === 'complete'`. Button "View pipeline →" re-expands.

**STAGE_UPDATE dispatch:** `transition({ type: 'STAGE_UPDATE', stage: liveLabel })` → `currentStageLabel` in board-store → command bar placeholder (plan 2.6 loop closed).

### Task 3: Board.tsx Mount + ActivePreset Wire

```tsx
// Inject EngineGroup into engine frame body
{layout.id === 'engine' && <EngineGroup />}

// D-09 auto-pan subscription
const activePresetFromStore = useBoardStore((s) => s.activePreset);
useEffect(() => {
  if (activePreset) goToPreset(activePreset);
}, [activePreset, goToPreset]);
```

**Board store additions (Rule 2 — needed for auto-pan contract):**
- `lastUserInteractionAt: number` (epoch ms) — updated in `userOverrideCameraFollow`
- `currentStageLabel: string | null` — set by `transition` action
- `transition(event)` — dispatches `STAGE_UPDATE` → sets `currentStageLabel`

## Task Commits

| # | Commit | Description |
|---|--------|-------------|
| 0 | `a96a228` | feat(02-13): add engine camera preset for D-09 auto-pan alignment |
| 1 | `491c007` | feat(02-13): EngineStageGlyph primitive |
| RED | `b49d9d9` | test(02-13): add failing EngineGroup tests (RED phase) |
| GREEN | `bb18068` | feat(02-13): implement EngineGroup |
| 3 | `f5348e9` | feat(02-13): mount EngineGroup in engine frame + wire activePreset auto-pan |

## Tests

8 Vitest tests in `src/components/board/__tests__/EngineGroup.test.tsx` — all pass:

| Suite | Test | Status |
|-------|------|--------|
| deriveEngineStageStatus | waiting when no events | ✓ |
| deriveEngineStageStatus | active on stage_start only | ✓ |
| deriveEngineStageStatus | complete after stage_end | ✓ |
| EngineGroup | renders 5 children all waiting | ✓ |
| EngineGroup | collapses to View pipeline → on complete | ✓ |
| EngineGroup | aria-live label updates with active stage | ✓ |
| EngineGroup | re-expands on badge click | ✓ |
| EngineGroup | child 0 active when stage_start wave 0 received | ✓ |

Total board tests after plan: **44 passing** (all board suites).

## TDD Gate Compliance

RED gate: `b49d9d9` — failing test committed before implementation (EngineGroup.tsx didn't exist).
GREEN gate: `bb18068` — implementation committed; all 8 tests pass.

## Deviations from Plan

### Rule 1 — hasWave() guard for pipeline_warning union

**Found during:** Task 2 (build verification)
**Issue:** `StageEvent` is a discriminated union; `pipeline_warning` has no `.wave` property. Plan's `waveMatch: (e) => e.wave === 0` failed strict TS compile.
**Fix:** Added `hasWave(e)` type guard — `e.type === 'stage_start' || e.type === 'stage_end'` — wrapped all waveMatch lambdas.
**Files:** `src/components/board/EngineGroup.tsx`
**Commit:** `f5348e9`

### Rule 1 — Icon size 14 → 16

**Found during:** Task 1
**Issue:** Plan specifies `Icon size={14}` but project `Icon` only accepts `16 | 20 | 24 | 32`.
**Fix:** Used `size={16}` (smallest available, per plan 2.2 precedent).
**Files:** `src/components/board/EngineStageGlyph.tsx`
**Commit:** `491c007`

### Rule 1 — CameraPresetKey exhaustive maps in CameraOverlay

**Found during:** Task 3 (build)
**Issue:** Adding `'engine'` to `CameraPresetKey` union made `CameraOverlay`'s `Record<CameraPresetKey, string>` maps non-exhaustive.
**Fix:** Added `engine: ''` entries to `PRESET_LABELS` and `PRESET_KEYS` (not in `PRESET_ORDER` — stays out of user-facing UI).
**Files:** `src/components/board/CameraOverlay.tsx`
**Commit:** `f5348e9`

### Rule 2 — Missing lastUserInteractionAt + transition in board-store

**Found during:** Task 2 (implementing EngineGroup)
**Issue:** Plan's EngineGroup uses `useBoardStore.getState().lastUserInteractionAt` (3s cooldown) and `useBoardStore((s) => s.transition)` (STAGE_UPDATE). Neither existed in board-store.
**Fix:** Added `lastUserInteractionAt`, `currentStageLabel`, and `transition` action to store; updated `userOverrideCameraFollow` to record timestamp.
**Files:** `src/stores/board-store.ts`
**Commit:** `b49d9d9`

### Rule 1 — boardState.kind vs boardState (store shape mismatch)

**Found during:** Task 2
**Issue:** Plan code uses `boardState.kind === 'streaming'` and `boardState.stage` (object shape), but actual store uses `boardState` as string enum.
**Fix:** EngineGroup uses `s.boardState === 'streaming'` and `s.currentStageLabel` per actual store shape.
**Files:** `src/components/board/EngineGroup.tsx`
**Commit:** `bb18068`

### Rule 3 — QueryClientProvider missing in Board.test + GroupFrame.test

**Found during:** Task 3
**Issue:** Mounting EngineGroup inside Board caused Board.test.tsx and GroupFrame.test.tsx to fail with "No QueryClient set" (useAnalysisStream uses TanStack Query).
**Fix:** Added `vi.mock('@/hooks/queries/use-analysis-stream', ...)` to both test files.
**Files:** `src/components/board/__tests__/Board.test.tsx`, `src/components/board/__tests__/GroupFrame.test.tsx`
**Commit:** `f5348e9`

## Known Stubs

None. EngineGroup is fully wired to `useAnalysisStream().stages` — no placeholder data. `currentStageLabel` in board-store is wired but CommandBar consumes `currentStage` (derived from `stream.stages` directly in Board.tsx) — the two paths coexist until plan 2.6 is updated to prefer `currentStageLabel`.

## Phase 3 Extension Points

1. **`deriveEngineStageStatus`** — exported pure function. Phase 3 can add per-persona Pass 2 events by extending the `waveMatch` or by adding a new matcher for `wave === 4` (persona pass-2 events).
2. **`panelReady` map** — plan 2.2 noted "Phase 4 will replace audience frame body and consume the same `panelReady` map". `panelReady` from `useAnalysisStream` is available via the hook; Phase 4 can pass it to `deriveFrameVisual` as a third arg.
3. **`currentStageLabel`** — board-store field; plan 2.6 CommandBar can switch to reading from store instead of re-deriving from `stream.stages`.

## Threat Surface Scan

No new security-relevant surface. All changes are client-side UI + store ephemeral state. No network endpoints, auth paths, file access, or user data persistence.

## Self-Check: PASSED

**Files exist:**
- `src/components/board/EngineGroup.tsx` — FOUND
- `src/components/board/EngineStageGlyph.tsx` — FOUND
- `src/components/board/__tests__/EngineGroup.test.tsx` — FOUND
- `src/components/board/Board.tsx` — FOUND (modified)
- `src/stores/board-store.ts` — FOUND (modified)

**Commits exist:**
- `a96a228` — Task 0
- `491c007` — Task 1
- `b49d9d9` — RED
- `bb18068` — GREEN
- `f5348e9` — Task 3

**Tests:** 8/8 EngineGroup + 44/44 all board suites

---
*Phase: 02-board-substrate-navigation*
*Plan: 13*
*Completed: 2026-05-26*
