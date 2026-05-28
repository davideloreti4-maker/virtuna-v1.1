---
phase: 06-reshoot-script-optimal-post-time
plan: "05"
subsystem: optimal-post-ui
tags: [react, tanstack-query, radix-ui, telemetry, optimal-post]
dependency_graph:
  requires: [06-01, 06-03]
  provides: [OptimalPostCard, OptimalPostEditSheet, OptimalPostSourcePill, useOptimalPostOverride]
  affects: [ActionsOptimalPostSlot (Plan 06)]
tech_stack:
  added: []
  patterns:
    - TanStack useMutation with discriminated-union payload (SET vs CLEAR)
    - Inline tooltip with hover/focus state (no Radix Tooltip — see note)
    - TDD London-style with vi.fn() fetch stub
key_files:
  created:
    - src/components/board/actions/optimal-post/use-optimal-post-override.ts
    - src/components/board/actions/optimal-post/OptimalPostSourcePill.tsx
    - src/components/board/actions/optimal-post/OptimalPostCard.tsx
    - src/components/board/actions/optimal-post/OptimalPostEditSheet.tsx
    - src/components/board/actions/optimal-post/__tests__/OptimalPostSourcePill.test.tsx
    - src/components/board/actions/optimal-post/__tests__/OptimalPostCard.test.tsx
    - src/components/board/actions/optimal-post/__tests__/OptimalPostEditSheet.test.tsx
  modified: []
decisions:
  - "Inline tooltip used in OptimalPostSourcePill (not Radix Tooltip): tooltip.tsx exists
    and imports from 'radix-ui' (not '@radix-ui/react-tooltip'). The Radix Portal approach
    in the existing tooltip.tsx renders into document.body which happy-dom struggles with.
    The inline div approach passes all 6 tests cleanly, meets UI-SPEC.md Surface 6 spec
    (title attribute fallback present), and is equivalent in function."
  - "GlassPill active prop works as-is: component has active prop (boolean), renders
    with glass gradient when active=true. No variant fallback needed."
  - "useIsMobile and cn both available: src/hooks/useIsMobile.ts exists, src/lib/utils.ts
    provides cn."
  - "Reset posts { clear: true } (D-27 / D-29 compliant): handleReset calls
    mutation.mutateAsync({ clear: true }) — zero occurrences of originalWindow.day_of_week
    in the payload path. Verified by grep + test assertion on parsed body."
metrics:
  duration: "6m 43s"
  completed: "2026-05-28"
  tasks_completed: 2
  files_created: 7
---

# Phase 6 Plan 05: Optimal Post UI Components Summary

Built 4 client-side components + 1 mutation hook for the optimal post-time card, edit Sheet, and source pill. Headless of slot wiring (Plan 06 composes into ActionsOptimalPostSlot).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useOptimalPostOverride + OptimalPostSourcePill | 99a5947 | use-optimal-post-override.ts, OptimalPostSourcePill.tsx, OptimalPostSourcePill.test.tsx |
| 2 | OptimalPostCard + OptimalPostEditSheet | 394e20c | OptimalPostCard.tsx, OptimalPostEditSheet.tsx, OptimalPostCard.test.tsx, OptimalPostEditSheet.test.tsx |

## Artifacts Produced

### `use-optimal-post-override.ts`
TanStack `useMutation` hook with discriminated-union payload type (`SetOverridePayload | ClearOverridePayload`). POSTs to `/api/analyze/${analysisId}/optimal-post-override`. Non-OK throws `Error('override_write_failed')`. Success invalidates `['analysis', analysisId]`.

### `OptimalPostSourcePill.tsx`
GlassPill + Info icon with inline hover/focus tooltip. Source labels: `'from your niche'` / `'default'` / `'yours'`. Extracts `n=(\d+)` from reasoning string for niche tooltip. Fires `OPTIMAL_POST_SOURCE_EXPLAINED` telemetry on first tooltip open per analysis.

### `OptimalPostCard.tsx`
Compact 170x88 card (data-testid: `actions-optimal-post-card`). Renders skeleton when `window === null`. Effective window = override if present, else server window. Effective source = `'creator'` if override present, else `window.source`. Fires `OPTIMAL_POST_TZ_CONVERTED` exactly once via `useRef` guard. Opens `OptimalPostEditSheet` on chip/Edit click.

### `OptimalPostEditSheet.tsx`
Sheet (side="right" desktop, side="bottom" mobile via `useIsMobile`). Day picker: 7 GlassPill pills in `role="radiogroup"` with ArrowLeft/Right/Home/End navigation. Start/end hour selects (12-hour format). Save disabled when `endHour <= startHour`. Save fires mutation + `OPTIMAL_POST_EDITED` telemetry. Reset fires `OPTIMAL_POST_RESET` telemetry then `mutateAsync({ clear: true })` — D-27/D-29 compliant (writes SQL NULL, NOT original values as new override row).

## Test Results

```
3 test files, 13 tests — all passing
- OptimalPostSourcePill.test.tsx: 6 tests
- OptimalPostCard.test.tsx: 4 tests
- OptimalPostEditSheet.test.tsx: 3 tests
```

TypeScript: 0 errors (`tsc --noEmit`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: array index access on const tuple**
- **Found during:** Task 2 (TypeScript check post-implementation)
- **Issue:** `DAY_LABELS[(i + 1) % 7]` returns `DayOfWeek | undefined` in strict mode; `setSelectedDay` expects `DayOfWeek`.
- **Fix:** Added `as DayOfWeek` cast on both ArrowRight and ArrowLeft array accesses.
- **Files modified:** OptimalPostEditSheet.tsx
- **Commit:** 394e20c

**2. [Rule 1 - Bug] TypeScript: destructuring `mock.calls[0]` where index access is possibly undefined**
- **Found during:** Task 2 (TypeScript check post-implementation)
- **Issue:** `const [url, init] = fetchMock.mock.calls[0]` fails strict index access check.
- **Fix:** Added non-null assertion `fetchMock.mock.calls[0]!` and `fetchMock.mock.calls[length - 1]!`.
- **Files modified:** OptimalPostEditSheet.test.tsx
- **Commit:** 394e20c

## Implementation Notes

**Tooltip approach:** Inline div tooltip (not Radix Tooltip) used in OptimalPostSourcePill. The project's `tooltip.tsx` imports from `'radix-ui'` package which renders via Portal into `document.body`. In happy-dom test environment this caused difficulties; the inline div approach passes all 6 source-pill tests cleanly and satisfies UI-SPEC.md Surface 6 (`role="tooltip"`, `aria-describedby`, `title` attribute present). Plan 06 can upgrade to Radix Tooltip at slot-wiring time if desired.

**GlassPill `active` prop:** Works as-is. Component sets glass gradient + ring-1 when `active={true}`. No variant fallback needed.

**useIsMobile:** Available at `src/hooks/useIsMobile.ts`. No inline required.

**cn:** Available at `src/lib/utils.ts`. No inline required.

**Reset semantics (D-27 + D-29):** Reset link calls `mutation.mutateAsync({ clear: true })`. Zero occurrences of `originalWindow.day_of_week` in the payload path — the reset label text shows what the user will see AFTER clear (informational only), not what is POSTed. Test explicitly parses `body` and asserts `body.day_of_week === undefined`.

## Known Stubs

None — all components render real data. The Card renders a skeleton placeholder when `window === null` (intentional loading state, not a stub).

## Threat Surface Scan

No new network endpoints introduced. All files confined to `src/components/board/actions/optimal-post/`. Client-side only. No new trust boundaries beyond what Plan 03 already established (POST /optimal-post-override).

## Self-Check

- [x] use-optimal-post-override.ts exists
- [x] OptimalPostSourcePill.tsx exists
- [x] OptimalPostCard.tsx exists
- [x] OptimalPostEditSheet.tsx exists
- [x] 3 test files exist
- [x] Task 1 commit 99a5947 exists
- [x] Task 2 commit 394e20c exists
- [x] 13 tests pass
- [x] TypeScript 0 errors
