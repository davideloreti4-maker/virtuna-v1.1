---
phase: 02-board-substrate-navigation
plan: 2
subsystem: board-frames
tags: [konva, dom-overlay, group-frames, aria, anti-virality, streaming, empty-state]

dependency_graph:
  requires:
    - phase: 02-board-substrate-navigation (Plan 01)
      provides: board-types.ts, board-constants.ts (GROUP_FRAMES, TITLE_BAR_HEIGHT, FRAME_CORNER_RADIUS)
    - phase: 02-board-substrate-navigation (Plan 04)
      provides: useBoardStore with boardState machine + camera state
  provides:
    - src/components/board/GroupFrame.tsx (Konva spatial outline, FrameVisualState type)
    - src/components/board/GroupFrameOverlay.tsx (DOM title bar, ARIA, empty-state, shimmer)
    - src/components/board/__tests__/GroupFrame.test.tsx (4 integration tests)
  affects:
    - src/components/board/Board.tsx (frame loop + overlay layer mounted)

tech-stack:
  added: []
  patterns:
    - "Hybrid Konva+DOM frame pattern: Konva Rect for spatial outline, DOM div for title bar / ARIA / text"
    - "deriveFrameVisual pure helper — boardMachineState + frameId → FrameVisualState (extensible for plan 2.13 panelReady)"
    - "pointer-events-none overlay wrapper preserves Konva pan/zoom hit-test; individual frames restore pointer-events-auto"
    - "World→screen transform inline in GroupFrameOverlay (6 frames × 3 multiplications per render — negligible per RESEARCH §React 19 compiler)"
    - "Per-frame expanded state in Board.tsx local useState (not in store — ephemeral UI state)"

key-files:
  created:
    - "src/components/board/GroupFrame.tsx (38 LOC)"
    - "src/components/board/GroupFrameOverlay.tsx (116 LOC)"
    - "src/components/board/__tests__/GroupFrame.test.tsx (81 LOC)"
  modified:
    - "src/components/board/Board.tsx (added imports, deriveFrameVisual, expanded state, frame render loops)"

key-decisions:
  - "FrameVisualState = 'idle' | 'streaming' | 'complete' | 'anti-virality' — defined in GroupFrame.tsx, imported by GroupFrameOverlay and Board"
  - "deriveFrameVisual maps boardMachineState (store string) to FrameVisualState; anti-virality only on verdict+audience per UI-SPEC"
  - "Badge variant='secondary' used for count badge (no 'outline' variant in project Badge component)"
  - "Icon size=16 used for chevron (project Icon component only accepts 16|20|24|32, not 14)"
  - "GroupFrameOverlay children slot left open for plan 2.7 (Input) and plan 2.13 (Engine stages)"

metrics:
  duration: ~15min
  completed: "2026-05-26"
  tasks_completed: 4
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 02: Group Container Frames Summary

**6 hybrid Konva+DOM group container frames rendered at world-space coordinates with state-driven styling, ARIA regions, empty-state copy, and expand/collapse chevrons.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-05-26
- **Tasks:** 4 of 4
- **Files created:** 3 (GroupFrame.tsx, GroupFrameOverlay.tsx, GroupFrame.test.tsx)
- **Files modified:** 1 (Board.tsx)

## Accomplishments

### GroupFrame.tsx — Konva spatial layer

Renders the rectangular outline for one frame. No DOM, no text inside Konva tree (UI-SPEC §Konva Layer Architecture).

**FrameVisualState** (exported type, used by GroupFrameOverlay and Board):

| State | Stroke | Fill opacity | Stroke width |
|-------|--------|-------------|-------------|
| `idle` | `rgba(255,255,255,0.06)` | 40% | 1 |
| `streaming` | `rgba(255,255,255,0.10)` | 70% | 1 |
| `complete` | `rgba(255,255,255,0.06)` | 100% | 1 |
| `anti-virality` | `rgba(255,148,0,0.30)` | 100% | 1.5 |

Surface fill = `rgba(24, 25, 26, opacity)` — Raycast `#18191a` per CLAUDE.md.

### GroupFrameOverlay.tsx — DOM title bar + a11y + empty state

Positioned absolutely over the Konva canvas using world→screen transform from camera store. Provides:

- `role="region"` with per-frame `aria-label` (ARIA_LABEL map)
- Title bar (36px height from `TITLE_BAR_HEIGHT`) with label, count badge, expand/collapse chevron
- `aria-live="polite"` span on Engine frame (plan 2.13 injects stage text)
- Shimmer via `<Skeleton>` during streaming (respects `reducedMotion` prop)
- Empty-state copy for Audience / Verdict / Actions / Content Analysis frames
- `children` slot open for plan 2.7 (Input node card) and plan 2.13 (Engine stage glyphs)

**`children` slot contract:**
- Plan 2.7 fills `input` frame body with the Input node card component
- Plan 2.13 fills `engine` frame body with 5 stage glyphs + live aria text
- Any other future plan can pass `children` to any frame body

### Board.tsx — frame render loop

Added `deriveFrameVisual` helper above component:

```ts
function deriveFrameVisual(
  boardMachineState: BoardMachineState,
  frameId: GroupId,
): FrameVisualState {
  if (boardMachineState === 'idle' || boardMachineState === 'edit-input') return 'idle';
  if (boardMachineState === 'streaming') return 'streaming';
  // anti-virality only on verdict + audience (plan 2.13 can extend with panelReady)
  if (boardMachineState === 'anti-virality' && (frameId === 'verdict' || frameId === 'audience')) {
    return 'anti-virality';
  }
  return 'complete';
}
```

**Extension point for plan 2.13:** Add `panelReady: Record<PanelId, PanelReadyState>` as third parameter to `deriveFrameVisual`. When `boardMachineState === 'streaming'`, return `'complete'` for frames where `panelReady[frameId] === 'ready'` (per-panel streaming complete) and `'streaming'` otherwise.

## Task Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `2108f30` | feat(02-02): GroupFrame Konva spatial layer |
| 2 | `d9cd6c8` | feat(02-02): GroupFrameOverlay DOM title bar |
| 3 | `6aae80b` | feat(02-02): mount 6 frames in Board.tsx |
| 4 | `243b8c3` | test(02-02): 4 GroupFrame integration tests |

## Tests

4 Vitest tests in `src/components/board/__tests__/GroupFrame.test.tsx` — all pass:

| Test | Description |
|------|-------------|
| 1 | 6 regions with `role="region"` rendered in idle state |
| 2 | Empty-state copy visible for Audience / Verdict / Actions / Content Analysis |
| 3 | Anti-virality stroke on Verdict + Audience rects when `boardState='anti-virality'` |
| 4 | Chevron click toggles `aria-expanded` true→false on Audience frame |

## Deviations from Plan

### Auto-adapted: Store shape mismatch

**Found during:** Task 3 + 4
**Issue:** Plan references `useBoardStore((s) => s.state)` returning `{ kind: 'idle' | ... }` and `antiVirality: boolean`. Actual store (plan 2.4) uses `s.boardState` (string enum) with `'anti-virality'` as a distinct state value.
**Fix:** `deriveFrameVisual` reads `s.boardState` directly. Test uses `useBoardStore.setState({ boardState: 'anti-virality' })`.
**Rule:** Rule 1 (auto-fix bug — incorrect interface assumption)

### Auto-adapted: Badge variant

**Found during:** Task 2
**Issue:** Plan specifies `Badge variant="outline"` — not in project Badge component. Available: `default`, `secondary`, `accent`, `success`, `warning`, `error`, `info`.
**Fix:** Used `variant="secondary"` (neutral subtle style appropriate for count badge).
**Rule:** Rule 1 (auto-fix bug)

### Auto-adapted: Icon size

**Found during:** Task 2
**Issue:** Plan specifies `Icon size={14}` — project Icon component only accepts `16 | 20 | 24 | 32`.
**Fix:** Used `size={16}` (smallest available).
**Rule:** Rule 1 (auto-fix bug)

### TDD ordering note

Task 4 (`tdd="true"`) follows Tasks 1-3 in the plan, meaning implementation existed before tests ran. Tests passed immediately on first run (no RED phase). This is expected behavior from plan ordering (implementation before test task). Documented per TDD gate compliance.

## TDD Gate Compliance

RED gate: Tests were written after implementation (plan ordering: tasks 1-3 implement, task 4 tests). Tests passed immediately — no failing RED phase. Plan ordering precluded a true RED → GREEN cycle. Tests validate correctness of the implementation and serve as regression guard.

## Known Stubs

None. Frame bodies use empty-state copy as explicit placeholder text (correct UX behavior). Children slots are intentionally open — not stubs — with documented contract for plans 2.7 and 2.13.

## Threat Surface Scan

No new security-relevant surface. All components are client-side UI only (no network calls, no auth, no user data persistence). No threat flags.

## Self-Check: PASSED

**Files exist:**
- `src/components/board/GroupFrame.tsx` — FOUND
- `src/components/board/GroupFrameOverlay.tsx` — FOUND
- `src/components/board/__tests__/GroupFrame.test.tsx` — FOUND
- `src/components/board/Board.tsx` — FOUND (modified)

**Commits exist:**
- `2108f30` — FOUND
- `d9cd6c8` — FOUND
- `6aae80b` — FOUND
- `243b8c3` — FOUND

**Tests:** 4/4 passing

---
*Phase: 02-board-substrate-navigation*
*Plan: 02*
*Completed: 2026-05-26*
