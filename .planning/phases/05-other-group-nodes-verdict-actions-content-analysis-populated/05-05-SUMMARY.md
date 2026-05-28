---
phase: 05
plan: 05
subsystem: board/actions
tags: [phase-5, actions, placeholder-card, grow-to-hero, anti-virality-ripple]
requires: [05-01]
provides: [ActionsNode, PlaceholderCard, ActionsReshootHeroSlot, ActionsOptimalPostSlot, ActionsShareSlot]
affects: [Board.tsx, cross-group-state.ts]
tech-stack:
  added: []
  patterns:
    - vi.doMock + dynamic import for per-test store/hook isolation
    - vi.mock for ESM-only @phosphor-icons/react in happy-dom tests
key-files:
  created:
    - src/components/board/actions/actions-types.ts
    - src/components/board/actions/actions-constants.ts
    - src/components/board/actions/PlaceholderCard.tsx
    - src/components/board/actions/ActionsReshootHeroSlot.tsx
    - src/components/board/actions/ActionsOptimalPostSlot.tsx
    - src/components/board/actions/ActionsShareSlot.tsx
    - src/components/board/actions/ActionsNode.tsx
  modified:
    - src/components/board/actions/__tests__/PlaceholderCard.test.tsx
    - src/components/board/actions/__tests__/ActionsNode.test.tsx
key-decisions:
  - FilmScript icon used for reshoot slot (Film absent from @phosphor-icons/react v2.1.10; FilmScript is semantically correct for reshoot script)
  - logger.info() used for telemetry instead of logger.event?() — Logger interface has no event method; info with event name as message is consistent with existing logger pattern
  - vi.mock('@phosphor-icons/react') added to ActionsNode tests — ESM-only package returns undefined named exports after vi.resetModules() in happy-dom; static mock provides stub SVG components
requirements-completed: [R1.4, R1.9]
duration: 4 min
completed: 2026-05-28
---

# Phase 5 Plan 05: Actions Group Node Shell Summary

Actions node shell with 2x2 dashed-placeholder grid, PlaceholderCard primitive, 3 slot wrappers (Reshoot/Optimal/Share), and grow-to-hero AV behavior wired to `getFrameAntiViralityState('actions', boardState)` — B2 fix applied: AV bottom half renders Optimal + Similar + Share (3-col grid).

## Duration

- **Start:** 2026-05-28T06:13:52Z
- **End:** 2026-05-28T06:18:16Z
- **Duration:** 4 min
- **Tasks completed:** 3/3
- **Files created:** 7 new, 2 modified

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | actions-types.ts + actions-constants.ts | fb8e7e7 |
| 2 | PlaceholderCard.tsx + 9 tests | 1866474 |
| 3 | Slot wrappers + ActionsNode + 10 tests | 369eb6a |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `Film` icon absent from @phosphor-icons/react v2.1.10**
- **Found during:** Task 3
- **Issue:** Plan specifies `import { Film } from '@phosphor-icons/react'` but phosphor v2.1.10 has no `Film` export. Available variants are `FilmReel`, `FilmScript`, `FilmSlate`, `FilmStrip`. TypeScript error surfaced on `npx tsc --noEmit`.
- **Fix:** Used `FilmScript` — semantically most accurate for "Reshoot script" context (it represents a film script/screenplay icon). Updated both `ActionsReshootHeroSlot.tsx` and the test mock.
- **Files modified:** `ActionsReshootHeroSlot.tsx`, `__tests__/ActionsNode.test.tsx`
- **Commit:** 369eb6a

**2. [Rule 3 - Blocker] `logger.event` not on Logger interface**
- **Found during:** Task 3
- **Issue:** Plan uses `logger.event?.()` but `Logger` interface in `src/lib/logger.ts` has only `debug`, `info`, `warn`, `error`, `child`. Optional chaining would silently no-op forever.
- **Fix:** Used `logger.info(TELEMETRY.ACTIONS_RESHOOT_PLACEHOLDER_VISIBLE, {})` — fires telemetry via the existing structured logger with event name as message.
- **Files modified:** `ActionsNode.tsx`
- **Commit:** 369eb6a

**3. [Rule 3 - Blocker] `@phosphor-icons/react` ESM exports undefined in happy-dom after vi.resetModules()**
- **Found during:** Task 3 (test run)
- **Issue:** `node -e "require('@phosphor-icons/react')"` confirms all named exports are `undefined` in CJS context. `vi.resetModules()` + `vi.doMock` pattern causes subsequent dynamic imports to see `undefined` icons, crashing React rendering.
- **Fix:** Added `vi.mock('@phosphor-icons/react', () => ({ FilmScript: ..., Clock: ..., ShareNetwork: ... }))` at top of `ActionsNode.test.tsx`. Mock runs before module resolution, providing stable SVG stubs.
- **Files modified:** `__tests__/ActionsNode.test.tsx`
- **Commit:** 369eb6a

**Total deviations:** 3 auto-fixed (1 wrong icon name → Rule 3, 1 logger API mismatch → Rule 3, 1 ESM test isolation → Rule 3). **Impact:** No behavioral change from plan spec — icons render correctly, telemetry fires correctly, all 19 tests pass.

## Test Results

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| PlaceholderCard.test.tsx | 9 | 9 | 0 |
| ActionsNode.test.tsx | 10 | 10 | 0 |
| **Total** | **19** | **19** | **0** |

## Verification Results

- PlaceholderCard 9-test suite: PASS
- ActionsNode 10-test suite (incl. B2 Share-in-AV): PASS
- Default state: `data-av=false`, 2x2 grid with all 4 slot placeholders rendered
- AV state: `data-av=true`, ReshootHero `col-span-2` top + `actions-av-bottom-row` (Optimal+Similar+Share) bottom
- 3 placeholder phase labels match UI-SPEC: Reshoot=6, OptimalPost=6, Share=7
- Both similar-videos slots present with distinct testids (`actions-similar-videos-slot` + `actions-similar-videos-slot-av`)
- `npx tsc --noEmit` clean for all new actions files

## Output Notes (per plan <output> spec)

- **Exact icons imported:** `FilmScript` (not `Film` — absent in phosphor v2.1.10), `Clock`, `ShareNetwork`
- **AV grid composition:** `grid-template-rows: '160px 1fr'` — ReshootHero `col-span-2` over `col-span-2` bottom container with `grid-cols-3`
- **Dynamic vi.doMock pattern:** Kept as specified in plan. Added static `vi.mock('@phosphor-icons/react')` at file top to prevent ESM undefined issue
- **B2 criterion confirmed:** `grep -c "ActionsShareSlot" src/components/board/actions/ActionsNode.tsx` = 3 (import + default branch + AV branch) ≥ 2 ✓
- **Phase 6 swap path:** `ActionsReshootHeroSlot` wrapper `<div>` holds the placeholder; Phase 6 replaces `PlaceholderCard` inside with real reshoot UI, no grid layout changes needed

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `actions-similar-videos-slot` | ActionsNode.tsx:L64 | Empty div placeholder for Plan 5.6 SimilarVideosCard (intentional — Plan 5.6 wires real card here) |
| `actions-similar-videos-slot-av` | ActionsNode.tsx:L59 | Same as above, AV variant |

These are intentional stubs per plan spec. Plan 5.6 fills both slots.

## Next Plan

Ready for 05-06 (SimilarVideosCard — wires into both slot divs above).

## Self-Check: PASSED

- `src/components/board/actions/actions-types.ts` — FOUND
- `src/components/board/actions/actions-constants.ts` — FOUND
- `src/components/board/actions/PlaceholderCard.tsx` — FOUND
- `src/components/board/actions/ActionsReshootHeroSlot.tsx` — FOUND
- `src/components/board/actions/ActionsOptimalPostSlot.tsx` — FOUND
- `src/components/board/actions/ActionsShareSlot.tsx` — FOUND
- `src/components/board/actions/ActionsNode.tsx` — FOUND
- Commit `fb8e7e7` (Task 1) — FOUND in git log
- Commit `1866474` (Task 2) — FOUND in git log
- Commit `369eb6a` (Task 3) — FOUND in git log
