---
phase: 05
plan: 09
subsystem: board
tags: [integration, board-wiring, content-analysis-frame, phase-5]
dependency_graph:
  requires: [05-02, 05-05, 05-07, 05-08]
  provides: [ContentAnalysisFrame, Board.tsx-full-wiring]
  affects: [Board.tsx, GroupFrame.test.tsx, HookDecompNode.tsx, EmotionArcNode.tsx]
tech_stack:
  added: []
  patterns: [horizontal-split-frame, render-switch-wiring]
key_files:
  created:
    - src/components/board/content-analysis/ContentAnalysisFrame.tsx
  modified:
    - src/components/board/Board.tsx
    - src/components/board/content-analysis/HookDecompNode.tsx
    - src/components/board/content-analysis/EmotionArcNode.tsx
    - src/components/board/__tests__/GroupFrame.test.tsx
decisions:
  - result.heatmap.segments is the correct path for hook zone derivation (confirmed from HookDecompNode Props interface: segments: ReadonlyArray<Segment> where Segment has is_hook_zone)
  - role=none on header elements removes banner landmark axe violation when nested inside role=region
  - GroupFrame anti-virality stroke count is 3 (verdict+audience+actions) not 2 as prior test assumed
metrics:
  duration_minutes: 12
  completed_at: "2026-05-28T06:37:37Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 05 Plan 09: Final Board Wiring — ContentAnalysisFrame + Board.tsx Switch Summary

ContentAnalysisFrame horizontal split (HookDecompNode left 480px + EmotionArcNode right flex-1) wired into Board.tsx alongside VerdictNode and ActionsNode, completing the render switch for all 6 group ids.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build ContentAnalysisFrame.tsx | e67fbb0 | src/components/board/content-analysis/ContentAnalysisFrame.tsx |
| 2 | Wire VerdictNode + ActionsNode + ContentAnalysisFrame into Board.tsx | cc84e53 | Board.tsx, GroupFrame.test.tsx, HookDecompNode.tsx, EmotionArcNode.tsx |

## Output Spec Answers

**result.heatmap.segments path confirmed:** HookDecompNode.tsx line 18-23 defines `interface Segment { t_start, t_end, is_hook_zone, label? }` and its Props accepts `segments: ReadonlyArray<Segment> | null | undefined`. ContentAnalysisFrame passes `result?.heatmap?.segments ?? null` — the `??` chain handles undefined intermediate fields during streaming states.

**Phase 5 test files:** 27 test files across board/__tests__/, verdict/__tests__/, actions/__tests__/, content-analysis/__tests__/. **201 tests pass** after plan 05-09 changes.

**All 6 group ids wired in Board.tsx:**
- `input` — InputNodeShape (Konva) + InputNodeOverlay (DOM), handled outside the GROUP_FRAMES switch
- `engine` — EngineGroup (unchanged from Phase 2)
- `audience` — AudienceNode (unchanged from Phase 4)
- `verdict` — VerdictNode (Plan 05-02, wired here)
- `actions` — ActionsNode (Plan 05-05, wired here)
- `content-analysis` — ContentAnalysisFrame (Plan 05-09, wired here)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Accessibility] Nested landmark violation in HookDecompNode + EmotionArcNode**
- **Found during:** Task 2 — axe scan via Board.a11y.test.tsx
- **Issue:** `<header>` elements in HookDecompNode and EmotionArcNode have implicit `role="banner"`. When these components are rendered inside GroupFrameOverlay (`role="region"`), axe reports `landmark-banner-is-top-level` violation. GroupFrameOverlay already had a comment noting this pattern and uses `<div>` for its own title bar for this exact reason.
- **Fix:** Added `role="none"` to `<header>` elements in both components. This removes the banner landmark semantics while preserving the HTML element and its visual styling.
- **Files modified:** src/components/board/content-analysis/HookDecompNode.tsx, EmotionArcNode.tsx
- **Commit:** cc84e53

**2. [Rule 1 - Bug] GroupFrame.test.tsx stale anti-virality stroke count**
- **Found during:** Task 2 — test expected 2, got 3
- **Issue:** Test at line 104 expected `orangeStrokes.length === 2` (verdict + audience). But `cross-group-state.ts` AFFECTED_FRAMES already includes `actions` in the anti-virality set. Before plan 05-09, ActionsNode wasn't wired so the frame rendered an empty GroupFrame but its Konva Rect still applied the anti-virality stroke. The test was written expecting only 2 but the design always intended 3.
- **Fix:** Updated expected count to 3, updated comment.
- **Files modified:** src/components/board/__tests__/GroupFrame.test.tsx
- **Commit:** cc84e53

**3. [Rule 1 - Bug] GroupFrame.test.tsx stale empty-state copy assertion**
- **Found during:** Task 2 — "Final virality call" text no longer rendered
- **Issue:** Test asserted empty-state copy text ("Final virality call", "Recommended next moves", "Hook breakdown · tags · drivers") was visible for verdict/actions/content-analysis frames. These texts come from GroupFrameOverlay's fallback when `hasRealChildren` returns false. After wiring real node bodies, `hasRealChildren` returns true and empty-state copy is suppressed — which is correct behavior.
- **Fix:** Replaced empty-state copy assertion with real testid checks (`verdict-node`, `actions-node`, `content-analysis-frame`), and updated test description to reflect plan 05-09 wiring intent.
- **Files modified:** src/components/board/__tests__/GroupFrame.test.tsx
- **Commit:** cc84e53

## Known Stubs

None — ContentAnalysisFrame wires directly to `useAnalysisStream` result fields. All data paths are live or gracefully null-guarded.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. ContentAnalysisFrame subscribes to the existing `useAnalysisStream` hook (same SSE-backed key). T-05-40 accepted: TanStack Query memoizes the hook; no additional network cost.

## Deferred Items (Out of Scope)

- `Sidebar a11y no violations expanded` — pre-existing failure caused by missing Supabase env vars in test environment. Not related to plan 05-09. Logged to deferred-items.

## Self-Check: PASSED

- [x] ContentAnalysisFrame.tsx exists: `ls src/components/board/content-analysis/ContentAnalysisFrame.tsx` → 0
- [x] Board.tsx wired: 5 layout.id switches present (engine, audience, verdict, actions, content-analysis)
- [x] Commit e67fbb0 exists: feat(05-09): add ContentAnalysisFrame
- [x] Commit cc84e53 exists: feat(05-09): wire VerdictNode + ActionsNode + ContentAnalysisFrame
- [x] 201 Phase 5 tests pass, 0 failures
- [x] tsc --noEmit clean for all modified files
