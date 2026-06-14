---
phase: 01-foundation-shell
plan: 03
subsystem: ui
tags: [motion, motion-react, framer-motion, reduced-motion, accessibility, tailwind-v4, nextjs, rsc]

# Dependency graph
requires:
  - phase: 01-01
    provides: "globals.css flat-warm @theme (skeleton-breathe/shimmer/marquee keyframes + utilities); (marketing)/page.tsx scroll-skeleton; src/components/motion/* already on motion/react"
  - phase: 01-02
    provides: "src/components/marketing/ dir + barrel index.ts (Placeholder export) — this plan appends to the same barrel"
provides:
  - "Global <MotionConfig reducedMotion='user'> boundary (MotionConfigShell) wrapping the entire / landing tree"
  - "CSS @media (prefers-reduced-motion: reduce) block halting the 4 non-Framer animations (skeleton-breathe, shimmer, marquee, marquee-vertical)"
  - "D-16 verified: marketing/motion surface is 100% framer-motion-free (motion/react only); zero migration performed"
  - "Two-layer reduced-motion contract satisfied for every later phase that adds animation"
affects: [02-hero, 03-the-simulation, 04-pricing-faq, 05-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer reduced-motion: <MotionConfig reducedMotion='user'> (Framer layer) + CSS @media prefers-reduced-motion block (non-Framer layer)"
    - "Client motion boundary as a thin shell rendering RSC children — page stays a server component, route stays statically prerendered (○)"

key-files:
  created:
    - src/components/marketing/motion-config.tsx
  modified:
    - src/app/globals.css
    - src/components/marketing/index.ts
    - src/app/(marketing)/page.tsx

key-decisions:
  - "MotionConfigShell wraps the full chrome (Header + main + Footer) — the tightest wrap that covers all current and future animated content; chosen over a narrower main-only wrap because the header/footer own client motion in 01-04/01-05"
  - "CSS reduced-motion block placed after the final @theme inline marquee section in globals.css (the clean spot the plan named); uses animation:none !important to beat Tailwind-generated marquee utilities"
  - "D-16 satisfied by VERIFY + MotionConfig wiring, NOT migration — framer-motion dep retained (4 out-of-scope product files still import it); dep removal deferred to Phase 5"

patterns-established:
  - "Two-layer reduced-motion contract (Framer MotionConfig + CSS @media) — every later-phase animation inherits an OS-reduce fallback for free"
  - "Marketing barrel append convention: new marketing components add their export without clobbering prior exports (Placeholder + MotionConfigShell coexist)"

requirements-completed: [FOUND-04]

# Metrics
duration: 3min
completed: 2026-06-14
---

# Phase 01 Plan 03: Motion Foundation & Global Reduced-Motion Summary

**Global `<MotionConfig reducedMotion="user">` boundary (MotionConfigShell) over the entire `/` landing plus a CSS `@media (prefers-reduced-motion: reduce)` block — a two-layer reduced-motion contract — with D-16 verified (marketing/motion surface is framer-motion-free, zero migration).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-14T18:41:44Z
- **Completed:** 2026-06-14T18:45:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Created `MotionConfigShell` — a `"use client"` shell wrapping children in `<MotionConfig reducedMotion="user">` (D-17 layer 1); every descendant `motion.*` element now auto-respects the OS reduced-motion setting (transform/layout animations disabled under reduce, opacity preserved).
- Wired the shell around the `/` scroll-skeleton chrome (Header + main + Footer). The page stays a server component and `/` still compiles as a statically prerendered route (`○`) — the client boundary did not force the route dynamic.
- Appended a `@media (prefers-reduced-motion: reduce)` block to `globals.css` (D-17 layer 2) that sets `animation: none !important` for the four non-Framer CSS animations `MotionConfig` cannot reach: `.animate-skeleton-breathe`, `.animate-shimmer`, `.animate-marquee`, `.animate-marquee-vertical`.
- **D-16 verified (no migration):** all 6 `src/components/motion/*` wrappers import `motion/react`; zero import `framer-motion`. The only 4 `framer-motion` importers are the out-of-scope product files — left untouched, dep retained (removal deferred to Phase 5).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the client `<MotionConfig>` shell and wire it into the / skeleton** — `7661ad49` (feat)
2. **Task 2: Append the CSS reduced-motion block to globals.css + record the D-16 verify** — `8b9f1c85` (feat)

**Plan metadata:** _(this commit)_ — `docs(01-03): complete motion-foundation plan`

## Files Created/Modified

- `src/components/marketing/motion-config.tsx` *(created)* — `MotionConfigShell` client component; `<MotionConfig reducedMotion="user">{children}</MotionConfig>`, props `{ children }`. The global reduced-motion boundary (layer 1).
- `src/app/globals.css` *(modified)* — appended the `@media (prefers-reduced-motion: reduce)` block after the `@theme inline` marquee section (layer 2).
- `src/components/marketing/index.ts` *(modified)* — appended `MotionConfigShell` + `MotionConfigShellProps` exports; preserved the `Placeholder`/`placeholderVariants`/`PlaceholderProps` exports from 01-02.
- `src/app/(marketing)/page.tsx` *(modified)* — imported `MotionConfigShell` from `@/components/marketing`; replaced the page's wrapping fragment with `<MotionConfigShell>…</MotionConfigShell>` around Header + main + Footer.

## D-16 Verification (recorded per plan output requirement)

Command + result (run at execution, build-current):

```
$ grep -rln "from 'motion/react'" src/components/motion/   →  6 files
    hover-scale.tsx, fade-in.tsx, stagger-reveal.tsx, fade-in-up.tsx,
    page-transition.tsx, slide-up.tsx
$ grep -rl  "from 'framer-motion'" src/components/motion/   →  (empty)  ✅ 0 framer-motion in wrappers
$ grep -rln "from 'framer-motion'" src/                     →  4 files (OUT OF SCOPE — untouched):
    src/components/app/simulation/analysis-loading.tsx
    src/components/app/simulation/loading-phases.tsx
    src/components/viral-results/ViralScoreRing.tsx
    src/components/viral-results/FactorCard.tsx
$ grep "framer-motion" package.json                         →  "framer-motion": "^12.29.3"  (RETAINED — dep removal deferred to Phase 5)
```

**Conclusion:** D-16 is a no-op for the marketing/motion surface — the wrappers were already on `motion/react`. Phase-1's D-16 obligation is met by this verify + the `MotionConfig` wiring (Task 1), exactly as RESEARCH §3 recommended. No migration, no dep removal.

## Decisions Made

- **Widest wrap chosen for MotionConfigShell.** The plan offered "tightest wrap that covers all animated content" with an explicit option to include Header/Footer. I wrapped all three (Header + main + Footer) because: (a) the header (01-04) and footer (01-05) own their own `"use client"` motion boundaries and will add `motion.*` elements; (b) a server page passing RSC children to a thin client shell keeps `/` statically prerendered (verified `○` in the build route table). This is the most robust foundation for Phases 2–4 with no first-paint or SSR cost.
- **`animation: none !important` (not a near-zero duration).** No animation in this milestone is load-bearing for content or first paint, so a hard stop is the correct, unambiguous fallback and reliably overrides the Tailwind-v4-generated `.animate-marquee*` utilities.

## Deviations from Plan

None — plan executed exactly as written. (The shell placement decision above is a documented choice *within* the plan's stated discretion — "choose the tightest wrap that covers all animated content … or the widest wrap" — not a deviation.)

## Issues Encountered

None. Both grep gates and the production build passed on the first run. The `/` route remained statically prerendered after introducing the client `MotionConfig` boundary (confirmed in the build route table).

## User Setup Required

None — no external service configuration required. (Client motion config + CSS only; no input, network, or datastore — matches the plan's threat model, which this plan *mitigates* via T-01-03.)

## Verification

- `pnpm build` → exit 0, `/` compiles as `○` (static). ✅
- `grep -rl "from 'framer-motion'" src/components/motion/` → empty (D-16). ✅
- CSS block references all 4 animation classes with `animation: none`. ✅
- **Deferred to Phase-5 gate (manual, not a per-plan blocker):** DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" → skeleton-breathe / shimmer / marquee visibly stop. The plan marks this an at-phase-gate check; the static code + build are green.

## Next Phase Readiness

- **Two-layer reduced-motion contract is live** — Phase 2 (hero, the "crowd → score" signature) and Phases 3–4 can add any `motion.*` animation and inherit the OS-reduce fallback for free, plus the CSS layer for any new non-Framer keyframes (add the class to the `@media` block).
- No blockers. The redundant `framer-motion` dep removal remains the only deferred item (Phase 5 hardening, gated on the 4 product files migrating or moving out of the build).

## Self-Check: PASSED

- `src/components/marketing/motion-config.tsx` — FOUND
- `.planning/phases/01-foundation-shell/01-03-SUMMARY.md` — FOUND
- Commit `7661ad49` (Task 1) — FOUND
- Commit `8b9f1c85` (Task 2) — FOUND

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-14*
