---
phase: 02-foundation-hero
plan: 02
subsystem: ui
tags: [canvas-2d, particles, prefers-reduced-motion, vitest, raf, behavioral-simulation, brand-spine]

# Dependency graph
requires:
  - phase: 01-brand-spine-visual-metaphor
    provides: REPLACEMENT-COPY.md (locked hero copy + 87 percent chip token)
  - phase: 02-foundation-hero (Plan 01 — same-wave dependency in plan)
    provides: scaffolding (globals.css scroll-behavior, page.tsx wiring)
provides:
  - PARTICLE_COUNTS, PARTICLE_SIZES, PARTICLE_COLORS, PARTICLE_MOTION, CONFIDENCE_CHIP, HERO_GRADIENT exports for Plan 04
  - easeOutCubic verbatim function (matches use-hive-animation.ts:57)
  - BehavioralCanvas client component with one-shot 2.2s drift+attract animation, reduced-motion converged-state branch, and DOM-accessible aria-label
  - Vitest invariant suite (4 tests) covering particle-count ordering, percentage range, animation duration window, and easing boundary values
affects: [02-foundation-hero/Plan 04 (BehavioralHero composes BehavioralCanvas + DOM chip + HERO_GRADIENT), future in-app prediction viz rebuild (visual metaphor locked here)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level animation flag pattern (file-scoped `let`, distinct names per consumer to avoid cross-module collisions)
    - Color batching via Map<string, Particle[]> — verbatim reuse of hive-renderer.ts:240-298
    - `useCanvasResize` + `usePrefersReducedMotion` reuse without duplication (composability over copy-paste)
    - Vitest invariants on numeric tunables (catches accidental drift in compile-time literals; cheap + effective without testing visual output)

key-files:
  created:
    - src/components/landing/behavioral-hero-constants.ts (165 LOC) — particle/motion/chip/gradient values + easeOutCubic
    - src/components/landing/BehavioralCanvas.tsx (260 LOC) — client component, RAF loop, reduced-motion branch
    - src/components/landing/__tests__/behavioral-hero-constants.test.ts (38 LOC) — 4-test Vitest invariant suite
  modified:
    - .planning/phases/02-foundation-hero/02-VALIDATION.md — Per-Task Verification Map rows 02-02-01..03 marked ✅ green

key-decisions:
  - "Coral particles use exact hex #FF7F50 / rgba(255, 127, 80, alpha) — NOT oklch() — per Tailwind v4 oklch inaccuracy rule (CLAUDE.md Known Technical Issues)"
  - "Module-level flag is `behavioralHeroAnimationComplete` (file-scoped, NOT exported, NOT colliding with hive's `globalAnimationComplete`) — Pitfall 5 in RESEARCH §6"
  - "Canvas paints particles ONLY — no `ctx.fillText` or `ctx.strokeText` anywhere; the 87 percent chip is rendered by Plan 04 as a DOM overlay so it stays accessible to assistive tech"
  - "Box-Muller Gaussian helper named `gaussian()` (single, reused per-axis with independent samples) — cleaner than the inline pattern in RESEARCH §5"
  - "Particle reduced-motion path uses cluster radius `min(width, height) * 0.12` — matches RESEARCH §5 reference and produces a visible converged cloud immediately"
  - "Test file colocated under `__tests__/` (matches Vitest's existing `src/**/*.test.ts` include glob from vitest.config.ts) — no config changes required"

patterns-established:
  - "Hero-side constants file naming: `behavioral-hero-constants.ts` (kebab-case, mirrors `hive-constants.ts`)"
  - "Module-level animation-played flag must use a consumer-specific name (e.g., `behavioralHeroAnimationComplete`) to avoid colliding with other canvas modules in the same bundle"
  - "Colocated `__tests__/` directory for Vitest unit tests in a feature folder"

requirements-completed: [HERO-06, HERO-07, HERO-08, HERO-10]

# Metrics
duration: 6min
completed: 2026-05-10
---

# Phase 02 Plan 02: BehavioralCanvas + Constants + Vitest Summary

**Canvas 2D drift+attract particle viz (250 desktop / 120 mobile) with one-shot 2.2s animation converging into the upper-center where Plan 04 will overlay an accessible DOM chip — plus a 4-test Vitest suite locking compile-time invariants.**

## Performance

- **Duration:** ~6 min (3 task commits + verification)
- **Started:** 2026-05-10T21:15:24Z (first task commit `dece5a4`)
- **Completed:** 2026-05-10T21:20:41Z
- **Tasks:** 3 of 3
- **Files created:** 3 (165 + 260 + 38 = 463 LOC)
- **Files modified:** 1 (VALIDATION.md task-row status update)

## Accomplishments

- **`behavioral-hero-constants.ts`** ships 6 frozen-config exports and `easeOutCubic` matching `use-hive-animation.ts:57` byte-for-byte. `HERO_GRADIENT` is the exact radial-gradient string from RESEARCH §2 D-37; `CONFIDENCE_CHIP` carries the DOM-overlay tokens for Plan 04.
- **`BehavioralCanvas.tsx`** is a client component (`'use client'` directive) using `useCanvasResize` + `usePrefersReducedMotion` verbatim, declaring its own file-scoped `behavioralHeroAnimationComplete` flag, painting particles via the color-batched Map pattern from `hive-renderer.ts`, and exposing the canvas via `role="img"` + the locked aria-label "Audience particles aggregating into a confidence score of 87 percent".
- **Reduced-motion path** skips RAF entirely — particles are placed directly at the converged cluster (`min(width, height) * 0.12` jitter radius around the upper-center target) and rendered once.
- **One-shot animation** uses Box-Muller Gaussian Brownian noise + radial attractor scaled by `easeOutCubic(t)` + 0.92 damping, with `dt`-aware velocity integration.
- **Vitest suite** asserts the four contract invariants: `mobile<desktop`, percentage in [80, 95], duration in [2000, 2400] ms, and easing boundary values (0 → 0, 1 → 1, 0.5 ≈ 0.875). All 4 tests pass in 2 ms.

## Task Commits

Each task was committed atomically (no `git add -A`; explicit per-file staging):

1. **Task 1: Create `behavioral-hero-constants.ts`** — `dece5a4` (feat)
2. **Task 2: Create `BehavioralCanvas.tsx` client component** — `a99ce68` (feat)
3. **Task 3: Create Vitest invariant suite** — `8b4fce6` (test)

(No metadata commit because this executor runs in worktree mode — orchestrator owns shared-file writes after wave completion.)

## Vitest Run Output

Direct vitest invocation on the new file:

```
$ ./node_modules/.bin/vitest run src/components/landing/__tests__/behavioral-hero-constants.test.ts

 RUN  v4.0.18 /Users/davideloreti/virtuna-v1.1/.claude/worktrees/agent-ad69263ae072a97c5

 ✓ src/components/landing/__tests__/behavioral-hero-constants.test.ts (4 tests) 2ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  23:19:25
   Duration  282ms (transform 25ms, setup 0ms, import 34ms, tests 2ms, environment 0ms)
```

Full-suite run (`pnpm test`) shows the new file slotting into the existing 217 tests with zero regressions: **218 passed, 3 skipped (221 total)**.

## Files Created/Modified

- `src/components/landing/behavioral-hero-constants.ts` — 165 LOC. Six `as const` exports (`PARTICLE_COUNTS`, `PARTICLE_SIZES`, `PARTICLE_COLORS`, `PARTICLE_MOTION`, `CONFIDENCE_CHIP`, `HERO_GRADIENT`) + `easeOutCubic(t)` function. JSDoc references decision IDs D-05/09/10/34/36/37/38.
- `src/components/landing/BehavioralCanvas.tsx` — 260 LOC. Client component exporting `BehavioralCanvas({ className?: string })`. Module-level `behavioralHeroAnimationComplete` flag, `gaussian()` Box-Muller helper, RAF lifecycle with cleanup, color-batched render callback (no text APIs).
- `src/components/landing/__tests__/behavioral-hero-constants.test.ts` — 38 LOC. Vitest `describe('behavioral-hero-constants')` with four `it()` blocks covering the four contract invariants from RESEARCH §4 SC2.
- `.planning/phases/02-foundation-hero/02-VALIDATION.md` — flipped status of rows 02-02-01, 02-02-02, 02-02-03 from `⬜ pending` to `✅ green`.

## Decisions Made

- **Coral hex enforcement:** Used `#FF7F50` and `rgba(255, 127, 80, alpha)` everywhere coral appears (constants, gradient, chip tokens). NOT round-tripped through oklch() per CLAUDE.md "Tailwind v4 oklch inaccuracy" rule.
- **Module flag isolation:** Named the flag `behavioralHeroAnimationComplete` per Pitfall 5. The hive module's `globalAnimationComplete` lives at line 43 of `use-hive-animation.ts`; declaring the same name here would shadow it across the bundle. Distinct names = no collision.
- **Helper consolidation:** Replaced the inline 4-line Box-Muller pattern from RESEARCH §5 with a single `gaussian()` helper called twice per particle per frame (once for vx, once for vy). Cleaner; semantically identical.
- **Non-exported flag (threat T-2-08):** The flag is a `let` declaration at module top. Not on `window`, not exported, not on a ref. No external attack surface for tampering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `ctx.fillText` substring from comment**

- **Found during:** Task 2 (BehavioralCanvas) — initial verification scan
- **Issue:** The acceptance check `! grep -E "fillText|strokeText" src/components/landing/BehavioralCanvas.tsx` is a literal substring grep — it doesn't differentiate between code calls and comment text. My initial implementation comment ("ctx.fillText is intentionally absent so the chip stays accessible") matched the grep, failing the criterion.
- **Fix:** Rewrote the two affected comment lines to phrase the same intent without the literal token: "the canvas-2d text APIs are intentionally avoided so the chip stays accessible to assistive tech". Code behavior unchanged — there were never any actual `ctx.fillText` / `ctx.strokeText` calls.
- **Files modified:** `src/components/landing/BehavioralCanvas.tsx`
- **Verification:** `grep -E "fillText|strokeText" src/components/landing/BehavioralCanvas.tsx` returns no matches.
- **Committed in:** `a99ce68` (Task 2 commit; the comment fix happened pre-commit so it's part of the same atomic commit)

---

**Total deviations:** 1 auto-fixed (1 bug — interpretation of acceptance check)
**Impact on plan:** Comment-only change, zero scope creep. The acceptance criterion is now satisfied per its literal substring semantics.

## Issues Encountered

- **`pnpm lint:vocab` reports 57 pre-existing baseline errors.** These are in files NOT touched by this plan: `src/app/opengraph-image.tsx`, `src/components/landing/{cta-section, faq-section, hero-section, stats-section, social-proof-section, comparison-chart}.tsx`, `src/components/onboarding/{goal-step, preview-step}.tsx`. These existed in the e0fd76d baseline (Phase 2 plan commit) and are owned by Plan 06 BUILD-09 ("Replace plagiarized Artificial Societies copy"). Logged in `.planning/phases/02-foundation-hero/deferred-items.md`. The three new files created in this plan all pass `lint:vocab` clean when checked individually.
- **`pnpm test -- behavioral-hero-constants` does not filter** — pnpm passes the arg to vitest's positional path matching, but the full glob still runs because vitest 4 treats it as an additional pattern, not an `--filter`. Used direct `./node_modules/.bin/vitest run <path>` to verify the new file in isolation. All tests still pass with both invocations.
- **Worktree spawn had no `node_modules`.** Ran `pnpm install --frozen-lockfile --prefer-offline` (7.6s) before testing. `node_modules/` is gitignored so this does not affect commits.

## Next Plan Readiness

**For Plan 04 (BehavioralHero composing canvas + DOM chip + gradient):**
- Imports needed: `import { BehavioralCanvas } from './BehavioralCanvas'`, `import { CONFIDENCE_CHIP, HERO_GRADIENT } from './behavioral-hero-constants'`
- The DOM chip should be a `<div role="status">` (or similar) positioned above the canvas at the convergence point — use `CONFIDENCE_CHIP.percentage` (87), `CONFIDENCE_CHIP.label` ("87%"), and the bg / border / text color tokens.
- The hero ambient backdrop should apply `style={{ backgroundImage: HERO_GRADIENT }}` (the radial-gradient string) — apply via inline style (Tailwind v4 + Lightning CSS issues with backdrop-filter; gradient is fine but inline keeps tokens explicit).
- `pnpm build` is expected to FAIL after this plan (BehavioralHero from Plan 04 not yet present; Plan 01 swapped page.tsx to import BehavioralHero). Wave 1 is "complete and shippable" only after Plan 04 lands.

**Manual verification deferred to Plan 04 / wave merge:**
- Open `http://localhost:3000/` and confirm the canvas renders the one-shot animation
- Toggle `prefers-reduced-motion: reduce` in DevTools and confirm the static converged state appears immediately
- Navigate away and back — the animation must NOT replay (module flag persistence)

## Self-Check: PASSED

**Files exist:**
- `src/components/landing/behavioral-hero-constants.ts` — FOUND
- `src/components/landing/BehavioralCanvas.tsx` — FOUND
- `src/components/landing/__tests__/behavioral-hero-constants.test.ts` — FOUND

**Commits exist on `worktree-agent-ad69263ae072a97c5`:**
- `dece5a4` (Task 1) — FOUND
- `a99ce68` (Task 2) — FOUND
- `8b4fce6` (Task 3) — FOUND

**Tests pass:**
- 4 / 4 invariant tests pass (282ms total runtime including transform + import)
- 218 / 221 full-suite tests pass (3 unrelated skips, no regressions)

**Critical greps pass:**
- `export const HERO_GRADIENT` — FOUND in constants
- `let behavioralHeroAnimationComplete` — FOUND in canvas (line 57)
- `Audience particles aggregating into a confidence score of 87 percent` — FOUND in canvas
- `fillText|strokeText` — ABSENT in canvas
- `globalAnimationComplete` redeclaration — ABSENT in canvas

---
*Phase: 02-foundation-hero*
*Plan: 02*
*Completed: 2026-05-10*
