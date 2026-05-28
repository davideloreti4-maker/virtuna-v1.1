---
phase: 02-board-substrate-navigation
plan: 3
subsystem: board-nodes
tags: [konva, dom-overlay, node-primitive, aria, tdd, world-screen-transform]

dependency_graph:
  requires:
    - phase: 02-board-substrate-navigation (Plan 01)
      provides: board-types.ts, board-constants.ts (FRAME_CORNER_RADIUS)
    - phase: 02-board-substrate-navigation (Plan 04)
      provides: useBoardStore with camera state
    - phase: 02-board-substrate-navigation (Plan 02)
      provides: Konva+DOM hybrid pattern (GroupFrame+GroupFrameOverlay), GlassPanel import path
  provides:
    - src/components/board/board-types.ts (NodeSpec, NodeStatus types appended)
    - src/components/board/Node.tsx (Konva hit-test + selected outline)
    - src/components/board/NodeOverlay.tsx (DOM content wrapper, a11y, world→screen)
    - src/components/board/__tests__/Node.test.tsx (4 tests, RED→GREEN TDD)
  affects:
    - Plans 2.7 (InputNode composes Node + NodeOverlay)
    - Plans 2.13, Phase 4, Phase 5 (all concrete nodes compose this primitive)

tech-stack:
  added: []
  patterns:
    - "Hybrid Konva+DOM node pattern: mirrors GroupFrame+GroupFrameOverlay but for individual nodes"
    - "World→screen: screenX = world.x * scale + camera.x (same formula as plan 2.2)"
    - "NodeOverlay wraps GlassPanel from @/components/primitives/GlassPanel (not @/components/ui)"
    - "role=button + aria-pressed + tabIndex for keyboard-accessible board nodes"
    - "Enter/Space keydown handler prevents default and calls onTap"

key-files:
  created:
    - "src/components/board/Node.tsx (38 LOC)"
    - "src/components/board/NodeOverlay.tsx (59 LOC)"
    - "src/components/board/__tests__/Node.test.tsx (65 LOC)"
  modified:
    - "src/components/board/board-types.ts (NodeSpec + NodeStatus appended, 10 lines)"

key-decisions:
  - "GlassPanel import from @/components/primitives/GlassPanel — not @/components/ui (GlassPanel is not in ui/index.ts)"
  - "NodeOverlay rounded-[8px] inner radius (CLAUDE.md: inputs/buttons = 8px radius, not 12px cards)"
  - "NodeSpec.tabIndex is optional — consumers set explicit order for spatial reading (Input→Engine→Audience→Verdict→Actions→Content Analysis)"
  - "STATUS_STROKE map covers all 5 NodeStatus values; only streaming differs (0.10 vs 0.06)"
  - "fill=transparent on Konva Rect — body content lives entirely in DOM overlay, not Konva"

metrics:
  duration: ~10min
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 03: Node Base Primitive Summary

**Hybrid Konva+DOM node primitive: `<Node>` (Konva hit-test outline) + `<NodeOverlay>` (DOM content wrapper) — the composable contract all concrete nodes (Input, Audience, Verdict, Actions, Content Analysis, Engine children) build against.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-05-26
- **Tasks:** 3 of 3
- **Files created:** 3 (Node.tsx, NodeOverlay.tsx, Node.test.tsx)
- **Files modified:** 1 (board-types.ts)

## Accomplishments

### NodeSpec contract (board-types.ts)

```ts
export type NodeStatus = 'idle' | 'pending' | 'streaming' | 'complete' | 'error';

export interface NodeSpec {
  id: string;        // unique node id
  groupId: GroupId;  // which group container this node lives inside
  bounds: Rect;      // world-space rectangle (absolute, NOT relative to group)
  ariaLabel: string; // screen-reader label
  tabIndex?: number; // explicit tab order; defaults to spatial ordering
}
```

**NodeSpec is the single contract for "a node on the board."** Plans 2.7 and 2.13 supply a `NodeSpec` and receive a rendered, keyboard-accessible node in return. Do NOT fork.

**Spatial reading order** (tab order when `tabIndex` not overridden): Input → Engine → Audience → Verdict → Actions → Content Analysis. Consumers assign `tabIndex` values 1-6 if explicit ordering is needed.

### Node.tsx — Konva spatial layer

Renders a transparent Konva `Rect` for hit-testing and outline. No text inside Konva (per RESEARCH §Anti-Patterns). Coral `#FF7F50` border (2px) when `selected=true`. `STATUS_STROKE` map:

| NodeStatus | Stroke |
|------------|--------|
| `idle` | `rgba(255,255,255,0.06)` |
| `pending` | `rgba(255,255,255,0.06)` |
| `streaming` | `rgba(255,255,255,0.10)` |
| `complete` | `rgba(255,255,255,0.06)` |
| `error` | `rgba(255,255,255,0.06)` |

Corner radius: `FRAME_CORNER_RADIUS - 4 = 8px` (Raycast input/button radius).

### NodeOverlay.tsx — DOM content wrapper

World→screen transform (identical formula to plan 2.2 `GroupFrameOverlay`):

```ts
const screenX = spec.bounds.x * camera.scale + camera.x;
const screenY = spec.bounds.y * camera.scale + camera.y;
const screenW = spec.bounds.width * camera.scale;
const screenH = spec.bounds.height * camera.scale;
```

**A11y contract:**
- `role="button"` + `tabIndex={spec.tabIndex ?? 0}` + `aria-label={spec.ariaLabel}` + `aria-pressed={selected}`
- `onKeyDown`: Enter + Space → `onTap?.()` (prevents default for Space scroll)
- `data-node-id` + `data-status` for E2E selectors

**GlassPanel inner container:** `@/components/primitives/GlassPanel` (5px blur, Raycast gradient, border 0.06, inset shadow). Inner radius overridden to 8px via `rounded-[8px]`.

### Composition pattern (for plan 2.7+)

```tsx
// Plan 2.7 InputNode pattern:
<Layer>
  <Node spec={nodeSpec} status={status} selected={selected} onTap={handleSelect} />
</Layer>
<div className="absolute inset-0 pointer-events-none overflow-hidden">
  <NodeOverlay spec={nodeSpec} camera={camera} status={status} selected={selected} onTap={handleSelect}>
    {/* body content */}
  </NodeOverlay>
</div>
```

## Task Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `84c1eb0` | feat(02-03): extend board-types with NodeSpec and NodeStatus |
| 2 | `f97e6ce` | feat(02-03): Node Konva hit-test shape with selected/status outline |
| 3 (RED) | `2456584` | test(02-03): add failing NodeOverlay tests (RED) |
| 3 (GREEN) | `65a14b4` | feat(02-03): NodeOverlay DOM content wrapper with world→screen projection |

## Tests

4 Vitest tests in `src/components/board/__tests__/Node.test.tsx` — all pass:

| Test | Description |
|------|-------------|
| 1 | Projects world bounds to screen using camera transform (scale=2, translate offset) |
| 2 | Has `role=button`, `aria-label`, `tabIndex=0` |
| 3 | Enter keydown invokes onTap |
| 4 | Space keydown invokes onTap |

## TDD Gate Compliance

RED gate: `test(02-03)` commit `2456584` — tests written before implementation, confirmed failing (module resolution error).
GREEN gate: `feat(02-03)` commit `65a14b4` — implementation written, all 4 tests pass.

## Deviations from Plan

### Auto-adapted: GlassPanel import path

**Found during:** Task 3
**Issue:** Plan specifies `import { GlassPanel } from '@/components/ui'` — `GlassPanel` is NOT in `src/components/ui/index.ts`. It lives in `src/components/primitives/GlassPanel.tsx`.
**Fix:** Import updated to `import { GlassPanel } from '@/components/primitives/GlassPanel'`.
**Rule:** Rule 1 (auto-fix bug — wrong import path from plan)

## Known Stubs

None. `NodeOverlay` renders `children` directly — no placeholder text. Body content is wired by upstream consumers (plan 2.7 for InputNode, future plans for other node types).

## Threat Surface Scan

No new security-relevant surface. All components are client-side UI only (no network calls, no auth, no user data persistence). No threat flags.

## Self-Check: PASSED

**Files exist:**
- `src/components/board/board-types.ts` — FOUND (modified)
- `src/components/board/Node.tsx` — FOUND
- `src/components/board/NodeOverlay.tsx` — FOUND
- `src/components/board/__tests__/Node.test.tsx` — FOUND

**Commits exist:**
- `84c1eb0` — FOUND
- `f97e6ce` — FOUND
- `2456584` — FOUND
- `65a14b4` — FOUND

**Tests:** 4/4 passing

---
*Phase: 02-board-substrate-navigation*
*Plan: 03*
*Completed: 2026-05-26*
