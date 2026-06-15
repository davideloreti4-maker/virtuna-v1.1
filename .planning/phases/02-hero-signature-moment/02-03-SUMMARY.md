---
phase: 02-hero-signature-moment
plan: 03
subsystem: marketing-hero
tags: [hero, rsc, ssr-floor, svg-ring, dynamic-ssr-false, reduced-motion, perf-tier, no-cls, tdd-green]

# Dependency graph
requires:
  - phase: 02-hero-signature-moment
    provides: "Wave-0 RED gates composed-still.test.tsx + signature-moment-client.test.tsx + hero-constants.test.ts (HERO-03 still-side + HERO-04 acceptance as executable assertions)"
  - phase: 02-hero-signature-moment
    provides: "02-01 RSC <Hero> + the dimension-locked (aspect-ratio 16/10) stage shell the still + island mount into"
  - phase: 01-foundation-shell
    provides: "<Placeholder> slot, flat-warm @theme tokens, usePrefersReducedMotion/useIsMobile hooks, perf-tier store, verdict-constants BAND_THRESHOLDS"
provides:
  - "hero-constants.ts — single source of truth: HERO_SCORE (87, >=70 honest), PARTICLE_COUNT_DESKTOP (420), TIMING (<=3.5s), RING_SIZE/RING_STROKE geometry, EASING + PALETTE token names"
  - "ComposedStill — the RSC UNIVERSAL FLOOR (phone + deterministic settled dot field + clean coral SVG arc ring + static score), role=img/aria-label + aspect-lock; serves SSR pre-hydration == reduced-motion == mobile == at-rest (D-15/HERO-04)"
  - "SignatureMomentClient — the 'use client' boundary holding the ONLY dynamic(ssr:false) call (THE landmine fix), gated off under reduced-motion/mobile/low-tier/fps-drop (returns null); ComposedStill is its dynamic loading fallback"
  - "hero.tsx stage wired to <ComposedStill> + <SignatureMomentClient> stacked in the no-CLS box; standalone Placeholder removed (it now lives inside ComposedStill)"
affects: [02-02-signature-canvas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-only entrypoint (RESEARCH Pattern 1): dynamic(() => import('./signature-canvas'), { ssr: false, loading: () => <ComposedStill/> }) lives ONLY in the 'use client' signature-moment-client.tsx; the RSC Hero renders it as a child — Next.js 16 ssr-disabled-import-in-RSC landmine avoided (mirrors in-repo Board.tsx)"
    - "Still-favoring manual gating (RESEARCH Pattern 2): usePrefersReducedMotion + useIsMobile default true pre-mount, perf tier + fps sampler mirror Board.tsx; animate = !reduced && !isMobile && tier!=='low' && !fpsDropped; gate false → return null so the rAF island never mounts under reduced-motion (Pitfall 5)"
    - "Deterministic SSR scatter: mulberry32-style seeded PRNG (never Math.random) builds the ~46-dot settled field once at module scope so SSR markup === client markup (no hydration mismatch)"
    - "Clean re-derived SVG arc ring: geometry from ViralScoreRing (radius=(SIZE-STROKE)/2=114, offset=circumference-(score/100)*circumference) with glow filter / tier colors / white / framer-motion all STRIPPED; coral progress + tone-step track only"

key-files:
  created:
    - "src/components/marketing/hero/hero-constants.ts"
    - "src/components/marketing/hero/composed-still.tsx"
    - "src/components/marketing/hero/signature-moment-client.tsx"
    - "src/components/marketing/hero/signature-canvas.tsx (TEMPORARY STUB — 02-02 replaces)"
  modified:
    - "src/components/marketing/hero/hero.tsx"

key-decisions:
  - "The dynamic(ssr:false) canvas import lives ONLY in signature-moment-client.tsx ('use client'); Hero stays a pure RSC and / stays statically prerendered (○). THE landmine fix, verified by a clean build."
  - "ComposedStill is a pure RSC (no 'use client', no client hooks, no canvas) so the floor paints pre-hydration with zero JS and IS the reduced-motion/mobile/at-rest frame (D-15)."
  - "Settled dot field is a deterministic seeded-PRNG scatter (~46 low-alpha cream/charcoal SVG circles), built once at module scope — never Math.random — so SSR === client markup; no canvas, ~zero cost."
  - "Required a TEMPORARY signature-canvas.tsx stub (re-renders ComposedStill) NOT in this plan's files_modified — without it the ssr:false dynamic import + the vitest collector cannot resolve import('./signature-canvas'). 02-02 REPLACES it with the real canvas-2D play."
  - "Score number is STATIC in the still (count-up belongs to the 02-02 canvas play); coral (allowlist) + tabular-nums + text-display 64px, /100 suffix in cream-muted."

patterns-established:
  - "Pattern 1 (client-only entrypoint) — ssr:false ONLY inside the 'use client' boundary; RSC renders it as a child"
  - "Pattern 2 (still-favoring gate) — conservative pre-mount defaults + return null under reduced-motion/mobile/low-tier so the heavy island never mounts on those paths"
  - "Deterministic seeded-PRNG SVG scatter for hydration-safe server-rendered decorative fields"

requirements-completed: [HERO-03, HERO-04]

# Metrics
duration: ~30min (prior session; closed out 2026-06-15)
completed: 2026-06-15
---

# Phase 2 Plan 03: ComposedStill SSR Floor + ssr:false Client Boundary Summary

**Built the keystone of Phase 2 — `ComposedStill`, the pure-RSC universal floor (phone + deterministic settled dot field + clean re-derived coral SVG arc ring + honest static score, role=img/aria-label, aspect-locked) that serves SSR pre-hydration == reduced-motion == mobile == at-rest (D-15/HERO-04) — plus `hero-constants.ts` (the token-derived score/geometry/timing/palette SSOT) and `SignatureMomentClient`, the `"use client"` boundary that holds the ONLY `dynamic(ssr:false)` call (THE landmine fix) and gates the canvas off under reduced-motion/mobile/low-tier. Wired both into the 02-01 stage; Hero stays a pure RSC, `/` stays statically prerendered, and all 4 hero suites are GREEN (15/15).**

## Performance

- **Duration:** ~30 min (executed in a prior session)
- **Tasks:** 2
- **Files created:** 3 (+1 temporary stub) · **Files modified:** 1

## Accomplishments

- **HERO-04 (static fallback + lazy/gated boundary):** one `ComposedStill` serves every still path (SSR pre-hydration, reduced-motion, mobile, at-rest). The canvas island is gated off on those paths — `SignatureMomentClient` returns `null` unless `!reduced && !isMobile && tier !== "low" && !fpsDropped`, so the rAF loop never mounts under reduced-motion (Pitfall 5). The `dynamic(ssr:false)` call lives only in that `"use client"` module; `npm run build` proves no "ssr: false is not allowed ... in Server Components" error.
- **HERO-03 (still-side):** the clean coral arc ring + honest score render server-side. Geometry re-derived from `ViralScoreRing` (radius 114, `offset = circumference − (score/100)·circumference`) with the glow filter, tier colors, white text, and framer-motion all stripped — coral progress (`var(--color-accent)`) + tone-step track (`var(--color-surface-elevated)`) only. `HERO_SCORE = 87 ≥ BAND_THRESHOLDS.STRONG (70)`, so the coral "will pop" readout is truthful (A2).
- **`hero-constants.ts` SSOT:** `HERO_SCORE` (87), `PARTICLE_COUNT_DESKTOP` (420), `TIMING` (settle/reaction/coalesce, total ≤3500ms), `RING_SIZE`/`RING_STROKE` (240/12), `EASING` + `PALETTE` token-name references — consumed by both the still now and the 02-02 canvas next, so still and animation share one score/geometry/budget.
- **Deterministic settled field:** a ~46-dot seeded-PRNG (mulberry32-style, never `Math.random`) scatter of low-alpha cream/charcoal SVG circles in two orbits + an outer sprinkle, built once at module scope so SSR markup === client markup (no hydration mismatch). No white, no coral on base dots.
- **Wiring + landmine held:** `hero.tsx` stacks `<ComposedStill score={HERO_SCORE}>` (SSR floor) + `<SignatureMomentClient score={HERO_SCORE}>` (client island overlay) in the same dimension-locked stage; the standalone Placeholder was removed (the phone now lives inside `ComposedStill`). `hero.tsx`/`page.tsx` stay pure RSCs.
- **Gate GREEN:** all four hero suites pass — `hero-constants` (2), `signature-moment-client` (2), `composed-still` (6), `hero` (5) = **15/15**. `npm run build` exits 0; route table shows `○ /` (Static).

## Task Commits

This plan was executed in a prior session and closed out here. Commit hygiene deviated (see Issues):

1. **Task 1: hero-constants.ts + ComposedStill (the SSR floor)** — `86b744ba` (feat: "hero-constants + ComposedStill SSR floor")
2. **Task 2: SignatureMomentClient boundary (ssr:false fix + gating) + wire into Hero** — `5574c4f4` (captured by an `auto-wip` hook commit: "ui — hero.tsx, signature-canvas.tsx, signature-moment-client.tsx") rather than a clean `feat(02-03)` Task-2 commit.

**Plan metadata / close-out:** this SUMMARY + STATE/ROADMAP tracking advanced in the resume session.

## Files Created/Modified

- **`src/components/marketing/hero/hero-constants.ts`** (created) — token-derived SSOT: `HERO_SCORE`, particle budget, `TIMING`, ring geometry, `EASING`, `PALETTE`.
- **`src/components/marketing/hero/composed-still.tsx`** (created) — pure-RSC universal floor: `<figure role="img" aria-label>` + aspect-lock; deterministic settled dot field; clean coral SVG arc ring (track + progress, score-encoded offset); static coral score with `/100` suffix; in-scene phone `<Placeholder>`.
- **`src/components/marketing/hero/signature-moment-client.tsx`** (created) — `"use client"` boundary: the lone `dynamic(ssr:false)` import of `./signature-canvas` with `ComposedStill` as loading fallback; reduced-motion + mobile + perf-tier + fps-drop gating; `return null` on the still paths.
- **`src/components/marketing/hero/hero.tsx`** (modified) — stage interior wired to `ComposedStill` + `SignatureMomentClient` stacked in the no-CLS box; standalone Placeholder removed; stays a pure RSC.
- **`src/components/marketing/hero/signature-canvas.tsx`** (created — TEMPORARY STUB, NOT in plan scope) — re-renders `ComposedStill` so the `ssr:false` dynamic import + the vitest collector resolve `import("./signature-canvas")`. **02-02 replaces this with the real canvas-2D play.**

## Decisions Made

- **`dynamic(ssr:false)` confined to the `"use client"` boundary.** Mirrors in-repo `Board.tsx`; keeps Hero/page RSC and `/` static. Verified by build exit 0 + `○ /`.
- **`ComposedStill` is a pure RSC.** Floor must paint pre-hydration with zero JS and double as the reduced-motion/mobile/at-rest frame (D-15).
- **Deterministic seeded-PRNG dot field.** Hydration-safe (SSR === client), no canvas, ~zero cost.
- **Static score in the still.** Count-up belongs to the 02-02 canvas; the still shows the resolved final number.
- **Temporary `signature-canvas.tsx` stub introduced.** Necessary so both the build-time `ssr:false` import and the vitest collector resolve the forward reference before 02-02 lands; explicitly marked for replacement.

## Deviations from Plan

### 1. [Build-order necessity] Temporary `signature-canvas.tsx` stub created (outside files_modified)
- **Found during:** Task 2 (the `dynamic(() => import('./signature-canvas'))` forward reference).
- **Issue:** The plan assumed the `ssr:false` dynamic import need not resolve until 02-02. In practice the vitest module collector (and a clean build) must statically resolve `import("./signature-canvas")` or the 02-00 hero suites fail to COLLECT ("Failed to resolve import").
- **Fix:** Added a minimal stub (`export default` re-rendering `ComposedStill`) clearly commented as 02-02's replacement target. Keeps every gate honest now without pre-empting 02-02's craft work.
- **Files modified:** `src/components/marketing/hero/signature-canvas.tsx` (new stub).
- **Verification:** all 4 hero suites collect + pass (15/15); build exits 0.

---

**Total deviations:** 1 (build-order necessity, no scope creep).
**Impact on plan:** The stub is the planned 02-02 seam, surfaced one step early so the gates resolve. 02-02 replaces it.

## Issues Encountered

- **Commit hygiene: Task 2 captured by an `auto-wip` hook.** Task 1 landed as a clean `feat(02-03)` commit; Task 2's edits (`signature-moment-client.tsx`, `hero.tsx`, `signature-canvas.tsx` stub) were swept into a `chore(auto-wip)` commit rather than an atomic `feat(02-03): … (Task 2)` commit, and the prior session never wrote this SUMMARY or advanced STATE/ROADMAP. The code is correct and verified; this close-out reconciles tracking. (The auto-wip hook firing mid-plan is a process snag to watch — it can pre-empt the executor's atomic-commit protocol.)

## User Setup Required

None — no external services, no new dependencies, no runtime/network/secrets. Pure additive marketing markup + a token-derived constants module.

## Next Phase Readiness

- **02-02 (signature canvas, the wow):** replace `signature-canvas.tsx`'s stub with the real `requestAnimationFrame` coalesce play. Its ring end-state MUST be pixel-consistent with `ComposedStill`'s SVG ring (same `RING_SIZE`/`RING_STROKE`/`HERO_SCORE` from `hero-constants.ts`). Use `PARTICLE_COUNT_DESKTOP`, `TIMING`, `EASING`, `PALETTE` from the constants module. The still is already its `dynamic` loading fallback + at-rest frame, so the canvas only owns the once-through play. 02-02 carries a **blocking `checkpoint:human-verify`** (the calm/refined craft bar — subjective, manual-only).
- **Landmine reminder:** the canvas is loaded via the existing `ssr:false` boundary — do NOT add any `ssr:false`/client directive back into `hero.tsx` or `composed-still.tsx`.
- No blockers.

## Self-Check: PASSED

- All four files exist: `hero-constants.ts`, `composed-still.tsx`, `signature-moment-client.tsx`, `hero.tsx` (+ the `signature-canvas.tsx` stub).
- `composed-still.tsx` has NO "use client"; the `ssr:false` call appears ONLY in `signature-moment-client.tsx` (line 1 `"use client"`); `hero.tsx`/`page.tsx` have NO client directive.
- Commits present: `86b744ba` (Task 1), `5574c4f4` (Task 2, auto-wip).
- All 4 hero suites GREEN (15/15); `npm run build` exit 0 with `○ /` (statically prerendered); progress arc stroke === `var(--color-accent)`; `HERO_SCORE` 87 ≥ 70.

---
*Phase: 02-hero-signature-moment*
*Completed: 2026-06-15*
