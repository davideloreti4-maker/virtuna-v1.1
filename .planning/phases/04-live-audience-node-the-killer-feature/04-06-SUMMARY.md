---
phase: "04-live-audience-node-the-killer-feature"
plan: "06"
subsystem: "audience-canvas"
tags: ["canvas", "animation", "retention-curve", "raf", "catmull-rom", "tdd"]
dependency_graph:
  requires: ["04-02"]
  provides: ["RetentionCurve", "DropoffMarkers", "useRetentionCurveCanvas"]
  affects: ["04-08-AudienceNode"]
tech_stack:
  added: []
  patterns:
    - "Catmull-Rom α=0.5 hand-rolled bezier (drawCatmullRomCurve, ≤25 LOC)"
    - "Single shared RAF loop (morph + marker fade)"
    - "DPR-aware canvas with ResizeObserver (verbatim hive-demo-canvas.tsx pattern)"
    - "Pure-function geometry module (no React, no hooks)"
    - "Reduced-motion: synchronous single draw, zero RAF scheduled"
key_files:
  created:
    - "src/components/board/audience/DropoffMarkers.ts"
    - "src/components/board/audience/use-retention-curve-canvas.ts"
    - "src/components/board/audience/RetentionCurve.tsx"
  modified:
    - "src/components/board/audience/__tests__/DropoffMarkers.test.ts"
    - "src/components/board/audience/__tests__/RetentionCurve.test.tsx"
    - "src/components/board/audience/__tests__/RetentionCurve.reduced-motion.test.tsx"
decisions:
  - "Catmull-Rom α=0.5 hand-rolled in drawCatmullRomCurve (≤25 LOC) — no d3-shape dependency per RESEARCH §4.4"
  - "reducedMotion path calls drawFrame(0,1) synchronously then returns — RAF never scheduled (T-04-12 compliance)"
  - "Morph loop lives in a dedicated useEffect watching morphRequested — keeps initial-draw effect clean"
  - "closePath added to canvas mock (missing from test stub) — Rule 1 auto-fix"
metrics:
  duration: "8m"
  completed: "2026-05-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
  tests_added: 17
---

# Phase 04 Plan 06: Retention Curve Canvas Summary

Hand-rolled Catmull-Rom α=0.5 bezier canvas with DPR-aware RAF morph loop and pure-function marker geometry — 17 tests green, zero d3-shape dependency.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | DropoffMarkers pure-fn module + 10 tests | e0c82f3 | DropoffMarkers.ts, DropoffMarkers.test.ts |
| 2 | use-retention-curve-canvas + RetentionCurve + 7 tests | 2af49ea | use-retention-curve-canvas.ts, RetentionCurve.tsx, RetentionCurve.test.tsx, RetentionCurve.reduced-motion.test.tsx |

## Artifacts

### DropoffMarkers.ts
Pure-function geometry module. No React, no hooks. Exports:
- `computeMarkerPositions` — places markers at `x = (t/totalDuration)*w`, `y = h*(1-attention)`. Skips null swipe_predicted_at. Coerces NaN to 0.
- `clusterMarkers` — D-12 single-pass sweep sorted by x: ≥3 within 12px or ≥2 within 6px → cluster. Returns centroid + count.
- `findMarkerAtPoint` — cluster-first linear scan, hitRadius=22px.
- `drawMarkers` — dot (MARKER_DOT_RADIUS=4px, fill #FF7F50) + ring (slotType color from MARKER_RING_COLOR) + cluster superscript. Opacity = `reducedMotion ? 1 : clamp(easeOutCubic(progress * 1.2), 0, 1)`.
- `easeOutCubic` — exported for reuse in canvas hook.

### use-retention-curve-canvas.ts
DPR-aware RAF hook. Key decisions:
- `drawCatmullRomCurve`: Catmull-Rom α=0.5, piecewise bezierCurveTo. Guard: <2 pts → moveTo only; NaN → 0 (T-04-13).
- Single shared RAF loop for morph (800ms easeOutCubic) + marker fade-in in same frame.
- `reducedMotion=true`: `drawFrame(0, 1)` called synchronously; `return` before any RAF call. `requestAnimationFrame` is NEVER scheduled.
- `morphRequested` watched in dedicated effect; cancels prev RAF before scheduling new morph loop.
- ResizeObserver re-draws on resize when not morphing.
- `onTap`: cluster-first hit-test → marker payload; else → curve-point payload with `weightedAttention`.

### RetentionCurve.tsx
Canvas wrapper component. `'use client'`. Props: `weightedCurve`, `baselineCurve`, `heatmap`, `totalDurationSec`, `morphRequested`, `antiViralityXRange`, `onTap`, `weightedCompletionPct`. Uses `usePrefersReducedMotion` and `usePerfStore(tier)` — `reducedMotion = prefersReduced || tier === 'low'`. Wires `pointerdown` to `onTap` callback from hook.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ctx.closePath missing from test canvas mock**
- Found during: Task 2 GREEN phase (first test run)
- Issue: mockCtx lacked `closePath`, threw `TypeError: ctx.closePath is not a function`
- Fix: Added `closePath: vi.fn()` to both RetentionCurve test mocks
- Files: RetentionCurve.test.tsx, RetentionCurve.reduced-motion.test.tsx
- Commit: 2af49ea

**2. [Rule 1 - Bug] Dead draw function in initial-draw effect**
- Found during: TS check
- Issue: Non-reduced-motion path in init effect declared `function draw(...)` that was never called (morph loop handled separately). TS reported unused variable.
- Fix: Removed dead code, left only `drawFrame(0, 1)` for initial draw
- Files: use-retention-curve-canvas.ts
- Commit: 2af49ea

**3. [Rule 1 - Bug] TS possibly-undefined in test assertions**
- Found during: TS check on DropoffMarkers.test.ts
- Issue: `result[0]` accessed without null assertion — TS18048
- Fix: Added `!` non-null assertion at access sites
- Files: DropoffMarkers.test.ts
- Commit: 2af49ea

## Known Stubs

None — all functions fully implemented with real logic.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-04-12 mitigated | use-retention-curve-canvas.ts | useEffect cleanup cancels RAF; reducedMotion never schedules |
| T-04-13 mitigated | DropoffMarkers.ts, use-retention-curve-canvas.ts | NaN coercion + <2 point guard in Catmull-Rom |

No new unplanned threat surface introduced.

## Self-Check: PASSED

All 4 created/modified source files found on disk.
Both task commits (e0c82f3, 2af49ea) confirmed in git log.
17 tests pass, 0 fail across DropoffMarkers + RetentionCurve + RetentionCurve.reduced-motion.
