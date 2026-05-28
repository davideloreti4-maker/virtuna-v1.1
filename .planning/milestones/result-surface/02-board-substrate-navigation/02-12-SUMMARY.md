---
phase: 02-board-substrate-navigation
plan: 12
subsystem: board-ui
tags: [orientation-hint, onboarding, localStorage, accessibility, zustand]

# Dependency graph
requires:
  - phase: 02-board-substrate-navigation (Plan 04)
    provides: board-store.ts with boardState field
dependency_graph:
  provides:
    - src/components/board/OrientationHint.tsx
  affects:
    - src/components/board/Board.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSR-safe localStorage init via useEffect (dismissed starts as true, set post-mount)"
    - "Zustand selector on boardState for auto-dismiss trigger"
    - "vi.stubGlobal localStorage in happy-dom tests (happy-dom 20.x requires --localstorage-file path)"

key-files:
  created:
    - "src/components/board/OrientationHint.tsx"
    - "src/components/board/__tests__/OrientationHint.test.tsx"
  modified:
    - "src/components/board/Board.tsx (OrientationHint import + mount)"

key-decisions:
  - "Used boardState (flat string) from store, not state.kind object — matches actual board-store.ts shape from Plan 04"
  - "Icon size=16 used instead of plan's size=14 (Icon component only accepts 16|20|24|32)"
  - "GlassPanel imported from @/components/primitives/GlassPanel, not @/components/ui (actual location)"
  - "localStorage stub via vi.stubGlobal required for happy-dom 20.x (same pattern as perf-tier.test.ts)"
  - "Phase 8 note: localStorage key is virtuna-orientation-hint-dismissed; extend with arrow + multi-step tour if R7.5 tutorial overlay needed"

# Metrics
duration: ~4min
completed: 2026-05-26T08:54:00Z
tasks_completed: 2
files_created: 2
files_modified: 1
---

# Phase 02 Plan 12: OrientationHint Summary

**R7.4 first-board orientation tooltip — dismissible hint persisted to localStorage, auto-dismissed on board state transition, ARIA-compliant.**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-05-26T08:54:00Z
- **Tasks:** 2 of 2
- **Files created:** 2 (OrientationHint.tsx, OrientationHint.test.tsx)
- **Files modified:** 1 (Board.tsx)

## Accomplishments

### OrientationHint component (`src/components/board/OrientationHint.tsx`)

Self-contained tooltip satisfying all R7.4 must-haves:

| Behavior | Implementation |
|----------|---------------|
| Renders on first idle visit | SSR-safe: dismissed=true default, set from localStorage post-mount |
| Auto-dismisses on state transition | useEffect watches boardState; writes flag + sets dismissed on non-idle |
| Tap × dismisses immediately | handleDismiss: writeDismissed() + setDismissed(true) |
| LocalStorage persistence | Key: `virtuna-orientation-hint-dismissed`, value: `'1'` |
| ARIA | role="status", aria-live="polite", dismiss button aria-label="Dismiss orientation hint" |
| Reduced-motion | No CSS animations in baseline (Phase 8 will add 200ms fade with prefers-reduced-motion gate) |

**Z-stack position:** z=150 — sits above board content (z=100), below command bar (z=200).

### Board.tsx mount

Added import and `<OrientationHint />` render after `<CameraOverlay>` in the DOM overlay stack.

## Task Commits

| # | Commit | Description |
|---|--------|-------------|
| RED | `2f077b9` | test(02-12): add failing tests for OrientationHint component |
| GREEN | `4c58c55` | feat(02-12): OrientationHint component with localStorage persistence |
| 2 | `801a550` | feat(02-12): mount OrientationHint in Board.tsx |

## Tests

5 Vitest tests in `src/components/board/__tests__/OrientationHint.test.tsx` — all pass:

| Test | Coverage |
|------|----------|
| Renders when not dismissed and state is idle | Happy path |
| Does NOT render when localStorage flag is set | Already-dismissed guard |
| Does NOT render when state is streaming | Non-idle guard |
| Clicking X dismisses + persists | Manual dismiss + storage |
| Auto-dismisses when state transitions away from idle | State-driven auto-dismiss |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Store shape mismatch: `state.kind` vs `boardState`**
- **Found during:** Task 1 (test authoring)
- **Issue:** Plan test code used `state: { kind: 'idle' }` / `state.kind` but actual board-store (Plan 04) uses flat `boardState: 'idle'`
- **Fix:** Rewrote tests and component to use `boardState` selector; `useBoardStore.setState({ boardState: 'idle' })`
- **Files modified:** OrientationHint.tsx, OrientationHint.test.tsx

**2. [Rule 1 - Bug] Icon size=14 not allowed**
- **Found during:** Task 1
- **Issue:** Icon component only accepts sizes 16|20|24|32; plan specified size={14}
- **Fix:** Used size={16} (nearest valid value)
- **Files modified:** OrientationHint.tsx

**3. [Rule 1 - Bug] Wrong GlassPanel import path**
- **Found during:** Task 1
- **Issue:** Plan specified `@/components/ui` but GlassPanel lives in `@/components/primitives/GlassPanel`
- **Fix:** Import from `@/components/primitives/GlassPanel`
- **Files modified:** OrientationHint.tsx

**4. [Rule 1 - Bug] localStorage.clear not a function in happy-dom**
- **Found during:** Task 1 (test run)
- **Issue:** happy-dom 20.x requires `--localstorage-file` path; `localStorage.clear()` throws
- **Fix:** `vi.stubGlobal('localStorage', mockStorage)` — same pattern as perf-tier.test.ts; reset via `delete mockStorage[key]` in beforeEach
- **Files modified:** OrientationHint.test.tsx

## Known Stubs

None. Component is fully functional. Phase 8 note:
- Extend with CSS fade-in/out (200ms in, 150ms out, ease-out-cubic; instant under `prefers-reduced-motion`)
- If R7.5 multi-step tutorial overlay lands in Phase 8, extend OrientationHint or replace with a tour coordinator using the same `virtuna-orientation-hint-dismissed` localStorage key

## Threat Surface Scan

No security-relevant surface. Component is purely client-side UI — reads/writes one localStorage key, no auth tokens, no network calls, no user data.

## Self-Check: PASSED

**Files exist:**
- `src/components/board/OrientationHint.tsx` — FOUND
- `src/components/board/__tests__/OrientationHint.test.tsx` — FOUND
- `src/components/board/Board.tsx` — FOUND (modified)

**Commits exist:**
- `2f077b9` — FOUND (RED gate)
- `4c58c55` — FOUND (GREEN gate)
- `801a550` — FOUND (Task 2)

**Tests:** 5/5 passing + 3/3 Board.tsx regression tests passing

---
*Phase: 02-board-substrate-navigation*
*Plan: 12*
*Completed: 2026-05-26*
