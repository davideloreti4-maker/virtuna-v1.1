---
phase: 02-board-substrate-navigation
plan: 11
subsystem: accessibility
tags: [a11y, vitest-axe, roving-tabindex, keyboard-nav, aria, NF2]

dependency_graph:
  requires:
    - plan: 2.2
      provides: GroupFrameOverlay with role="region" + aria-label
    - plan: 2.5
      provides: Sidebar with aria-label="App navigation"
    - plan: 2.6
      provides: CommandBar with role="combobox" + aria-label
  provides:
    - src/lib/a11y.ts (useRovingTabIndex, useArrowKeyFocusGrid, announce)
    - src/components/board/__tests__/Board.a11y.test.tsx
    - src/components/sidebar/__tests__/Sidebar.a11y.test.tsx
    - src/components/command-bar/__tests__/CommandBar.a11y.test.tsx
  affects:
    - src/components/board/Board.tsx (roving tabindex wired, CommandBar DOM order fixed)
    - src/components/board/GroupFrameOverlay.tsx (forwardRef, tabIndex prop, div titlebar)
    - src/components/sidebar/Sidebar.tsx (aside → nav element)

tech-stack:
  added:
    - vitest-axe@0.1.0 (axe-core powered a11y assertions for vitest)
  patterns:
    - "Roving tabindex: one frame has tabIndex=0, rest -1; arrow keys + Home/End move within group"
    - "DOM order = tab order: CommandBar renders before frame overlay loop (no numeric tabIndex)"
    - "useRovingTabIndex hook: state-driven, updates active index on focus + arrow navigation"
    - "announce() helper: imperative aria-live injector for screen reader announcements"

key-files:
  created:
    - "src/lib/a11y.ts (97 LOC) — useRovingTabIndex, useArrowKeyFocusGrid, announce"
    - "src/components/board/__tests__/Board.a11y.test.tsx"
    - "src/components/sidebar/__tests__/Sidebar.a11y.test.tsx"
    - "src/components/command-bar/__tests__/CommandBar.a11y.test.tsx"
  modified:
    - "src/test/setup.ts (vitest-axe matchers registered)"
    - "src/components/board/Board.tsx (roving tabindex + DOM render order fix)"
    - "src/components/board/GroupFrameOverlay.tsx (forwardRef, tabIndex: 0|-1, div titlebar)"
    - "src/components/sidebar/Sidebar.tsx (aside → nav element)"

key-decisions:
  - "useRovingTabIndex in a11y.ts — one hook owns both arrow-key handler and tab stop rotation; Board.tsx only wires refs and callbacks"
  - "CommandBar moved BEFORE frame overlay loop in Board.tsx DOM order — tab order: Sidebar → CommandBar input → Group frames (roving) → Camera presets"
  - "GroupFrameOverlay: forwardRef added so Board can pass DOM refs for roving tabindex"
  - "aside → nav in Sidebar.tsx — aside has implicit role=complementary; role=navigation on aside is an axe violation (aria-allowed-role rule); nav is the correct semantic element"
  - "header → div in GroupFrameOverlay title bar — header has implicit role=banner; inside a role=region landmark it triggers landmark-banner-is-top-level axe rule; div has no implicit role"
  - "tabIndex prop typed as 0|-1 — positive tabIndex values are FORBIDDEN (global focus order corruption)"

metrics:
  duration: ~8min
  completed: "2026-05-26"
  tasks_completed: 4
  files_created: 4
  files_modified: 4
---

# Phase 02 Plan 11: A11y Audit and Hardening Summary

**vitest-axe wired; zero axe violations on Board, Sidebar, CommandBar; roving tabindex across 6 group frames; DOM tab order enforced via element ordering (no numeric tabIndex).**

## Final Tab Order

```
Sidebar nav (role="navigation")
  → New analysis link
  → Boards / Trending / Settings navitems
  → Recent board links
  → Account button

CommandBar input (role="combobox", tabIndex=0 when idle)

Group frames (roving tabindex — ONE tab stop for the group):
  1. Input (tabIndex=0 by default, roving)
  2. Engine pipeline
  3. Audience analysis
  4. Verdict
  5. Actions
  6. Content analysis

Arrow keys ← → ↑ ↓ move between frames when a frame is focused.
Home → first frame. End → last frame.

CameraOverlay buttons (fixed position, trail frames in DOM order):
  → Overview / Verdict / Audience / Content Analysis / Reset
```

## Accomplishments

### Task 1 — vitest-axe installed

`pnpm add -D vitest-axe@0.1.0` — installed axe-core v4 powered a11y assertion library.
`toHaveNoViolations` matcher registered in `src/test/setup.ts` via `expect.extend`.

### Task 2 — src/lib/a11y.ts

Utility module with three exports:

| Export | Purpose |
|--------|---------|
| `useArrowKeyFocusGrid(refs)` | Arrow-key focus across 1D list; no tab order interference |
| `useRovingTabIndex(refs)` | State-driven roving tabindex: one element has tabIndex=0, rest -1; arrow keys + Home/End |
| `announce(msg, politeness)` | Imperative aria-live injector for screen reader notifications |

### Task 3 — Roving tabindex wired in Board.tsx

- `createRef` array initialized via `useRef` — stable across renders
- `useRovingTabIndex(frameRefs.current)` returns `{ getTabIndex, setActive }`
- Each `GroupFrameOverlay` receives `tabIndex={getTabIndex(i) as 0|-1}` + `onFocus={() => setActive(i)}`
- DOM render order fixed: `<CommandBar>` now renders **before** the `GROUP_FRAMES.map(...)` overlay loop
- Zero positive tabIndex values across all Phase 2 component files (verified)

### Task 4 — vitest-axe tests: 5/5 pass

| File | Tests | Status |
|------|-------|--------|
| `Board.a11y.test.tsx` | 1 | GREEN |
| `Sidebar.a11y.test.tsx` | 1 | GREEN |
| `CommandBar.a11y.test.tsx` | 3 (idle/streaming/complete) | GREEN |
| **Total** | **5** | **All pass** |

## Phase 8 Follow-up

Manual screen reader passes NOT done in Phase 2 (not unit-testable):
- VoiceOver on macOS: verify frame navigation announces region labels
- NVDA on Windows: verify engine stage transitions announce via aria-live
- Keyboard-only navigation pass: tab through entire /analyze page, verify order

These are deferred to Phase 8 accessibility audit per plan spec.

## WCAG AA Contrast Values (from UI-SPEC §Accessibility)

Already verified in prior milestones — no audit needed in Phase 2:

| Token | Ratio | Level |
|-------|-------|-------|
| Foreground (`#ffffff` on `#07080a`) | 18.4:1 | AAA |
| Muted (`#848586` on `#07080a`) | 5.4:1 | AA |
| Accent-foreground (`#1a0f0a` on coral `#FF7F50`) | 7.2:1 | AAA |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `<aside role="navigation">` — axe aria-allowed-role violation**

- **Found during:** Task 4 RED phase (Sidebar.a11y.test.tsx)
- **Issue:** `<aside>` has implicit ARIA role `complementary`. Applying `role="navigation"` to it is not allowed per WAI-ARIA — axe fires `aria-allowed-role` violation.
- **Fix:** Changed `<aside>` to `<nav>` element in `Sidebar.tsx`. `<nav>` has implicit role `navigation` — `aria-label` is kept as-is. Removed the now-redundant `role="navigation"` attribute.
- **Files modified:** `src/components/sidebar/Sidebar.tsx`

**2. [Rule 1 - Bug] `<header>` inside `role="region"` — axe landmark-banner-is-top-level violation**

- **Found during:** Task 4 RED phase (Board.a11y.test.tsx)
- **Issue:** `<header>` has implicit ARIA role `banner`. The WAI-ARIA spec requires `banner` to be a top-level landmark (child of `<body>`). Inside a `role="region"` element, axe fires `landmark-banner-is-top-level`.
- **Fix:** Changed `<header>` to `<div>` in `GroupFrameOverlay.tsx` title bar. Added comment explaining the a11y reasoning. Visual appearance is identical (same classes + height).
- **Files modified:** `src/components/board/GroupFrameOverlay.tsx`

**3. [Rule 1 - Bug] Board.a11y.test.tsx needed QueryClientProvider**

- **Found during:** Task 4 RED phase (Board.a11y.test.tsx)
- **Issue:** `InputDrawer` calls `useSidebarRecent` → `useAnalysisHistory` → `useQuery`, which requires `QueryClientProvider`. The existing `Board.test.tsx` has the same pre-existing failure.
- **Fix:** Added `QueryClientProvider` wrapper in `Board.a11y.test.tsx` render helper (same pattern as `Sidebar.a11y.test.tsx`).
- **Files modified:** `src/components/board/__tests__/Board.a11y.test.tsx`

## Pre-existing Test Failures (Unrelated to Plan 2.11)

| Test file | Failures | Root cause |
|-----------|----------|------------|
| `Board.test.tsx` | 3 | `InputDrawer`→`useSidebarRecent`→`useQuery` missing QueryClientProvider (existed before plan 2.11) |
| `GroupFrame.test.tsx` | 4 | Same root cause (existed before plan 2.11) |

These failures exist in the plan 2.6 SUMMARY ("Pre-existing failures not caused by this plan"). They are out of scope for plan 2.11 and logged for deferred resolution.

## Known Stubs

None. All axe tests are wired to real component renders (not mocked DOM).

## Threat Surface Scan

No new security-relevant surface. All changes are client-side UI/a11y only — no network endpoints, no auth paths, no schema changes.

## Task Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `d6a25ee` | feat(02-11): install vitest-axe@0.1.0 |
| 2 | `4ccd019` | feat(02-11): a11y utility — useRovingTabIndex + announce |
| 3 | `8cfa37f` | feat(02-11): roving tabindex on group frames + DOM tab order |
| 4 (RED) | `143e52e` | test(02-11): vitest-axe assertions for Board, Sidebar, CommandBar |
| 4 (GREEN) | `3e1bcc7` | fix(02-11): fix axe violations — nav element + div titlebar |

## Self-Check: PASSED

**Files exist:**
- `src/lib/a11y.ts` — FOUND
- `src/components/board/__tests__/Board.a11y.test.tsx` — FOUND
- `src/components/sidebar/__tests__/Sidebar.a11y.test.tsx` — FOUND
- `src/components/command-bar/__tests__/CommandBar.a11y.test.tsx` — FOUND
- `src/test/setup.ts` — FOUND (modified)
- `src/components/board/Board.tsx` — FOUND (modified)
- `src/components/board/GroupFrameOverlay.tsx` — FOUND (modified)
- `src/components/sidebar/Sidebar.tsx` — FOUND (modified)

**Tests:** 5/5 axe assertions pass. 98 total tests pass (2 pre-existing failures, unrelated).

**TypeScript:** 0 new errors in plan 2.11 files.

---
*Phase: 02-board-substrate-navigation*
*Plan: 11*
*Completed: 2026-05-26*
