---
phase: 02-board-substrate-navigation
plan: 7
subsystem: board-nodes/input-drawer
tags: [input-node, drawer, sheet, tdd, recent-picker, konva, dom-overlay, responsive]

dependency_graph:
  requires:
    - phase: 02-board-substrate-navigation (Plan 03)
      provides: Node.tsx, NodeOverlay.tsx, NodeSpec, NodeStatus
    - phase: 02-board-substrate-navigation (Plan 04)
      provides: board-store (openInputDrawer, closeInputDrawer, boardState)
    - phase: 02-board-substrate-navigation (Plan 02)
      provides: GroupFrameOverlay children slot for input frame body
  provides:
    - src/components/board/InputNode.tsx (InputNodeShape + InputNodeOverlay)
    - src/components/board/InputDrawer.tsx (Sheet wrapper + Recent picker + ContentForm)
    - src/components/sidebar/use-sidebar-queries.ts (useSidebarRecent hook)
    - src/components/board/board-constants.ts (INPUT_NODE_BOUNDS appended)
    - src/components/board/__tests__/InputDrawer.test.tsx (3 tests, RED→GREEN TDD)
  affects:
    - src/components/board/Board.tsx (InputNodeShape, InputNodeOverlay, InputDrawer mounted)

tech-stack:
  added: []
  patterns:
    - "InputNodeShape (Konva Layer child) + InputNodeOverlay (DOM overlay sibling) — mirrors Node+NodeOverlay pattern from plan 2.3"
    - "InputDrawer uses Radix Sheet; side='left' on desktop (>=768px), side='bottom' on mobile"
    - "useIsDesktop: matchMedia('(min-width: 768px)') with addEventListener for responsive side"
    - "useSidebarRecent wraps useAnalysisHistory() and projects to {pages: [[top-3 SidebarAnalysis]]} shape"
    - "ContentForm prefill workaround: key-based remount (no initialValues prop on ContentForm)"
    - "Recent picker caption-only: content_text.slice(0,80) as display title; file rehydration deferred"

key-files:
  created:
    - "src/components/board/InputNode.tsx (57 LOC)"
    - "src/components/board/InputDrawer.tsx (108 LOC)"
    - "src/components/sidebar/use-sidebar-queries.ts (51 LOC)"
    - "src/components/board/__tests__/InputDrawer.test.tsx (72 LOC)"
  modified:
    - "src/components/board/board-constants.ts (INPUT_NODE_BOUNDS added, 8 lines)"
    - "src/components/board/Board.tsx (imports + 3 mount points, 9 lines)"

key-decisions:
  - "ContentForm has NO initialValues/defaultValues prop — prefill implemented via key-remount (ContentForm re-mounts when user taps Recent item). Full prefill extension deferred to TODO in Known Stubs."
  - "useSidebarRecent() created in src/components/sidebar/use-sidebar-queries.ts — plan 2.5 never created it (used useAnalysisHistory directly in Sidebar.tsx). New hook provides the pages[] shape described in plan 2.7 interfaces."
  - "InputNodeShape/InputNodeOverlay use openInputDrawer() action (not transition({ type:'OPEN_INPUT_DRAWER' }) as plan suggested — transition() only accepts STAGE_UPDATE per board-store)"
  - "Recent picker display title = content_text.slice(0,80) — analysis_results table has content_text, not a title field"
  - "InputNodeOverlay thumbnailUrl/snippet passed as null stubs — wired to real data in future plan (when analysis results surface to board)"
  - "InputNodeShape selected=false — full selection wiring deferred to Phase 4 per plan note"

metrics:
  duration: ~6min
  completed: "2026-05-26"
  tasks_completed: 4
  files_created: 4
  files_modified: 2
---

# Phase 02 Plan 07: Input Node + Drawer Summary

**Compact Input node card (200x100) on the board canvas; tap opens a slide-out Sheet drawer with Recent inputs picker (top 3 from history) and ContentForm for re-running analysis in place.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-05-26
- **Tasks:** 4 of 4
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

### INPUT_NODE_BOUNDS (board-constants.ts)

```ts
export const INPUT_NODE_BOUNDS = {
  x: 16,                    // FRAME_PADDING
  y: 16 + TITLE_BAR_HEIGHT, // below title bar + FRAME_PADDING
  width: 200,
  height: 100,
} as const;
```

Sits inside the Input group frame (240×160). 16px padding on all sides from frame edge.

### InputNode (InputNode.tsx)

Two exports following the Node+NodeOverlay hybrid pattern from plan 2.3:

| Export | Layer | Responsibility |
|--------|-------|----------------|
| `InputNodeShape` | Konva Layer | Hit-test Rect + selected coral outline |
| `InputNodeOverlay` | DOM div overlay | 60px thumbnail + label + snippet text |

Tap on either shape calls `openInputDrawer()` from board-store. `selectedNodeId` check provides `selected` prop to overlay.

**Empty state** (thumbnailUrl/snippet = null): thumbnail area shows `bg-white/[0.05]` placeholder; snippet shows `'Paste URL, drop file, or describe in command bar'`.

### useSidebarRecent (use-sidebar-queries.ts)

Thin wrapper over `useAnalysisHistory()` projecting the response to the `SidebarAnalysis[]` shape the plan described. Returns `{ data: { pages: [[...top3]] }, isLoading }`.

```ts
export interface SidebarAnalysis {
  id: string;
  title: string | null; // content_text.slice(0, 80)
}
```

### InputDrawer (InputDrawer.tsx)

- **Open condition:** `boardState === 'edit-input'`
- **Side:** left (desktop ≥768px) / bottom (mobile)
- **Recent picker:** top-3 from `useSidebarRecent()`; empty state: "No recent inputs yet"
- **Recent prefill:** key-based re-mount of ContentForm with local `prefillCaption` state
- **Submit:** calls `closeInputDrawer()` then `stream.start(...)` — board transitions via plan 2.6 wiring
- **Close:** `onOpenChange(false)` → `closeInputDrawer()` → restores `preDrawerState` (idle/complete)

### Board.tsx mounts

```tsx
// Konva layer (inside BoardCanvas children):
<InputNodeShape selected={false} />

// DOM overlay div (after GroupFrameOverlay loop):
<InputNodeOverlay camera={camera} thumbnailUrl={null} snippet={null} />

// Below overlay div (Radix Sheet portal):
<InputDrawer />
```

## Task Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `03f961e` | feat(02-07): extend board-constants with INPUT_NODE_BOUNDS |
| 2 | `8820d54` | feat(02-07): InputNode compact card — Konva shape + DOM overlay |
| 3 (RED) | `fb88e4d` | test(02-07): add failing InputDrawer tests (RED) |
| 3 (GREEN) | `3aab56b` | feat(02-07): InputDrawer Sheet + Recent picker + form wiring (GREEN) |
| 4 | `60ed30b` | feat(02-07): mount InputNode + InputDrawer in Board.tsx |

## Tests

3 Vitest tests in `src/components/board/__tests__/InputDrawer.test.tsx` — all pass:

| Test | Description |
|------|-------------|
| 1 | Hidden when boardState != 'edit-input' |
| 2 | Open when edit-input — shows "Edit input" + "Recent inputs" headers |
| 3 | Empty state: "No recent inputs yet" when history returns [] |

## TDD Gate Compliance

RED gate: `test(02-07)` commit — tests written before InputDrawer.tsx existed; confirmed failing (module resolution error on `../InputDrawer`).
GREEN gate: `feat(02-07)` commit `3aab56b` — implementation written, all 3 tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] transition() API mismatch**
- **Found during:** Task 2
- **Issue:** Plan code used `transition({ type: 'OPEN_INPUT_DRAWER' })` — board-store `transition()` only accepts `{ type: 'STAGE_UPDATE'; stage: string }`. No OPEN_INPUT_DRAWER event type exists.
- **Fix:** Use `openInputDrawer()` action directly (already exists in board-store from plan 2.4).
- **Files modified:** InputNode.tsx (Task 2), InputDrawer.tsx (Task 3)

**2. [Rule 1 - Bug] Text component API mismatch**
- **Found during:** Task 3
- **Issue:** Plan used `<Text as="h3" size="xs">` — Text component only accepts `as="p"|"span"|"div"` and `size="sm"|"base"|"lg"`. `h3` and `xs` are not valid.
- **Fix:** Use plain `<h3>` and `<p>` HTML elements with Tailwind classes.
- **Files modified:** InputDrawer.tsx

**3. [Rule 2 - Missing Critical Functionality] useSidebarRecent hook missing**
- **Found during:** Task 3
- **Issue:** Plan 2.5 summary confirms it used `useAnalysisHistory()` directly; `useSidebarRecent()` was never created. Plan 2.7 imports it from `@/components/sidebar/use-sidebar-queries`.
- **Fix:** Created `src/components/sidebar/use-sidebar-queries.ts` with `useSidebarRecent()` hook wrapping `useAnalysisHistory()` and projecting to `SidebarAnalysis[]`.
- **Files created:** src/components/sidebar/use-sidebar-queries.ts

**4. [Rule 1 - Bug] ContentForm has no initialValues prop**
- **Found during:** Task 3
- **Issue:** Plan's InputDrawer code passed `initialValues={prefill}` to ContentForm — ContentForm only accepts `onSubmit`, `uploadProgress`, `className`. No initialValues/defaultValues prop.
- **Fix:** Key-remount approach: `<ContentForm key={prefillKey-caption} ... />` — when user selects a Recent item, the key changes, ContentForm re-mounts with fresh local state. Caption prefill is stored locally and could be wired to ContentForm internal state in a future extension.
- **Files modified:** InputDrawer.tsx

## ContentForm initialValues — TODO

ContentForm does NOT accept `initialValues`. To fully prefill the form when a Recent input is tapped, ContentForm needs an `initialValues?: Partial<ContentFormData>` prop added. The current workaround (key-remount) re-mounts ContentForm to a clean state — the `prefillCaption` is stored in InputDrawer state but not passed into ContentForm because the prop doesn't exist yet.

**Next step (follow-up, deferred):** Add `initialValues?: Partial<ContentFormData>` to ContentForm, use `useState` initializer from the prop, and wire `setPrefillCaption` → `initialValues.caption` in InputDrawer. This is safe to defer — the drawer opens and ContentForm is functional; Recent taps just don't prefill text.

## Recent-picker prefill semantics

Currently caption-only. The `SidebarAnalysis` shape only surfaces `content_text` (truncated to 80 chars). Full re-hydration (file uploads, niche, hashtags, video storage path) requires:
1. `useAnalysisDetail(id)` lookup on Recent item tap
2. Mapping `analysis_results.video_storage_path` → VideoUpload component
3. This is deferred to the Workspace milestone.

## Pattern reuse for Phase 5 ghost node (D-16)

The `InputNodeShape` + `InputNodeOverlay` pair establishes the two-file hybrid pattern for any future concrete node. For the optional "previous-analysis ghost node" (D-16 §Ghost beside Input):
1. Create `GhostNodeShape` + `GhostNodeOverlay` following the same pattern
2. Supply a `NodeSpec` with `groupId: 'input'` and bounds positioned to the right of `INPUT_NODE_BOUNDS`
3. Ghost would be `status="complete"` with reduced opacity via className on NodeOverlay
4. Tap opens the historical analysis detail view (not a drawer — a page nav)

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| thumbnailUrl=null | Board.tsx → InputNodeOverlay | Not wired yet; requires completed analysis result surfaced to board |
| snippet=null | Board.tsx → InputNodeOverlay | Same as thumbnailUrl |
| selected=false | Board.tsx → InputNodeShape | Selection wiring deferred to Phase 4 |
| ContentForm prefill | InputDrawer.tsx | ContentForm lacks initialValues prop; key-remount used as workaround |

## Threat Surface Scan

No new security-relevant surface. All components are client-side UI only. `useSidebarRecent` uses `useAnalysisHistory()` which fetches from `/api/analysis/history` — an already RLS-protected endpoint (existing route, no new auth surface). No threat flags.

## Self-Check: PASSED

**Files exist:**
- `src/components/board/board-constants.ts` — FOUND (modified, INPUT_NODE_BOUNDS added)
- `src/components/board/InputNode.tsx` — FOUND
- `src/components/board/InputDrawer.tsx` — FOUND
- `src/components/sidebar/use-sidebar-queries.ts` — FOUND
- `src/components/board/__tests__/InputDrawer.test.tsx` — FOUND
- `src/components/board/Board.tsx` — FOUND (modified)

**Commits exist:**
- `03f961e` — FOUND
- `8820d54` — FOUND
- `3aab56b` — FOUND
- `60ed30b` — FOUND

**Tests:** 3/3 InputDrawer tests passing

---
*Phase: 02-board-substrate-navigation*
*Plan: 07*
*Completed: 2026-05-26*
