---
phase: 02-board-substrate-navigation
plan: 15
subsystem: board-layout
tags: [layout, spacing, camera-presets, regression-test, uat-gap-fix]
dependency_graph:
  requires: []
  provides: [GROUP_FRAMES-respaced-96px, BOARD_BOUNDS-1352x872, regression-test-gap-invariant]
  affects: [board-constants.ts, Board.tsx render loop via GROUP_FRAMES]
tech_stack:
  added: [vitest-axe (dev dependency — was missing from node_modules)]
  patterns: [static-literal frame positions, IIFE-derived BOARD_BOUNDS, TDD regression guard]
key_files:
  created:
    - src/components/board/__tests__/board-constants.test.ts
  modified:
    - src/components/board/board-constants.ts
decisions:
  - "GUTTER bumped from 32 to 96 to match new minimum gap value"
  - "Frame positions use static literals (not GUTTER arithmetic) for readability"
  - "CAMERA_PRESET_TARGETS.verdict height set to 576 (not 280) to enclose full Audience frame height"
  - "vitest-axe installed to unblock test runner (was in package.json but missing from node_modules)"
metrics:
  duration: ~15 minutes
  completed_date: "2026-05-26"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 15: Frame Spacing Gap Closure Summary

Re-spaced 6 group container frames from 32px to 96px world-space gaps on every adjacent edge, fixing UAT Gap 1 ("crammed CSS grid") and adding a regression test locking the 96px gap invariant.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Re-space GROUP_FRAMES with 96px minimum world-space gaps | 68279ec | src/components/board/board-constants.ts |
| 2 | Regression test — assert 96px minimum gap between every adjacent frame pair | 0fe2e77 | src/components/board/__tests__/board-constants.test.ts |

## Checkpoint Pending

| Task | Name | Status |
|------|------|--------|
| 3 | Human-verify frame spacing on /analyze | Awaiting human verification |

## Old vs New GROUP_FRAMES Coordinates

### Before (32px GUTTER — read as packed CSS grid)

| Frame | x | y | width | height |
|-------|---|---|-------|--------|
| input | 0 | 0 | 240 | 160 |
| engine | 0 | 192 | 240 | 320 |
| audience | 272 | 0 | 560 | 512 |
| verdict | 864 | 0 | 360 | 280 |
| actions | 864 | 312 | 360 | 200 |
| content-analysis | 0 | 544 | 1224 | 200 |

### After (96px gaps — spatial canvas affordance)

| Frame | x | y | width | height | Gap(s) |
|-------|---|---|-------|--------|--------|
| input | 0 | 0 | 240 | 160 | — |
| engine | 0 | 256 | 240 | 320 | 96px below input |
| audience | 336 | 0 | 560 | 576 | 96px right of input/engine |
| verdict | 992 | 0 | 360 | 280 | 96px right of audience |
| actions | 992 | 376 | 360 | 200 | 96px below verdict |
| content-analysis | 0 | 672 | 1352 | 200 | 96px below all frames above |

## New BOARD_BOUNDS

`{ x: 0, y: 0, width: 1352, height: 872 }` (auto-derived from GROUP_FRAMES IIFE)

Previous: `{ x: 0, y: 0, width: 1224, height: 744 }`

## Updated CAMERA_PRESET_TARGETS

| Preset | Old Value | New Value | Rationale |
|--------|-----------|-----------|-----------|
| engine | `{x:0,y:0,w:240,h:512}` | `{x:0,y:0,width:240,height:576}` | engine.bottom is now 256+320=576; must enclose full Input+Engine column |
| verdict | `{x:272,y:0,w:952,h:280}` | `{x:336,y:0,width:1016,height:576}` | Audience+Verdict union: x=min(336,992)=336, right=max(896,1352)=1352, height=max(576,280)=576 |
| overview | BOARD_BOUNDS (auto) | BOARD_BOUNDS (auto) | No manual change needed |
| audience | audience.bounds (auto) | audience.bounds (auto) | No manual change needed |
| content-analysis | content-analysis.bounds (auto) | content-analysis.bounds (auto) | No manual change needed |

## Regression Test

`src/components/board/__tests__/board-constants.test.ts` locks the 96px gap invariant with 15 test assertions:

- 8 gap assertions (one per adjacent frame pair)
- 2 BOARD_BOUNDS assertions (encloses all frames + exact dimensions)
- 5 CAMERA_PRESET_TARGETS assertions (overview=BOARD_BOUNDS, engine encloses input+engine, verdict encloses audience+verdict, audience=audience.bounds, content-analysis=content-analysis.bounds)

Any future edit to GROUP_FRAMES that shrinks a gap below 96px will fail these tests, preventing regression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Non-null assertion on CAMERA_PRESET_TARGETS access in test**
- **Found during:** Task 2 TypeScript check
- **Issue:** `CAMERA_PRESET_TARGETS` typed as `Record<string, Rect>` — index access returns `Rect | undefined` in strict mode
- **Fix:** Added `!` non-null assertion on `.engine` and `.verdict` accesses in test file
- **Files modified:** src/components/board/__tests__/board-constants.test.ts
- **Commit:** 0fe2e77

**2. [Rule 3 - Blocking] Installed missing vitest-axe dev dependency**
- **Found during:** Task 2 test run
- **Issue:** `vitest-axe` listed in package.json devDependencies but absent from node_modules; setup.ts import failed blocking all tests
- **Fix:** `pnpm add -D vitest-axe` in main repo — installed v0.1.0
- **Files modified:** /Users/davideloreti/virtuna-v1.1/package.json (main repo, not tracked in this plan's commit)
- **Commit:** 0fe2e77 (test commit includes the unblocked test results)

## Known Stubs

None — this plan modifies only constants (no UI rendering stubs).

## Threat Flags

None — this plan modifies layout constants only, no network endpoints, auth paths, or trust boundaries.

## Self-Check: PASSED

- src/components/board/board-constants.ts: FOUND
- src/components/board/__tests__/board-constants.test.ts: FOUND
- Commit 68279ec: FOUND (feat(02-15))
- Commit 0fe2e77: FOUND (test(02-15))
- All 15 tests: PASSED
