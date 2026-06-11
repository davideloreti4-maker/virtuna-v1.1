---
phase: 05-wire-surface
plan: "03"
subsystem: board-ui
tags: [board, insight-hero, dual-read, apollo, D-08, D-07, D-03, D-02, tdd]
dependency_graph:
  requires: [05-01]
  provides: [insight-hero-frame, insight_hero-panel-id, apollo-surface]
  affects: [Board.tsx, panel-mapping, board-constants, board-types, result-card]
tech_stack:
  added: []
  patterns: [dual-read-live-vs-permalink, tdd-london, progressive-reveal, band-score-reuse]
key_files:
  created:
    - src/components/board/InsightHeroFrame.tsx
    - src/components/board/__tests__/InsightHeroFrame.test.tsx
  modified:
    - src/lib/engine/panel-mapping.ts
    - src/components/board/board-types.ts
    - src/components/board/board-constants.ts
    - src/components/board/Board.tsx
    - src/app/(app)/analyze/[id]/result-card.tsx
    - src/components/board/__tests__/board-constants.test.ts
    - src/components/board/__tests__/GroupFrame.test.tsx
decisions:
  - "InsightHeroFrame uses static import in tests (not vi.resetModules + require) — ESM vitest requires static import for mocks to work"
  - "insight-hero placed below content-analysis (y:1104, h:480) in left+center column (x:0, w:832) — mirrors content-analysis span"
  - "result-card.tsx PANEL_LABEL extended with insight_hero to satisfy Record<PanelId,string> exhaustiveness (Rule 2 tsc fix)"
  - "board-constants test: hardcoded 1072 height updated to '>1072' assertion; GroupFrame test 6→7 frames"
metrics:
  duration: "~35 minutes"
  completed: "2026-06-06"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 9
---

# Phase 5 Plan 03: InsightHeroFrame — D-08 Insight Hero Surface Summary

InsightHeroFrame surfacing apollo_reasoning as the board hero: dual-read (live SSE + permalink variants.apollo), 3 verbatim-grounded struck-through+copyable rewrites, 6 scored dimensions, D-07 retention drop-point label, demoted D-02 score band, flop warning, progressive-reveal panel registration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests for InsightHeroFrame (TDD gate) | `780aecb0` | InsightHeroFrame.test.tsx |
| 1 | InsightHeroFrame component + GREEN tests | `adb46614` | InsightHeroFrame.tsx, InsightHeroFrame.test.tsx |
| 2 | insight_hero panel registration + board mount | `89d1bbd6` | panel-mapping.ts, board-types.ts, board-constants.ts, Board.tsx, result-card.tsx, test updates |

## What Was Built

### InsightHeroFrame.tsx (net-new, 245 lines)

D-08 insight-hero frame. Surfaces the full surface set from apollo_reasoning:

**DUAL-READ (Pitfall 2 / WPk976kozfWs guard):**
```typescript
const apollo = useMemo(() => {
  const v = row?.variants?.apollo;
  return v ?? row?.apollo_reasoning ?? null;
}, [row?.variants?.apollo, row?.apollo_reasoning]);
```
Reads `variants.apollo` (permalink DB row) first, falls back to top-level `apollo_reasoning` (live SSE). Prevents permalink blank.

**D-08 render order:**
1. Hero read: `confidence_scope` + `ceiling_capper` + optional `platform_note`
2. 3 rewrites: `<del>` struck-through original + Copy button (`navigator.clipboard.writeText`) + variant text
3. 6 dimensions: name + band (Strong/Mid/Weak with color) + numeric score (defensive: `typeof dim.score === 'number'` — legacy rows render band-only, no crash)
4. D-02 score band: `confidenceRange` + `bandLabel` + `bandTone` from `verdict-derive` (no reimplementation) — demoted below insight
5. Flop warning: `anti_virality_gated` → orange warning banner

**D-07 drop-point label:**
`findBiggestDrop(heatmap.weighted_curve)` → `formatTime(segment.t_start)` from `audience-derive`. The rewrite whose `lever_fixed` contains "retention" or "§2.2" is labelled with the mm:ss. Null heatmap → no label, no crash.

**Progressive reveal:**
Reads `panelReady["insight_hero"]` from `useAnalysisStream`. Light loading skeleton when "loading"; renders content when "ready" or when apollo data is already present.

### panel-mapping.ts

Added `"insight_hero"` to `PANEL_IDS` and to `STAGE_TO_PANEL.wave_2 = ["reasoning", "insight_hero"]`. The Apollo stage (~70s) paints both the reasoning panel and the hero simultaneously. `panelReadyFromStages` already handles this — no reducer change.

### board-types.ts

Added `'insight-hero'` to the `GroupId` union.

### board-constants.ts

- Added `insight-hero` to `GROUP_FRAMES`: `{ x:0, y:1104, w:832, h:480 }` — below content-analysis (y:832+240=1072) + 32px gutter, left+center span mirrors content-analysis
- Added `'insight-hero'` to `AUTO_HEIGHT_FRAMES` — sizes to rich content
- Updated `resolveBoardLayout` to include the `insight-hero` frame below content-analysis

### Board.tsx

Import + conditional render:
```typescript
import { InsightHeroFrame } from './InsightHeroFrame';
// ...
{layout.id === 'insight-hero' && <InsightHeroFrame camera={camera} layout={layout} />}
```

## Test Results

- TDD RED: 8 failing tests committed at `780aecb0`
- TDD GREEN: all 8 InsightHeroFrame tests pass after component creation
- Board layout tests: 142/142 passed (17 test files) including the 2 board-constants tests updated for new board dimensions
- tsc --noEmit: zero new errors in changed files (pre-existing fold-adapter.test.ts errors unrelated to this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] board-constants.test.ts hardcoded BOARD_BOUNDS height (1072)**
- **Found during:** Task 2 board test run
- **Issue:** Test asserted `BOARD_BOUNDS = {height: 1072}` — no longer true after insight-hero adds height 480 below (new bottom: 1584)
- **Fix:** Updated assertion to `height > 1072` and updated "board bounds grow" test to grow `insight-hero` (the actual bottommost frame)
- **Files modified:** `src/components/board/__tests__/board-constants.test.ts`
- **Commit:** `89d1bbd6`

**2. [Rule 1 - Bug] GroupFrame.test.tsx hardcoded frame count (6)**
- **Found during:** Task 2 board test run
- **Issue:** Test asserted `regions.length === 6` — new frame makes it 7
- **Fix:** Updated assertion to `toBe(7)` with updated comment
- **Files modified:** `src/components/board/__tests__/GroupFrame.test.tsx`
- **Commit:** `89d1bbd6`

**3. [Rule 2 - Missing critical] result-card.tsx PANEL_LABEL missing insight_hero key**
- **Found during:** Task 2 tsc check
- **Issue:** `PANEL_LABEL: Record<PanelId, string>` is exhaustive — adding `insight_hero` to PanelId required adding it to the record
- **Fix:** Added `insight_hero: "Apollo insight"` to PANEL_LABEL
- **Files modified:** `src/app/(app)/analyze/[id]/result-card.tsx`
- **Commit:** `89d1bbd6`

**4. [Rule 1 - Bug] Tests used vi.resetModules() + dynamic require() with ESM**
- **Found during:** Task 1 GREEN run (all 8 tests failing with "Cannot find module")
- **Issue:** Vitest ESM environment requires static imports — dynamic `require()` after `vi.resetModules()` doesn't resolve ES modules
- **Fix:** Converted test helpers to use static import + mutating closed-over variables (standard Vitest pattern)
- **Files modified:** `src/components/board/__tests__/InsightHeroFrame.test.tsx`
- **Commit:** `adb46614`

## Known Stubs

None. The frame surfaces real engine data from `variants.apollo` / `apollo_reasoning`. No hardcoded/placeholder data.

## Threat Flags

No new trust boundaries beyond what the plan's threat model declared:
- T-05-07: dual-read defensive (variants.apollo ?? apollo_reasoning ?? null) — mitigated per plan
- T-05-08: React JSX text escaping prevents XSS on rewrite/dimension text — no dangerouslySetInnerHTML
- T-05-09: `typeof dim.score === 'number'` defensive display — score not used for logic, only display

## Self-Check: PASSED
