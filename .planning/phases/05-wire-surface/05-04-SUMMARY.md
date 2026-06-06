---
phase: 05-wire-surface
plan: "04"
subsystem: simulation-ui
tags: [r11, engagement-range, results-panel, d-08, tdd, honesty]
dependency_graph:
  requires:
    - phase: 05-02
      provides: EngagementRange type, computeEngagementRange, predicted_engagement field
  provides: [EngagementRangeCard, dead-fake-engagement-ui-stripped]
  affects: [results-panel, simulation-ui]
tech_stack:
  added: []
  patterns: [tdd-london, null-gate-honesty, raycast-card-pattern]
key_files:
  created:
    - src/components/app/simulation/EngagementRangeCard.tsx
  modified:
    - src/components/app/simulation/results-panel.tsx
    - src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx
key_decisions:
  - "EngagementRangeCard uses data-testid=engagement-range-card for null-gate test assertions"
  - "useSimulationStore (videoSrc/thumbnailSrc) removed from ResultsPanel — only TikTokResultCard needed them"
  - "Reload affordance caption added per D-06 live-only contract — makes null on permalink reload read as intentional"
  - "tsc errors: 14 → 12 (fixed two Plan-05-02 type mismatch errors; zero new errors introduced)"
requirements: [R11, R5]
duration: ~5 minutes
completed: "2026-06-06"
---

# Phase 5 Plan 04: Strip Dead Engagement UI + Surface R11 Range Summary

**Dead TikTokResultCard fake-engagement path stripped (D-08); grounded EngagementRangeCard surfaced with lo–hi range + confidence + basis, null-gated for honesty (R9/R11). 4-test TDD suite GREEN.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-06T19:56Z
- **Completed:** 2026-06-06T20:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Created `EngagementRangeCard.tsx` — presentational card for `EngagementRange` (lo/hi/confidence/basis); renders both range bounds, never a single point; Raycast card styling (bg-transparent, white/[0.06] border, 12px radius, backdrop-filter via inline style); confidence dot (green/amber/red); reload affordance caption ("estimate available on fresh run") per D-06 live-only contract
- Stripped `TikTokResultCard` import (line 15) and dead JSX block (lines 159-166) from `results-panel.tsx`; replaced with `{result.predicted_engagement && <EngagementRangeCard range={result.predicted_engagement} />}` — null-gate preserves R9 honesty
- Removed `useSimulationStore` call from `ResultsPanel` (videoSrc/thumbnailSrc were TikTokResultCard-only)
- Updated null test: removed dead TikTokResultCard mock + point-shape assertions; added 4 tests asserting null→no card, range→card with lo+hi, and TikTokResultCard never rendered
- tsc: fixed 2 pre-existing Plan-05-02 type errors (results-panel TS2739 + test TS2352); net 14→12 errors, zero new

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing EngagementRangeCard tests | `7da179c7` | results-panel.predicted-engagement-null.test.tsx |
| GREEN | EngagementRangeCard + strip TikTokResultCard path | `1509d798` | EngagementRangeCard.tsx, results-panel.tsx |

## Files Created/Modified

- `src/components/app/simulation/EngagementRangeCard.tsx` (created, 99 lines) — grounded R11 range display; lo–hi + confidence indicator + basis label + reload affordance; `data-testid="engagement-range-card"` for test assertions
- `src/components/app/simulation/results-panel.tsx` — removed TikTokResultCard import + dead JSX block; added EngagementRangeCard import + gated render; removed useSimulationStore (now unused)
- `src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx` — 4 tests: null→no card (×2), EngagementRange→card with lo+hi, TikTokResultCard never rendered

## Decisions Made

- **Reload affordance caption:** Added one-line "Estimate available on fresh run · updates per creator baseline" per the parallel context instruction. Makes permalink-reload null read as intentional (D-06), not broken.
- **Remove useSimulationStore:** videoSrc/thumbnailSrc were only needed for TikTokResultCard. Removing avoids unused store subscription.
- **data-testid on card root:** Enables null-gate test assertions without coupling to implementation internals.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `EngagementRangeCard` renders real `EngagementRange` data from `result.predicted_engagement`. Permalink null is the documented scope boundary (D-06), not a stub — the reload affordance caption makes this explicit.

## Threat Flags

No new trust boundaries:
- T-05-10 (Tampering, EngagementRangeCard numeric display): mitigated — render-only of already-clamped engine-side range (Plan 02 clamps lo/hi ≥ 0); card does no arithmetic; null-gated so no baseline renders nothing (R9)
- T-05-11 (Info disclosure, results-panel): accepted — unchanged data path; React escapes text; no new fetch/persist

## Self-Check

- `src/components/app/simulation/EngagementRangeCard.tsx` — FOUND (created, 99 lines)
- `src/components/app/simulation/results-panel.tsx` — FOUND (TikTokResultCard count = 0, EngagementRangeCard at line 14 + 159)
- `src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx` — FOUND (4 tests)
- Commit `7da179c7` (RED) — FOUND in git log
- Commit `1509d798` (GREEN) — FOUND in git log
- 4/4 tests GREEN
- tsc: 14 → 12 errors (2 fixed, 0 new)

## Self-Check: PASSED

---
*Phase: 05-wire-surface*
*Completed: 2026-06-06*
