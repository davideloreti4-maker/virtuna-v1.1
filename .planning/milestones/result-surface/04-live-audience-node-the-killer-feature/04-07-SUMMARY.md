---
phase: 04-live-audience-node-the-killer-feature
plan: "07"
subsystem: heatmap-surface
tags: [wave-3, tdd, heatmap, persona-row, css-grid, a11y, color-blind, mobile-sheet]
dependency_graph:
  requires:
    - src/components/board/audience/audience-types.ts (Plan 04-01)
    - src/components/board/audience/audience-constants.ts (Plan 04-01)
    - src/components/board/audience/__tests__/fixtures/heatmap-fixture.ts (Plan 04-01)
    - src/components/ui/sheet.tsx (existing)
    - src/hooks/useIsMobile.ts (existing)
  provides:
    - src/components/board/audience/PersonaRow.tsx
    - src/components/board/audience/HeatmapDrawer.tsx
  affects:
    - Plan 04-08 (AudienceNode renders <HeatmapDrawer> below RetentionCurve)
tech_stack:
  added: []
  patterns:
    - CSS Grid 10×N with proportional fr columns from segment durations
    - L→R cell-fill wave via CSS transition-delay stagger (compositor-only, no JS animation)
    - ARIA grid contract: role=grid + role=row + role=rowheader + role=gridcell
    - aria-rowindex on PersonaRow root for grid row identity
    - Radix Sheet (side=bottom) for mobile bottom-sheet variant
    - grid-template-rows 0fr→1fr CSS transition for desktop inline expand
    - vitest-axe for axe-core a11y assertion in tests
key_files:
  created:
    - src/components/board/audience/PersonaRow.tsx
    - src/components/board/audience/HeatmapDrawer.tsx
  modified:
    - src/components/board/audience/audience-types.ts (added PersonaRowProps, HeatmapDrawerProps, rowIndex? prop)
    - src/components/board/audience/__tests__/PersonaRow.test.tsx (flipped from todos to 10 real tests)
    - src/components/board/audience/__tests__/HeatmapDrawer.test.tsx (flipped from todos to 7 real tests)
    - src/components/board/audience/__tests__/HeatmapDrawer.mobile.test.tsx (flipped from todos to 2 real tests)
    - src/components/board/audience/__tests__/HeatmapDrawer.a11y.test.tsx (flipped from todos to 4 real tests)
decisions:
  - "aria-rowindex lives on PersonaRow root (role=row div) via rowIndex prop, not on HeatmapDrawer wrapper div — wrapper div is inert for ARIA"
  - "Label button wrapped in <div role=rowheader> because <button role=rowheader> is not allowed (aria-allowed-role rule)"
  - "Radix Sheet portal renders into document.body — mobile tests use document.body.querySelector not container.querySelector"
  - "segIdxContainingT handles edge case where t equals last segment t_end"
metrics:
  duration: "~35m"
  completed: "2026-05-27T13:53:00Z"
  tasks_completed: 2
  files_modified: 7
---

# Phase 04 Plan 07: Heatmap Surface Summary

**One-liner:** CSS Grid 10×N heatmap with L→R cell-fill wave, desktop inline expand + mobile Radix Sheet, ARIA grid contract, and color-blind diagonal-stripe mode.

## Tasks Completed

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | PersonaRow component | fcdf667 (RED), b83e790 (GREEN) | Done |
| 2 | HeatmapDrawer + mobile + a11y | fd27409 (RED+fixes), 36af6cb (GREEN) | Done |

## Test Results

- **PersonaRow.test.tsx**: 10/10 passed
- **HeatmapDrawer.test.tsx**: 7/7 passed
- **HeatmapDrawer.mobile.test.tsx**: 2/2 passed
- **HeatmapDrawer.a11y.test.tsx**: 4/4 passed
- **Total**: 23/23 passed, 0 failed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `aria-rowindex` on plain `<div>` violates axe `aria-allowed-attr`**
- **Found during:** Task 2, axe-core test run
- **Issue:** HeatmapDrawer wrapper divs had `aria-rowindex` but no `role` — axe flags this
- **Fix:** Added `rowIndex` prop to `PersonaRowProps`; `aria-rowindex` now lives on PersonaRow's `role="row"` root div
- **Files modified:** audience-types.ts, PersonaRow.tsx, HeatmapDrawer.tsx
- **Commit:** fd27409

**2. [Rule 1 - Bug] `<button role="rowheader">` violates axe `aria-allowed-role`**
- **Found during:** Task 2, axe-core test run
- **Issue:** `<button>` elements do not support `role="rowheader"` per ARIA spec
- **Fix:** Wrapped label `<button>` in `<div role="rowheader">` container
- **Files modified:** PersonaRow.tsx
- **Commit:** fd27409

**3. [Rule 1 - Bug] Mobile test using `container.querySelector` missed Radix Sheet portal**
- **Found during:** Task 2, mobile test run
- **Issue:** Radix Dialog/Sheet renders via `Portal` into `document.body`, not into the React render container
- **Fix:** Changed mobile tests to use `document.body.querySelector('[data-slot="sheet-content"]')`
- **Files modified:** HeatmapDrawer.mobile.test.tsx
- **Commit:** fd27409

## Known Stubs

None — both components are fully implemented with real behavior. No hardcoded empty values flow to UI.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced.
All cell colors derived from `clamp(attention, 0.05, 0.80)` per T-04-14 mitigation.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED (`test(04-07)`) | fcdf667 | PASS |
| Task 1 GREEN (`feat(04-07)`) | b83e790 | PASS |
| Task 2 RED+fixes (`test(04-07)`) | fd27409 | PASS |
| Task 2 GREEN (`feat(04-07)`) | 36af6cb | PASS |

## Self-Check: PASSED

| Item | Result |
|------|--------|
| PersonaRow.tsx | FOUND |
| HeatmapDrawer.tsx | FOUND |
| 04-07-SUMMARY.md | FOUND |
| fcdf667 (test RED PersonaRow) | FOUND |
| b83e790 (feat GREEN PersonaRow) | FOUND |
| fd27409 (test RED HeatmapDrawer) | FOUND |
| 36af6cb (feat GREEN HeatmapDrawer) | FOUND |
