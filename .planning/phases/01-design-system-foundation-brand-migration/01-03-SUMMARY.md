---
phase: 01-design-system-foundation-brand-migration
plan: 03
subsystem: design-system / motion
tags: [motion, accessibility, stage-reveal, reduced-motion, tokens, DS-07]
requires:
  - "src/components/motion/stagger-reveal.tsx (gate analog: useReducedMotion early-return)"
  - "src/app/globals.css .numen-surface token layer (Plan 01)"
  - "motion (motion/react) — D-10 motion lib"
provides:
  - "src/components/numen/stage-reveal.tsx — StageBlock calm stage-reveal (the ONE key motion moment)"
  - "--numen-ease-calm easing token (kit motion design source of truth)"
affects:
  - "Phase 4 Reading reveal (builds on StageBlock)"
tech-stack:
  added: []
  patterns:
    - "Research Pattern 3: AnimatePresence + opacity tween + high-damping spring + useReducedMotion gate"
    - "Reduced-motion = zero the translate (y:0 initial + duration:0) → static opacity appear"
key-files:
  created:
    - "src/components/numen/stage-reveal.tsx"
  modified:
    - "src/app/globals.css (appended --numen-ease-calm to .numen-surface)"
decisions:
  - "Spring stiffness 220 / damping 30 (ratio ≥ 1 → critically/over-damped → no overshoot) per Research Pattern 3"
  - "Component inlines the calm easing array [0.215,0.61,0.355,1]; --numen-ease-calm token is the design source of truth (mirrors the array)"
  - "Forbidden --ease-spring (cubic-bezier 0.34,1.56,0.64,1) byte-unchanged + never referenced by the Numen kit"
metrics:
  duration_min: 11
  tasks: 1
  files: 2
  completed: "2026-06-11"
---

# Phase 01 Plan 03: Calm Motion (StageBlock Stage-Reveal) Summary

StageBlock stage-reveal (DS-07) — opacity tween + non-overshooting high-damping spring, degrading to a static opacity appear under prefers-reduced-motion; ships a new `--numen-ease-calm` token without reusing the forbidden bouncy `--ease-spring`.

## What Was Built

- **`src/components/numen/stage-reveal.tsx`** (`"use client"`): `StageBlock({ show, children })` built on `motion/react` `AnimatePresence` + `motion` + `useReducedMotion` (D-10). Reveals each completed engine stage's block via:
  - **opacity**: calm tween, `duration 0.4`, `ease [0.215, 0.61, 0.355, 1]` (base tier)
  - **translate (`y`)**: high-damping spring `stiffness 220 / damping 30` (damping ratio ≥ 1 → no overshoot, no bounce)
  - **exit**: `opacity 0`, `duration 0.2` (fast tier) — `AnimatePresence` handles exits
- **Reduced motion (D-14, hard a11y requirement)**: when `useReducedMotion()` is true, initial `y` is `0` and its transition `duration` is `0` → static opacity appear, NO translate/slide. Mitigates the plan's T-03-01 vestibular-motion threat.
- **`src/app/globals.css`**: appended `--numen-ease-calm: cubic-bezier(0.215, 0.61, 0.355, 1)` to the `.numen-surface` layer as the kit's calm-easing design source of truth. The coral `@theme` and the existing `--ease-spring` were not touched.

## Verification

- `pnpm vitest run tests/numen/stage-reveal.test.ts` → **GREEN, 2/2** (was RED: `Failed to resolve import "@/components/numen/stage-reveal"`).
- `pnpm build` → compiles clean (full route table emitted, client component builds).
- `npx eslint src/components/numen/stage-reveal.tsx` → no issues.
- Acceptance greps: `useReducedMotion` ≥1, `AnimatePresence` ≥1, `spring` present (`stiffness 220, damping 30`), forbidden `0.34, 1.56` in component = **0**, `numen-ease` in globals.css ≥1, existing `--ease-spring` line **byte-unchanged** (2 occurrences: token def + the new token's reference-in-comment).

## TDD Gate Compliance

The RED gate (`test(...)`) for this feature was committed earlier as part of the Wave-0 scaffold (`tests/numen/stage-reveal.test.ts` already tracked and failing to resolve the import). This plan supplied the **GREEN** gate: a single `feat(01-03)` commit (`148930ae`) that makes the pre-existing failing test pass. No REFACTOR commit needed (component shipped clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint/Scan hardening] Removed forbidden-curve literal from component doc comment**
- **Found during:** Task 1 acceptance verification.
- **Issue:** Initial doc comment quoted the forbidden `cubic-bezier(0.34, 1.56, 0.64, 1)` for explanation, which made `grep -c '0.34, 1.56' src/components/numen/stage-reveal.tsx` return `1` — violating the plan's acceptance criterion (must be `0`) and risking a downstream lint scan flag.
- **Fix:** Reworded the comment to describe the forbidden token without embedding the literal curve.
- **Files modified:** `src/components/numen/stage-reveal.tsx`
- **Commit:** `148930ae` (folded into the feature commit)

## Deferred Issues (Out of Scope)

Pre-existing `tsc --noEmit` errors unrelated to this plan's files (NOT introduced here, NOT fixed per scope boundary):
- `tests/numen/stage-reveal.test.ts(30,33)` TS2769 — the Wave-0 RED scaffold's `createElement(StageBlock, { show: true } as Record<string, unknown>, ...)` cast. The test runs GREEN under vitest (esbuild) and the Next build excludes test files, so it is non-blocking. The authored component (`src/components/numen/stage-reveal.tsx`) has zero tsc errors.
- 12 further pre-existing tsc errors in `src/lib/engine/__tests__/*`, `src/components/board/verdict/__tests__/fixtures/*`, and `tests/numen/tokens.test.ts` — unrelated engine/board/token test fixtures, out of scope.

## Known Stubs

None. The component is fully wired (props → motion variants); no placeholder/empty-data paths.

## Threat Flags

None — pure client-side presentational motion; no input, data, network, or secret surface. T-03-01 (vestibular motion) mitigated by the `useReducedMotion()` gate as planned.

## Commits

- `148930ae` — feat(01-03): StageBlock calm stage-reveal + numen-ease-calm token (DS-07)

## Self-Check: PASSED
