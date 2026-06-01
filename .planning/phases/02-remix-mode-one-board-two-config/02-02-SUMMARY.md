---
phase: 02-remix-mode-one-board-two-config
plan: 02
subsystem: ui
tags: [react, typescript, board, konva, layout, remix-mode]

# Dependency graph
requires:
  - phase: 02-remix-mode-one-board-two-config/02-01
    provides: REMIX-01 intent selector and mode threading (Plan 01 of same phase)
provides:
  - GroupId union extended with 'decode' | 'adapt' (board-types.ts)
  - resolveBoardLayout(measured, mode='score'|'remix') — single source of truth (D-08)
  - decode/adapt reuse verdict/actions bounds 1:1 (D-07 positional swap)
  - computePresetTargets fallback: byId.verdict ?? byId.decode (Pitfall 3)
  - AUTO_HEIGHT_FRAMES includes decode and adapt
  - DecodeShellNode / AdaptShellNode — static DOM shells with locked descriptor copy
  - Board.tsx: boardMode const, overlay dispatch for decode/adapt, expanded guard
  - BoardMobile.tsx: MOBILE_ORDER_SCORE/REMIX split, boardMode prop, decode/adapt renderBody
  - GroupFrameOverlay.tsx: decode/adapt in ARIA_LABEL + EMPTY_STATE_COPY
affects: [02-remix-mode-one-board-two-config/02-03, 03-decode-frame, 04-adapt-frame]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 2(a): remix mode reuses verdict/actions bounds by rewriting {id,label} on resolved score frames — no GROUP_FRAMES mutation, no base['decode'] lookup"
    - "boardMode vs mode naming: boardMode = score/remix intent; mode = responsive 'cards'|'desktop' view (useViewMode)"
    - "MOBILE_LABELS fallback record for GroupIds absent from LAYOUT_BY_ID (decode/adapt)"

key-files:
  created:
    - src/components/board/decode/DecodeShellNode.tsx
    - src/components/board/adapt/AdaptShellNode.tsx
    - src/components/board/decode/__tests__/DecodeShellNode.test.tsx
    - src/components/board/adapt/__tests__/AdaptShellNode.test.tsx
  modified:
    - src/components/board/board-types.ts
    - src/components/board/board-constants.ts
    - src/components/board/Board.tsx
    - src/components/board/BoardMobile.tsx
    - src/components/board/GroupFrameOverlay.tsx
    - src/components/board/__tests__/board-constants.test.ts
    - src/components/board/__tests__/BoardMobile.test.tsx

key-decisions:
  - "D-07: decode occupies verdict bounds verbatim, adapt occupies actions bounds verbatim — zero x/y/w/h math changes"
  - "D-08: resolveBoardLayout is the single source of truth; mode param with default 'score' keeps all existing callers byte-identical"
  - "Pattern 2(a) chosen over 2(b): rewrite {id,label} on score frames instead of adding decode/adapt to GROUP_FRAMES — avoids touching the tested 56-assertion gap-regression suite"
  - "boardMode const defaults to 'score'; Plan 03 will thread the live value from stream.result.mode/permalink row"
  - "Shells take no props — static copy, frame title from GroupFrameOverlay title bar (Assumption A1 confirmed)"

requirements-completed: [REMIX-02]

# Metrics
duration: 9min
completed: 2026-06-01
---

# Phase 02 Plan 02: Remix Mode Board Layout Summary

**One-board-two-config: mode-aware resolveBoardLayout swaps verdict+actions to decode+adapt at 1:1 bounds; two static DOM shells wired into desktop overlay and mobile card stack**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-01T16:26:00Z
- **Completed:** 2026-06-01T16:35:04Z
- **Tasks:** 3 (each TDD: RED + GREEN)
- **Files modified:** 9

## Accomplishments

- `GroupId` union extended with `'decode' | 'adapt'`; `AUTO_HEIGHT_FRAMES` includes both
- `resolveBoardLayout(measured, mode='score')` — default param keeps every existing caller byte-identical; remix mode maps verdict→decode, actions→adapt with bounds verbatim (D-07)
- `computePresetTargets` guard: `byId.verdict ?? byId.decode` prevents crash on remix layout (Pitfall 3)
- `DecodeShellNode` / `AdaptShellNode` — 12-line DOM components (not Konva), locked descriptor copy per UI-SPEC §Copywriting
- Board.tsx: `boardMode` const (not `mode` — naming collision avoided), overlay dispatch for decode/adapt, `expanded[layout.id] ?? true` guard
- BoardMobile.tsx: `MOBILE_ORDER_SCORE` / `MOBILE_ORDER_REMIX` split, `boardMode` prop, `renderBody` cases, `LAYOUT_BY_ID` guard with `MOBILE_LABELS` fallback
- GroupFrameOverlay.tsx: decode/adapt in `ARIA_LABEL` ("Decode frame — structural breakdown" / "Adapt frame — niche concepts") and `EMPTY_STATE_COPY` (empty titles — shell owns descriptor)
- 62 tests green, 0 TypeScript errors

## Task Commits

Each task was committed atomically (TDD: test commit then feat commit):

1. **Task 1 RED** — `e351a138` (test: failing remix mode tests for resolveBoardLayout)
2. **Task 1 GREEN** — `300a1db1` (feat: mode-aware resolveBoardLayout + GroupId + camera fallback)
3. **Task 2 RED** — `bea71153` (test: failing tests for DecodeShellNode and AdaptShellNode)
4. **Task 2 GREEN** — `369dca9b` (feat: add DecodeShellNode and AdaptShellNode static DOM shells)
5. **Task 3 RED** — `8d970f34` (test: failing remix mode tests for BoardMobile)
6. **Task 3 GREEN** — `b0f3855c` (feat: wire DecodeShellNode/AdaptShellNode into Board overlay + BoardMobile)

## Files Created/Modified

- `src/components/board/board-types.ts` — GroupId += 'decode' | 'adapt'
- `src/components/board/board-constants.ts` — mode-aware resolveBoardLayout, AUTO_HEIGHT_FRAMES, computePresetTargets fallback
- `src/components/board/decode/DecodeShellNode.tsx` — static DOM shell, descriptor: "Structural breakdown of why this video worked."
- `src/components/board/adapt/AdaptShellNode.tsx` — static DOM shell, descriptor: "Niche-adapted concepts drawn from the source format."
- `src/components/board/Board.tsx` — boardMode const, imports, overlay dispatch, expanded guard, BoardMobile prop
- `src/components/board/BoardMobile.tsx` — MOBILE_ORDER_SCORE/REMIX, boardMode prop, renderBody decode/adapt, LAYOUT_BY_ID guard
- `src/components/board/GroupFrameOverlay.tsx` — ARIA_LABEL + EMPTY_STATE_COPY for decode/adapt
- `src/components/board/__tests__/board-constants.test.ts` — 13 new assertions in describe('remix mode')
- `src/components/board/__tests__/BoardMobile.test.tsx` — 7 new assertions in describe('BoardMobile remix mode')
- `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` — 6 assertions
- `src/components/board/adapt/__tests__/AdaptShellNode.test.tsx` — 6 assertions

## Decisions Made

- Pattern 2(a) chosen: rewrite `{id,label}` on score frames for remix rather than adding decode/adapt to `GROUP_FRAMES`. Avoids touching the gap-regression-tested GROUP_FRAMES constant.
- `boardMode` naming (not `mode`) to avoid collision with responsive view mode from `useViewMode` at Board.tsx:84.
- `boardMode = 'score'` constant for now; Plan 03 threads the live value from `stream.result.mode ?? permalinkRow.mode`.
- Shells take zero props — static copy; GroupFrameOverlay title bar renders label from `layout.label`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `act` variable in computePresetTargets**
- **Found during:** Task 1 GREEN (TypeScript check)
- **Issue:** Added `const act = byId.actions ?? byId.adapt` as a guard but never used it in the return object — TS6133 error
- **Fix:** Removed the unused variable; `content-analysis` always present so no fallback needed
- **Files modified:** src/components/board/board-constants.ts
- **Verification:** `tsc --noEmit` clean
- **Committed in:** b0f3855c (Task 3 commit, included in the fix batch)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: unused variable causing TypeScript error)
**Impact on plan:** Zero scope change. Fix required for clean typecheck.

## Issues Encountered

- Vitest must be invoked via `--root` pointing to the agent worktree because the agent worktree has no `node_modules` of its own; the viral-remix project node_modules provided the runner. Command: `/path/to/viral-remix/node_modules/.bin/vitest run --root /path/to/agent-worktree <test-files>`

## Known Stubs

None — shells render their locked descriptor copy verbatim. The intentional empty state (no decode/adapt frame content this phase) is the design spec (D-10/D-11); content arrives in Phase 3 (DECODE-01/02) and Phase 4 (ADAPT-01/02).

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Plan 02 is pure frontend. Threat mitigations T-02-06 (mode param type guard + default) and T-02-07 (undefined guards) are implemented as specified.

## Next Phase Readiness

- Plan 03 can thread `boardMode` from `stream.result.mode` and permalink row — the `boardMode` const in Board.tsx is the wiring point
- DecodeShellNode / AdaptShellNode are ready to receive content (Phase 3/4 add children props or internal data hooks)
- `resolveBoardLayout(measured, 'remix')` is fully functional and tested

---
*Phase: 02-remix-mode-one-board-two-config*
*Completed: 2026-06-01*

## Self-Check: PASSED

All created files exist. All 6 task commits verified in git log.
