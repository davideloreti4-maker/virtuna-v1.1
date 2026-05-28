---
phase: 02-board-substrate-navigation
plan: 6
subsystem: command-bar
tags: [command-bar, zustand, useAnalysisStream, streaming, TDD, accessibility]
dependency_graph:
  requires:
    - plan: 2.4
      provides: board-store.ts (boardState machine + resetToIdle/startStreaming/finishStreaming)
    - plan: 2.5
      provides: sidebar layout offset (CommandBar z=200 coexists at bottom-center)
    - plan: 2.1
      provides: Board.tsx shell, /analyze route
  provides:
    - src/components/command-bar/CommandBar.tsx
    - src/components/command-bar/command-bar-state.ts
    - src/components/command-bar/CommandBarChip.tsx
  affects:
    - src/components/board/Board.tsx
tech-stack:
  added: []
  patterns:
    - "TDD RED→GREEN for pure helpers + component tests"
    - "placeholderFor(boardMachineState, stage|null) + chipsFor(state) as single source of truth"
    - "CommandBar reads boardMachineState from useBoardStore; receives currentStage as prop from Board"
    - "Stream phase → board state: analyzing→startStreaming, complete→finishStreaming+triggerAntiVirality, error→resetToIdle"
    - "pushState on analysisId for /analyze/[id] URL transitions (D-01)"
    - "Auto-hide after 5s inactivity; chevron re-opens; respects reduced-motion"
key-files:
  created:
    - src/components/command-bar/command-bar-state.ts
    - src/components/command-bar/CommandBarChip.tsx
    - src/components/command-bar/CommandBar.tsx
    - src/components/command-bar/__tests__/command-bar-state.test.ts
    - src/components/command-bar/__tests__/CommandBar.test.tsx
  modified:
    - src/components/board/Board.tsx
key-decisions:
  - "Store shape deviation: plan assumed BoardState discriminated union with {kind, stage, analysisId} and transition({type}). Actual store (plan 2.4) uses boardState string + separate action methods. Adapted all code to real API."
  - "placeholderFor/chipsFor accept (BoardMachineState, stage|null) not a discriminated union — cleaner fit with real store"
  - "currentStage passed as prop from Board (not read internally by CommandBar) — Board owns the stream, CommandBar stays pure"
  - "Stop chip uses resetToIdle() not abort() — Phase 1 hook has no abort() per D-02 lock. Flagged for follow-up."
  - "Stage label is raw slug from stream.stages last stage_start event — plan 2.13 will add human-readable label mapping"
metrics:
  duration: "~15min"
  completed: "2026-05-26"
  tasks_completed: 4
  files_created: 5
  files_modified: 1
  tests_added: 18
---

# Phase 02 Plan 06: Command Bar Summary

**One-liner:** Bottom-pinned context-aware command bar with pure state helpers, chip primitives, and full board-store + stream wiring — TDD, 18/18 tests pass.

## What Was Built

### Task 1 — command-bar-state.ts (TDD 10/10)

Pure functions: single source of truth for placeholder text and chip descriptors per board state.

```ts
placeholderFor(state: BoardMachineState, stage: string | null): string
chipsFor(state: BoardMachineState): ChipDescriptor[]
inputEnabledFor(state: BoardMachineState): boolean
```

Adapts to actual `BoardMachineState` string type (not the plan's assumed discriminated union).
`anti-virality` state is treated same as `complete` for UX purposes (4 disabled chips, completion placeholder).

### Task 2 — CommandBarChip.tsx

Button primitive with Raycast styling: bg-surface-elevated, 6% border, 8px radius, 12px text.
Disabled chips: opacity-50 + cursor-not-allowed (visible but non-interactive per UI-SPEC).
Destructive variant (Stop chip): border-error/40 + text-error.

### Task 3 — CommandBar.tsx (TDD 8/8)

Bottom-fixed command bar at z=200, width `min(720px, calc(100vw - 32px))`.

| Board state | Input | Chips |
|-------------|-------|-------|
| `idle` | Enabled, idle placeholder | None |
| `streaming` | Disabled, stage/Analyzing… | Stop analysis (enabled) |
| `complete` / `anti-virality` | Enabled, completion placeholder | 4 disabled Phase-2 chips |
| `edit-input` | — | `null` (bar hidden) |

Auto-hides after 5s of no interaction — chevron button re-opens.
`usePrefersReducedMotion()` makes show/hide instant (no CSS transition).
Input: `role="combobox"`, `aria-label="Analysis command bar"`.

### Task 4 — Board.tsx wiring

Added to `Board()`:
- `useAnalysisStream()` for stream state + `start()`
- Phase mapping useEffect: `analyzing/reconnecting/polling → startStreaming()`, `complete → finishStreaming() + triggerAntiVirality()`, `error → resetToIdle()`
- `pushState` on `stream.analysisId` → `/analyze/${id}` (D-01, not replaceState)
- `currentStage` derived from last `stage_start` event in `stream.stages`
- `handleCommandSubmit`: URL detection → `tiktok_url` vs `text` input_mode
- `handleCommandStop`: `resetToIdle()` (see Known Limitations)
- `<CommandBar currentStage={currentStage} onSubmit={...} onStop={...} />` mounted at z=200

## Tests

| File | Tests | Status |
|------|-------|--------|
| `command-bar/__tests__/command-bar-state.test.ts` | 10 | GREEN |
| `command-bar/__tests__/CommandBar.test.tsx` | 8 | GREEN |
| **Total new** | **18** | **All pass** |

Pre-existing failures (not caused by this plan, verified via `git stash` baseline check):
- `board/__tests__/Board.test.tsx` — 3 failures (react-konva + useQueryClient context pre-existing)
- `board/__tests__/GroupFrame.test.tsx` — 4 failures (pre-existing)

## Commits

| Task | Hash | Description |
|------|------|-------------|
| 1 | `603d511` | feat(02-06): pure command-bar-state helpers |
| 2 | `62ff388` | feat(02-06): CommandBarChip primitive |
| 3 | `f2f7a33` | feat(02-06): CommandBar component (TDD 8/8) |
| 4 | `cc03a3a` | feat(02-06): wire CommandBar into Board + stream→board-state mapping |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Store shape mismatch — adapted all code to real board-store API**

- **Found during:** Task 1 analysis
- **Issue:** Plan assumed `BoardState` discriminated union with `{ kind, stage, analysisId, antiVirality }` and `transition({ type: 'STREAM_CANCEL' })`. Actual store (plan 2.4) uses `boardState: BoardMachineState` (string enum) with separate action methods.
- **Fix:** 
  - `placeholderFor/chipsFor/inputEnabledFor` accept `(BoardMachineState, stage|null)` instead of a discriminated union
  - Tests use `useBoardStore.setState(...)` pattern adapted to real store shape
  - Stop chip calls `resetToIdle()` instead of `transition({ type: 'STREAM_CANCEL' })`
  - Phase mapping uses `startStreaming()`, `finishStreaming()`, `triggerAntiVirality()`, `resetToIdle()`
- **Files modified:** All command-bar files + Board.tsx

## Known Limitations

**Stop chip uses `resetToIdle()`, not `abort()`.**

Phase 1's `useAnalysisStream` has no dedicated `abort()` method (D-02 lock). `resetToIdle()` provides immediate UI feedback (board → idle). The in-flight POST/EventSource may complete in background. 

Future work: expose `useAnalysisStream().abort()` (calls `AbortController.abort()` on underlying fetch reader). Swap the single `handleCommandStop → resetToIdle()` call in `Board.tsx` to `stream.abort()` when landed. Track in plan 2.x or Phase 3 hook extension.

**Stage labels are raw slugs (e.g. `wave_3_personas`).**

The stream emits stage event slugs, not human-readable labels. `CommandBar` passes the slug as `currentStage` — it shows as-is in the placeholder. Plan 2.13 Engine integration will add a `STAGE_LABEL_MAP` to convert slugs to "Reading the hook…", "Scoring virality…" etc.

## API Reference (for plan 2.12 orientation tooltip wiring)

```ts
// command-bar-state.ts exports — use these for tooltip "Type in command bar to begin" wiring:
placeholderFor(state: BoardMachineState, stage: string | null): string
chipsFor(state: BoardMachineState): ChipDescriptor[]
inputEnabledFor(state: BoardMachineState): boolean

// CommandBar props:
interface Props {
  currentStage?: string | null;   // latest stage label from stream (Board provides this)
  onSubmit?: (text: string) => void;
  onStop?: () => void;
}
```

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| 4 chip actions (rewrite/compare/variant/reweight) | CommandBar.tsx | chipsFor return | Phase 2 placeholders — all `enabled: false`, click is no-op. Wire in M2-II. |
| Stage slug labels | Board.tsx | currentStage useMemo | Raw slug shown; plan 2.13 adds STAGE_LABEL_MAP for human-readable text |

## Threat Surface Scan

No new security-relevant surface. `CommandBar` is a client-only input component — submits to `useAnalysisStream.start()` (existing POST /api/analyze endpoint, already auth-gated). No new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- [x] `src/components/command-bar/command-bar-state.ts` exists
- [x] `src/components/command-bar/CommandBarChip.tsx` exists
- [x] `src/components/command-bar/CommandBar.tsx` exists
- [x] `src/components/command-bar/__tests__/command-bar-state.test.ts` exists
- [x] `src/components/command-bar/__tests__/CommandBar.test.tsx` exists
- [x] `src/components/board/Board.tsx` modified
- [x] 18/18 tests pass
- [x] Build passes (npm run build)
- [x] 0 new TypeScript errors in plan files
- [x] Commits 603d511, 62ff388, f2f7a33, cc03a3a in git log
