---
phase: 06-reshoot-script-optimal-post-time
plan: "06"
subsystem: board-actions
tags: [wave-4, integration, ui-wiring, typescript]
dependency_graph:
  requires: [06-01, 06-02, 06-03, 06-04, 06-05]
  provides: [ActionsReshootHeroSlot-wired, ActionsOptimalPostSlot-wired, ActionsNode-complete, database-types-patched]
  affects: [board-actions-node, analysis-results-types]
tech_stack:
  added: []
  patterns: [phase-gate-conditional-render, discriminated-union-branching, slot-wrapper-inner-swap, vi.doMock-module-isolation]
key_files:
  created: []
  modified:
    - src/components/board/actions/ActionsReshootHeroSlot.tsx
    - src/components/board/actions/ActionsOptimalPostSlot.tsx
    - src/components/board/actions/ActionsNode.tsx
    - src/components/board/actions/__tests__/ActionsNode.test.tsx
    - src/types/database.types.ts
decisions:
  - "empty-state wins over AV per D-22 defensive rule — both branches render ScriptEmptyState"
  - "postOverride cast uses unknown as intermediate to avoid TS2352 overlap error"
  - "mockStream default in tests now includes id + optimal_post_window so complete-state tests render real cards"
  - "QueryClientProvider wrapping NOT needed — useOptimalPostOverride mutation mocked, no TanStack context required"
  - "Sheet primitive DID need mocking — Radix portal causes issues in happy-dom env"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-28T12:04:39Z"
  tasks_completed: 4
  files_modified: 5
---

# Phase 06 Plan 06: Wave 4 Integration — ActionsNode Slot Wiring Summary

Wave 4 final integration: replaced Phase 5 placeholder slots with real Wave-3 UI components (ScriptBody, ScriptInspectorTrigger, ScriptEmptyState, OptimalPostCard) gated by analysis phase + empty-state + AV state. Patched database.types.ts with two new JSONB columns. Updated test suite with Phase 6 testid migrations + 3 new behavior tests, all green.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Refactor ActionsReshootHeroSlot with 5-state branching | aec1643 | ActionsReshootHeroSlot.tsx |
| 2 | Refactor ActionsOptimalPostSlot with outer wrapper + OptimalPostCard | 948532e | ActionsOptimalPostSlot.tsx |
| 3 | Wire ActionsNode + patch database.types.ts | 531f38a | ActionsNode.tsx, database.types.ts |
| 4 | Update ActionsNode.test.tsx + new Phase 6 tests | c6c9879 | ActionsNode.test.tsx |

## Verification Results

- `npx vitest run ActionsNode.test.tsx` — **13/13 tests pass** (10 existing + 3 new)
- `npx tsc --noEmit` — **0 new errors** (12 pre-existing errors unrelated to this plan: missing react-konva, react-markdown, @pmndrs/detect-gpu module declarations)
- `grep -c "<ActionsReshootHeroSlot" ActionsNode.tsx` — **2** (AV + default branches)
- `grep -c "<ActionsOptimalPostSlot" ActionsNode.tsx` — **2** (AV + default branches)
- `grep -c "analysisId={analysisId}" ActionsNode.tsx` — **4** (2 reshoot + 2 optimal-post)
- `grep -q "script_result.*Json" database.types.ts` — **PASS**
- `grep -q "optimal_post_override.*Json" database.types.ts` — **PASS**

## Task 1: ActionsReshootHeroSlot — 5 Render States

Component now accepts `{ className?, style?, analysisId: string | null, phase: string, isAV: boolean }` and branches on:

1. **Pre-complete** (`phase !== 'complete'` OR `!analysisId`) → `PlaceholderCard` with `actions-reshoot-placeholder` testid
2. **Loading** (phase=complete but `useScript` fetching) → `PlaceholderCard` with `actions-reshoot-placeholder`
3. **Error** → `ScriptEmptyState variant="error"` with refetch callback
4. **Empty state** (`data.is_empty_state === true`) → `ScriptEmptyState variant="empty-state"` — wins over AV per D-22
5. **AV + non-empty** → AV chrome (`actions-reshoot-av-chrome` testid) + `ScriptBody`
6. **Default + non-empty** → `ScriptInspectorTrigger` (renders `actions-reshoot-teaser` testid)

Outer `actions-reshoot-hero-slot` wrapper and `className` contract preserved per O-1.

## Task 2: ActionsOptimalPostSlot — Outer Wrapper Fix

Adds the missing outer `<div data-testid="actions-optimal-post-slot">` wrapper (S-2 fix). Component accepts `{ analysisId, phase, window, override }`. Pre-complete: `PlaceholderCard` with `actions-optimal-post-placeholder`. Phase complete: outer wrapper + `OptimalPostCard`.

## Task 3: ActionsNode Wiring

- Extracts `analysisId = result?.id ?? null`
- Extracts `postWindow` and `postOverride` from result via safe `unknown` intermediate casts
- Both `<ActionsReshootHeroSlot>` invocations pass `analysisId`, `phase`, `isAV`
- Both `<ActionsOptimalPostSlot>` invocations pass `analysisId`, `phase`, `window`, `override`

### database.types.ts Hand-Patch

Added to `analysis_results` Row, Insert, and Update types:
- `script_result: Json | null` (Row) / `script_result?: Json | null` (Insert/Update)
- `optimal_post_override: Json | null` (Row) / `optimal_post_override?: Json | null` (Insert/Update)

**Important:** This hand-patch should be replaced via canonical regeneration post-merge:
```bash
supabase gen types typescript --linked > src/types/database.types.ts
```
Run this after the Phase 6 migrations (`20260530000000_script_result.sql` + `20260530000001_optimal_post_override.sql`) are applied to the linked project to confirm the hand-patch matches the live schema.

## Task 4: ActionsNode.test.tsx Updates

### Testid Migrations

| Before | After | Test |
|--------|-------|------|
| `actions-reshoot-placeholder` | `actions-reshoot-teaser` | Default complete state |
| `actions-optimal-post-placeholder` | `actions-optimal-post-card` | Default complete state |
| `actions-optimal-post-placeholder` | `actions-optimal-post-card` | AV bottom row state |

### New Mocks Added
- `@/components/board/actions/script/use-script` — returns non-empty ScriptResult stub
- `@/components/board/actions/optimal-post/use-optimal-post-override` — returns isPending=false stub
- `@/components/ui/sheet` — Radix portal stripped (needed for happy-dom)
- `@/hooks/useIsMobile` — returns false (desktop mode)
- `@/hooks/useCopyToClipboard` — returns `{ copied: false, copy: async () => true }`
- Extended `@phosphor-icons/react` with `Copy`, `CheckCircle`, `Info` icons

### New Phase 6 Tests (3 added)
1. **Pre-complete keeps placeholders** — verifies `actions-reshoot-placeholder` + `actions-optimal-post-placeholder` visible during streaming
2. **AV state renders AV chrome** — verifies "Try this instead" text + `actions-reshoot-body` testid
3. **Empty-state script renders ScriptEmptyState** — verifies "Your video is solid" text + `script-empty-state` testid

### QueryClientProvider — NOT needed
`OptimalPostCard` uses `useOptimalPostOverride` which is a mutation — mocked via `vi.mock`. No TanStack React Query context needed in test render.

### Sheet primitive — DID need mocking
Radix `Sheet` uses portals that don't render in happy-dom. Mock was required to prevent `ScriptInspectorTrigger` sheet content from disappearing in test environment.

## Streaming Continuity Confirmation

Pre-complete phase still renders Phase 5 placeholders:
- `actions-reshoot-placeholder` visible when `phase !== 'complete'`
- `actions-optimal-post-placeholder` visible when `phase !== 'complete'`
Verified by new pre-complete test + the fact that existing streaming tests still pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS2352 type cast error in ActionsNode**
- **Found during:** Task 3
- **Issue:** Direct cast from `PredictionResult | null` to `{ optimal_post_override: OptimalPostOverride }` failed — types don't overlap sufficiently
- **Fix:** Added `unknown` as intermediate: `(result as unknown as { optimal_post_override: OptimalPostOverride })`
- **Files modified:** `src/components/board/actions/ActionsNode.tsx`
- **Commit:** 531f38a

**2. [Rule 2 - Enhancement] Updated all AV-state tests to include id + optimal_post_window**
- **Found during:** Task 4 (test authoring)
- **Issue:** Existing AV tests used `fixtures.antiVirality` which lacked `id` and `optimal_post_window`. Without `id`, `analysisId` would be `null` and phase-gated cards would render placeholders instead of real content.
- **Fix:** Extended all AV mockStream overrides to include the new Phase 6 fields
- **Files modified:** `src/components/board/actions/__tests__/ActionsNode.test.tsx`
- **Commit:** c6c9879

## Known Stubs

None — all Phase 6 slots now render real components when `phase === 'complete'`. The `ActionsShareSlot` remains a Phase 5 placeholder (intentional — Phase 7 scope).

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced in this plan. All changes are pure UI wiring + TypeScript type additions. T-06-33 mitigation confirmed: `result.optimal_post_override` flows from the same RLS-filtered stream that loaded the analysis row.

## Self-Check: PASSED

All 5 modified files exist. All 4 task commits verified in git history (aec1643, 948532e, 531f38a, c6c9879). 13 tests green. 0 new TypeScript errors.
