---
phase: 02-board-substrate-navigation
plan: 1
subsystem: board-canvas
tags: [konva, canvas, camera, board, navigation, SSR-safe]
dependency_graph:
  requires: []
  provides:
    - src/components/board/Board.tsx
    - src/components/board/BoardCanvas.tsx
    - src/components/board/CameraOverlay.tsx
    - src/components/board/use-camera.ts
    - src/components/board/use-board-keyboard.ts
    - src/components/board/board-types.ts
    - src/components/board/board-constants.ts
    - src/app/(app)/analyze/layout.tsx
    - src/app/(app)/analyze/page.tsx
    - src/app/(app)/analyze/[id]/page.tsx
  affects:
    - src/lib/supabase/middleware.ts
    - next.config.ts
tech_stack:
  added:
    - konva@10.3.0
    - react-konva@19.2.4
  patterns:
    - SSR-safe Konva via next/dynamic ssr:false
    - Camera transform math (pure functions, unit-testable)
    - URL camera deep-link via replaceState debounced 200ms
    - Shared route layout to prevent Board remount on URL transition
key_files:
  created:
    - src/components/board/board-types.ts
    - src/components/board/board-constants.ts
    - src/components/board/use-camera.ts
    - src/components/board/use-board-keyboard.ts
    - src/components/board/BoardCanvas.tsx
    - src/components/board/CameraOverlay.tsx
    - src/components/board/Board.tsx
    - src/components/board/__tests__/use-camera.test.ts
    - src/components/board/__tests__/Board.test.tsx
    - src/app/(app)/analyze/layout.tsx
    - src/app/(app)/analyze/page.tsx
    - src/app/(app)/analyze/[id]/page.tsx
  modified:
    - next.config.ts
    - src/lib/supabase/middleware.ts
    - package.json
    - pnpm-lock.yaml
decisions:
  - "Use next/dynamic with ssr:false for BoardCanvas — react-konva touches window at module load, SSR-unsafe (RESEARCH Pitfall 1)"
  - "Shared analyze/layout.tsx mounts Board once — prevents Konva Stage remount and camera state loss on /analyze to /analyze/[id] transition (RESEARCH Pitfall 2)"
  - "Camera URL sync uses replaceState not pushState — avoids polluting browser history with every pan/zoom tick (RESEARCH Pitfall 4)"
  - "Pure functions (computeFitCamera, computeZoomAtPointer, parseCameraSearchParams) split from hook — enables unit tests without mounting Konva"
  - "parseCameraSearchParams uses allowlist for preset keys — rejects XSS via ?focus=<script> (V5 security)"
  - "/dashboard -> /analyze middleware redirect added (D-25), /analyze added to PROTECTED_PREFIXES"
metrics:
  duration: "7m 24s"
  completed: "2026-05-26"
  tasks_completed: 6
  files_created: 12
  files_modified: 4
  tests_added: 14
---

# Phase 02 Plan 01: Board Substrate + Navigation (Canvas Foundation) Summary

**One-liner:** Konva canvas runtime with SSR-safe dynamic import, camera pan/zoom/presets/URL-sync, keyboard shortcuts, and shared analyze layout that persists Board across route transitions.

## What Was Built

Installed `konva@10.3.0` and `react-konva@19.2.4`. Added the `canvas` webpack external to `next.config.ts` (react-konva Next.js workaround, RESEARCH Pitfall 1). Created the complete `src/components/board/` substrate:

- **`board-types.ts`** — `Rect`, `Camera`, `GroupId`, `CameraPresetKey`, `GroupFrameLayout` contracts for all downstream plans (2.2-2.13)
- **`board-constants.ts`** — D-06 spatial layout: 6 group frames (Input, Engine, Audience, Verdict, Actions, Content Analysis) with deterministic world-space coordinates; `BOARD_BOUNDS`, `CAMERA_PRESET_TARGETS`, scale constants
- **`use-camera.ts`** — pure functions (`computeFitCamera`, `computeZoomAtPointer`, `parseCameraSearchParams`, `serializeCamera`) plus `useCamera` hook (one-shot URL read on mount, debounced `replaceState` write)
- **`use-board-keyboard.ts`** — global `keydown` listener for 0/1/2/3/R presets + Meta+\ + Meta+N, with input/textarea guard
- **`BoardCanvas.tsx`** — Konva Stage with pan (draggable) + scroll-wheel zoom at pointer; not imported at module scope anywhere (only via dynamic import from Board)
- **`CameraOverlay.tsx`** — 5 preset buttons (Overview/Verdict/Audience/Content Analysis/Reset) with `aria-label`, `aria-keyshortcuts`, `aria-pressed`, desktop Kbd hints
- **`Board.tsx`** — top-level client component: dynamic imports BoardCanvas (ssr:false), ResizeObserver viewport, useCamera + useBoardKeyboard wired

Created `/analyze` route with shared layout:
- **`analyze/layout.tsx`** — mounts `<Board>` once inside Suspense; both `/analyze` and `/analyze/[id]` share this instance (RESEARCH Pitfall 2 fix)
- **`analyze/page.tsx`** — server shell, metadata only, returns null (Board is in layout)
- **`analyze/[id]/page.tsx`** — server shell with `generateMetadata`, returns null (Board is in layout)

Updated **`middleware.ts`**: `/analyze` added to `PROTECTED_PREFIXES`; `/dashboard` → `/analyze` redirect (D-25); post-login redirect updated to `/analyze`.

## Board Component Contracts

### `Board.tsx`
**Current props:** none  
**Note for plan 2.4:** The local `useState` for `camera` + `activePreset` MUST be swapped for `useBoardStore` selectors once `src/stores/board-store.ts` exists. Current implementation uses local state as a bridge.

### `BoardCanvas.tsx`
**Props:**
```ts
interface Props {
  camera: Camera;       // from board-store (plan 2.4) or local useState
  setCamera: (c: Camera) => void;
  width: number;        // from ResizeObserver in Board.tsx
  height: number;
  children?: React.ReactNode; // Konva Layer contents from plans 2.2/2.3/2.13
}
```
Passes children into the second Layer. Plans 2.2 (GroupFrames) and 2.3 (nodes) place Konva shapes here.

### Camera URL format
`?focus=<preset>&zoom=<decimal>` — e.g. `?focus=audience&zoom=2.40`. `replaceState` used (not pushState). Debounced 200ms. Preset keys: `overview | verdict | audience | content-analysis`.

## Tests

| File | Tests | Status |
|------|-------|--------|
| `board/__tests__/use-camera.test.ts` | 11 | GREEN |
| `board/__tests__/Board.test.tsx` | 3 | GREEN |
| **Total new** | **14** | **All pass** |

Full suite: 75/76 test files pass (1 pre-existing skip), 1002/1019 tests pass (17 pre-existing skips). Zero regressions.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — use-camera tests | `6e8c70a` | PASS |
| GREEN — use-camera impl | `d540691` | PASS |
| RED — Board tests | `5afe969` | PASS |
| GREEN — Board impl | `a4d1534` | PASS |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `f13a013` | feat | konva install + canvas webpack external |
| `776e45c` | feat | board-types.ts + board-constants.ts |
| `6e8c70a` | test | use-camera RED tests |
| `d540691` | feat | use-camera GREEN implementation |
| `f09676b` | feat | useBoardKeyboard hook |
| `5afe969` | test | Board RED tests |
| `a4d1534` | feat | BoardCanvas + CameraOverlay + Board GREEN |
| `b221ac7` | feat | analyze route + shared layout + middleware |

## Deviations from Plan

None — plan executed exactly as written. The only adaptation: Task 6 step 4 (delete analyze-client.tsx, result-card.tsx, result-card-skeleton.tsx) was a no-op because those files do not exist in this worktree (which is based on `main`, not `milestone/result-surface`). No tests imported those files.

## Known Stubs

- `Board.tsx` uses local `useState` for camera/activePreset — **plan 2.4 must swap for `useBoardStore` selectors** (explicitly noted in code comment)
- `BoardCanvas.tsx` second Layer is empty — **Group frames mount in plan 2.2**, nodes in plan 2.3

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: open_redirect | middleware.ts | `/dashboard` redirect uses `request.nextUrl.clone()` with hardcoded pathname replace — same-origin guaranteed, no user-controlled destination |

## Self-Check: PASSED

All created files exist on disk. All 8 task commits confirmed in git log.
