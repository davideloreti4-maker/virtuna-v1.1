---
phase: 02-board-substrate-navigation
plan: 16
subsystem: board/canvas
tags: [drag-sync, camera, konva, dom-overlay, uat-gap-fix]
dependency_graph:
  requires: []
  provides: [live-camera-sync-during-drag]
  affects: [GroupFrameOverlay, InputNodeOverlay, NodeOverlay]
tech_stack:
  added: []
  patterns: [onDragMove-camera-sync, drag-handler-extraction, no-op-guard]
key_files:
  created:
    - src/components/board/__tests__/BoardCanvas.drag-sync.test.tsx
    - src/__mocks__/react-konva.tsx
    - src/__mocks__/konva-node.ts
  modified:
    - src/components/board/BoardCanvas.tsx
    - src/test/setup.ts
    - vitest.config.ts
decisions:
  - "No-op guard (x === camera.x && y === camera.y) prevents redundant store writes when Konva fires move events with unchanged position"
  - "onDragStart fires onUserInteract for early auto-follow cancellation (D-09) at drag begin, not after first frame"
  - "Added react-konva + konva/lib/Node vitest aliases in vitest.config.ts to enable worktree testing without node_modules installation"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-26T12:57:00Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 6
---

# Phase 02 Plan 16: BoardCanvas Drag-Sync (UAT Gap 2) Summary

**One-liner:** Added `onDragMove` to Konva Stage so DOM overlay frames track canvas pan in real time, not just on drag release.

## What Was Built

### Root Cause

Konva's `<Stage draggable>` maintains its own internal `x`/`y` position during a drag gesture. This internal position updates continuously as the user moves the pointer. However, the previous implementation only had an `onDragEnd` handler — meaning `board-store` camera state (`camera.x`, `camera.y`) was stale throughout the entire drag, only receiving the final position on mouse release.

All DOM overlay components (`GroupFrameOverlay`, `InputNodeOverlay`, `NodeOverlay`) project world-space coordinates to screen using:
```ts
const screenX = bounds.x * camera.scale + camera.x;
const screenY = bounds.y * camera.scale + camera.y;
```

They all subscribe to `useBoardStore((s) => s.camera)` and re-render only when `camera` changes. With `onDragEnd`-only, `camera.x`/`camera.y` stayed frozen at their pre-drag values until release — so the DOM overlay layer appeared visually frozen while the Konva-drawn frame outlines (which use Konva's internal transform) moved correctly. The user saw frame outlines detach from their title bars and content during drag, then snap back on release.

### The Fix

**Task 1 — `src/components/board/BoardCanvas.tsx`:**

Added `handleDragMove` that reads `stage.x()` / `stage.y()` from the live Konva stage and writes them to `setCamera` every drag tick:

```ts
const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
  const stage = e.target.getStage();
  if (!stage) return;
  const x = stage.x();
  const y = stage.y();
  if (x === camera.x && y === camera.y) return; // no-op guard
  setCamera({ ...camera, x, y });
};
```

The no-op guard (`if (x === camera.x && y === camera.y) return`) prevents redundant `setCamera` calls when Konva fires a `dragmove` event with coordinates unchanged from the current camera state. Without this guard, a potential render-loop could form: `setCamera` re-renders the Stage with new `x`/`y` props, which could trigger Konva to fire another `dragmove`. The equality check breaks the cycle since the new props match the already-committed store values.

Also added `onDragStart={() => { onUserInteract?.(); }}` so auto-follow cancellation (D-09) fires at drag begin rather than waiting for drag end. This prevents a 1-frame window where a camera preset glide could override the user's pan.

`onDragEnd` was extracted to a named `handleDragEnd` for consistency and still fires `onUserInteract` + `setCamera` as before.

**Every DOM overlay automatically benefits** from this fix because they all read camera from board-store via `useBoardStore((s) => s.camera)`. No changes needed in `GroupFrameOverlay`, `InputNodeOverlay`, or `NodeOverlay`.

### Performance Note

`onDragMove` fires at Konva's internal RAF cadence (~60fps). Each tick calls `setCamera` which writes a Zustand store. Zustand uses selector-based subscription: subscribers only re-render when their selected slice changes. `camera.x`/`camera.y` change every tick during drag, so all camera-subscribed components re-render at ~60fps during drag. This matches browser's native paint budget and is the expected behavior for smooth pan.

**Task 2 — `src/components/board/__tests__/BoardCanvas.drag-sync.test.tsx`:**

5-test regression suite verifying:
1. Stage receives `draggable`, `onDragMove`, `onDragEnd`, `onDragStart` props
2. `onDragMove` calls `setCamera` with live stage coordinates
3. `onDragMove` no-ops when stage position equals current camera (no spurious renders)
4. `onDragStart` fires `onUserInteract` (D-09 auto-follow cancellation)
5. `onDragEnd` fires both `onUserInteract` and `setCamera` with final position

**Task 3 (checkpoint:human-verify):** Requires human verification on `/analyze` page — not automated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Missing react-konva package in worktree**
- **Found during:** Task 2 test execution
- **Issue:** Worktree has no `node_modules/` directory; `react-konva` and `konva` packages were not installed. Vitest's `vite:import-analysis` transform errored when resolving `import { Stage, Layer, Rect } from 'react-konva'` in `BoardCanvas.tsx`, even with `vi.mock('react-konva', ...)` in the test.
- **Fix:** Added `react-konva` and `konva/lib/Node` path aliases in `vitest.config.ts` pointing to stub files in `src/__mocks__/`. These stubs export minimal shims; individual test files override with `vi.mock()` for handler testing.
- **Files modified:** `vitest.config.ts`, `src/__mocks__/react-konva.tsx`, `src/__mocks__/konva-node.ts`
- **Commit:** 6d3471a

**2. [Rule 3 - Blocker] Broken vitest-axe import in worktree setup.ts**
- **Found during:** Task 2 test execution
- **Issue:** `src/test/setup.ts` imported `vitest-axe/matchers` which is not installed in the worktree. This prevented any test file from running.
- **Fix:** Removed the `vitest-axe` import block from `setup.ts` (matching the main repo's `setup.ts` which also doesn't import it). A11y tests use their own local imports.
- **Files modified:** `src/test/setup.ts`
- **Commit:** 6d3471a

### Pre-existing Failures (Out of Scope)

4 test files in the board suite fail due to `@pmndrs/detect-gpu` not installed in the worktree:
- `Board.test.tsx`
- `Board.a11y.test.tsx`
- `GroupFrame.test.tsx`
- `EngineGroup.test.tsx`

These failures are pre-existing and unrelated to this plan's changes. Logged to deferred items.

## Known Stubs

None — this plan makes no UI rendering changes; it only wires event handlers.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

- `src/components/board/BoardCanvas.tsx` — exists, has `onDragMove={handleDragMove}`
- `src/components/board/__tests__/BoardCanvas.drag-sync.test.tsx` — exists, 5 tests pass
- `src/__mocks__/react-konva.tsx` — exists
- Task 1 commit `1d5d28c` — verified in git log
- Task 2 commit `6d3471a` — verified in git log
