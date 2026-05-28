---
phase: 05
plan: DESIGN-POLISH
subsystem: board-ui
tags: [ui, polish, ux, verdict, actions, audience, sidebar, camera-overlay]
key-files:
  modified:
    - src/components/board/verdict/AntiViralityHeader.tsx
    - src/components/board/verdict/PercentileChip.tsx
    - src/components/board/verdict/VerdictNode.tsx
    - src/components/board/actions/ActionsNode.tsx
    - src/components/board/CameraOverlay.tsx
    - src/components/sidebar/Sidebar.tsx
    - src/components/board/audience/AudienceNode.tsx
  created:
    - src/components/sidebar/__tests__/Sidebar.recent.test.tsx
    - src/components/board/audience/__tests__/AudienceNode.empty-state.test.tsx
decisions:
  - Use native Intl.RelativeTimeFormat instead of adding date-fns (no new dep)
  - Confidence pill uses self-end on right column wrapper rather than restructuring entire PercentileChip
  - Audience empty-state added directly in AudienceNode rather than in HeatmapDrawer
  - min-h-[88px] wrappers added around slot components rather than on PlaceholderCard itself
---

# Phase 05 Design Polish Summary

8 granular UI fixes applied to the Phase 5 board UI (Verdict, Actions, Audience, Sidebar, CameraOverlay). All commits are atomic `fix(05-ux):` prefixed.

## Fix Table

| # | Area | Commit | Files Changed | Before | After |
|---|------|--------|---------------|--------|-------|
| 1 | AV header two-line layout | e186da6 | AntiViralityHeader.tsx + test | `flex h-10 items-center justify-between` — long copy collides with "Post anyway →" | `flex min-h-[40px] flex-col items-start gap-1` when fixCount=0; single-line when fixes exist |
| 2 | Band label weight | 0835a70 | PercentileChip.tsx | `text-xs font-normal text-white/60` — too subdued | `text-[13px] font-medium text-white/80 mt-0.5` — clear hierarchy |
| 3 | Confidence pill alignment | d076b93 | PercentileChip.tsx | Confidence pill aligned to percentile baseline (top) | `self-end` on right column — dot aligns with band label baseline |
| 4 | Sidebar recent boards | 75bee1c | Sidebar.tsx + Sidebar.recent.test.tsx | "Untitled board" for all entries | `content_text.slice(0,38)` or `Analysis · {relative time}` + coral score chip |
| 5 | Kbd shortcut title hint | ef586cb | CameraOverlay.tsx + test TS cleanup | No `title` attr on tab buttons | `title="Press {key} to switch view"` on all preset + Reset buttons |
| 6 | Audience empty-state copy | a2908fe | AudienceNode.tsx + AudienceNode.empty-state.test.tsx | Empty chart with no copy when personas absent | Italic centered "Persona data isn't available for this analysis" overlay |
| 7 | Actions grid min-h | 40f562f | ActionsNode.tsx | Inconsistent slot heights; lonely empty card | `min-h-[88px]` wrappers on all 4 slots; `grid-rows-2 auto-rows-fr` on grid |
| 8 | Verdict frame padding | 9de8597 | VerdictNode.tsx | Score + band + confidence crowd into top ~80px | `pb-2` wrapper on PercentileChip; `mt-2` on collapsibles slot |

## Deviations from Plan

**1. [Rule 3 - Blocker] date-fns not installed**
- Found during: Fix 4
- Issue: Spec asked for `date-fns/formatDistanceToNowStrict`; package not in deps
- Fix: Used native `Intl.RelativeTimeFormat` instead — equivalent output, no new dep
- Files: Sidebar.tsx (helper function `relativeTime`)

**2. [Rule 1 - TS] Unused import in Sidebar.recent.test.tsx**
- Found during: Fix 5 (tsc check revealed)
- Issue: Static `import { Sidebar }` was unused since tests use `vi.doMock` + dynamic import
- Fix: Replaced with a comment explaining the pattern
- Commit: ef586cb

## Tests Added

| File | Tests | Coverage |
|------|-------|----------|
| AntiViralityHeader.test.tsx | +1 (two-line layout) | fixCount=0 → flex-col + min-h |
| Sidebar.recent.test.tsx | 5 new | content snippet, truncation, null fallback, score chip, dash when null |
| AudienceNode.empty-state.test.tsx | 4 new | null heatmap, empty personas, populated (no overlay), streaming (no overlay) |

## Self-Check

**Test counts:** Baseline 1573 passed / 5 failed → Final 1583 passed / 5 failed. Net +10 passing tests, 0 new failures.

**TS errors:** 3 pre-existing errors in `src/app/api/analysis/[id]/route.ts` (not introduced by this work). 0 new TS errors.

**Commits exist:**
- e186da6 fix(05-ux): two-line AV header layout when fixCount=0
- 0835a70 fix(05-ux): bump band label weight for visual hierarchy
- d076b93 fix(05-ux): align confidence pill to band label baseline
- 75bee1c fix(05-ux): sidebar recent boards show content snippet + score chip
- ef586cb fix(05-ux): kbd shortcut hints + sidebar test TS cleanup
- a2908fe fix(05-ux): audience empty-state copy when persona data unavailable
- 40f562f fix(05-ux): actions grid min-h and row alignment
- 9de8597 fix(05-ux): verdict frame padding for vertical rhythm

## Self-Check: PASSED
