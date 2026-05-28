---
phase: 02-board-substrate-navigation
plan: 9
subsystem: board-camera-animation
tags: [accessibility, reduced-motion, camera, animation, a11y, D-23]

# Dependency graph
requires:
  - phase: 02-board-substrate-navigation (Plan 01)
    provides: use-camera.ts with goToPreset
  - phase: 02-board-substrate-navigation (Plan 04)
    provides: board-store with reducedMotion flag wired
dependency_graph:
  provides:
    - src/components/board/use-camera.ts (easeOutQuart, easeCameraTowards, animated goToPreset)
    - src/components/board/__tests__/use-camera.reduced-motion.test.ts
  affects:
    - src/components/board/Board.tsx (auto-pan contract JSDoc)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RAF-driven cubic-out camera glide (300ms duration, cancellable)"
    - "D-23 reducedMotion gate: instant setCamera() call, no RAF loop"
    - "easeCameraTowards pure interpolation helper with easeOutQuart"
    - "Shimmer gated at render level (showShimmer = streaming && !reducedMotion)"
    - "Auto-pan contract documented for downstream plans (2.13 Engine, future Audience)"

key-files:
  created:
    - "src/components/board/__tests__/use-camera.reduced-motion.test.ts (9 tests)"
  modified:
    - "src/components/board/use-camera.ts (easeOutQuart + easeCameraTowards + animated goToPreset)"
    - "src/components/board/Board.tsx (auto-pan contract JSDoc)"

key-decisions:
  - "D-23 option (a): composition and navigation remain fully functional under reduced-motion — only animations are suppressed. Pan, zoom, presets all work. Only easing is removed."
  - "cancelGlide() called on each goToPreset to prevent overlapping RAF loops (user pressing two presets rapidly)."
  - "Skeleton already has motion-reduce:animate-none CSS layer as fallback; showShimmer guard is primary gate (render-level suppression before CSS)."
  - "Auto-pan contract placed as JSDoc in Board.tsx — serves as canonical reference for 2.13 Engine plan to avoid accidental auto-pan under reduced motion or within user-interaction cooldown."

# Metrics
duration: ~8min
completed: 2026-05-26T08:44:00Z
tasks_completed: 2
files_created: 1
files_modified: 2
---

# Phase 02 Plan 09: D-23 Reduced-Motion Fallback Summary

**Camera glide replaced with instant snap when `prefers-reduced-motion: reduce`; frame shimmer gated at render level; auto-pan contract documented for downstream plans (2.13 Engine).**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-05-26T08:44:00Z
- **Tasks:** 2 of 2
- **Files created:** 1
- **Files modified:** 2

## Accomplishments

### Task 1: Camera easing helpers + animated goToPreset

Added two exported pure helpers to `src/components/board/use-camera.ts`:

**`easeOutQuart(t: number): number`**
- Cubic-out interpolation clamped to [0, 1]
- Formula: `1 - (1 - clamp(t))^4`

**`easeCameraTowards(from: Camera, to: Camera, t: number): Camera`**
- Interpolates x, y, scale using easeOutQuart
- Pure function, no side effects

**Animated `goToPreset`:**
- `reducedMotion: true` → single synchronous `setCamera(final)` call, no RAF (D-23 instant snap)
- `reducedMotion: false` → RAF loop over 300ms with cubic-out easing
- `cancelGlide()` cancels any in-flight RAF before starting a new one (prevents animation overlap)

### Animation Gates List (Reduced-Motion-Aware)

| Animation | Normal | Reduced Motion |
|-----------|--------|----------------|
| Camera preset glide | 300ms cubic-out RAF | Instant `setCamera()` |
| Frame streaming shimmer | Skeleton with shimmer | Skeleton hidden (showShimmer=false) |
| Auto-pan on stage events | Enabled (plan 2.13) | Suppressed via contract |
| Engine stage glyph swap | Instant (no existing easing) | Unchanged |

### Task 2: Shimmer gate + auto-pan contract

**Shimmer gate (GroupFrameOverlay.tsx):**
- `showShimmer = visual === 'streaming' && !reducedMotion` — already present from plan 2.2
- Verified: no `animate-pulse` or `animate-shimmer` class on Skeleton
- Skeleton has `motion-reduce:animate-none` as CSS-layer fallback (both layers active)

**Auto-pan contract (Board.tsx JSDoc):**
```ts
/**
 * Auto-pan contract for downstream plans (2.13 Engine, future Audience):
 * - If `usePrefersReducedMotion()` is true → DO NOT call `goToPreset`.
 * - If `Date.now() - useBoardStore.getState().lastUserInteractionAt < 3000` → DO NOT call `goToPreset`.
 * - Throttle: at most one glide per wave boundary (Wave 0→1, 1→2, 2→3, complete).
 * RESEARCH Pitfall 3 + Open Question 2.
 */
```

This is the canonical reference for plan 2.13 Engine group implementation.

## Task Commits

| # | Phase | Commit | Description |
|---|-------|--------|-------------|
| RED | TDD | `469b20b` | test(02-09): add failing reduced-motion tests |
| GREEN | Task 1 | `8a45ee0` | feat(02-09): implement easeOutQuart + easeCameraTowards + animated goToPreset |
| - | Task 2 | `478add4` | feat(02-09): gate auto-pan + document D-23 auto-pan contract |

## Tests

20 Vitest tests passing across both camera test files:

| Suite | File | Tests |
|-------|------|-------|
| computeFitCamera | use-camera.test.ts | 2 |
| computeZoomAtPointer | use-camera.test.ts | 2 |
| parseCameraSearchParams | use-camera.test.ts | 5 |
| serializeCamera | use-camera.test.ts | 2 |
| easeOutQuart | use-camera.reduced-motion.test.ts | 4 |
| easeCameraTowards | use-camera.reduced-motion.test.ts | 3 |
| useCamera + reducedMotion | use-camera.reduced-motion.test.ts | 2 |

## Deviations from Plan

None — plan executed exactly as written. GroupFrameOverlay shimmer guard was already present from plan 2.2 as expected.

## Known Stubs

None. All animation gates are wired. Auto-pan contract is a documentation stub for plan 2.13 — intentional; plan 2.13 will implement the auto-pan call site.

## Threat Surface Scan

No new security-relevant surface. All changes are client-side animation logic and documentation. No network endpoints, auth paths, or user data.

## Self-Check: PASSED

**Files exist:**
- `src/components/board/use-camera.ts` — FOUND (modified)
- `src/components/board/__tests__/use-camera.reduced-motion.test.ts` — FOUND (created)
- `src/components/board/Board.tsx` — FOUND (modified)
- `.planning/phases/02-board-substrate-navigation/02-09-SUMMARY.md` — FOUND (this file)

**Commits exist:**
- `469b20b` — RED test commit
- `8a45ee0` — GREEN implementation commit
- `478add4` — Task 2 commit

**Tests:** 20/20 passing

---
*Phase: 02-board-substrate-navigation*
*Plan: 09*
*Completed: 2026-05-26*
