---
phase: 01-foundation-scaffold
plan: "01"
subsystem: infra
tags: [pnpm, framer-motion, motion, next-app-router, tailwind-v4]

# Dependency graph
requires: []
provides:
  - pnpm.overrides single-runtime alias (framer-motion → motion@^12.29.2 — resolved 12.34.0)
  - Slim marketing layout (fragment-style; root layout owns <html>/<body>/font/globals.css)
  - Locked motionTokens.ts shared constants (durations, easings, staggerDelays, viewportThresholds, triggerOnce)
  - Route-private scaffold under src/app/(marketing)/_components/, _data/, _hooks/, v3/
  - public/landing/placeholders/ asset namespace
affects: [02-hero, 03-spline, 04-demo, 05-howitworks, 06-bento, 07-comparison, 08-science, 09-social-proof, 10-pricing, 11-cutover]

# Tech tracking
tech-stack:
  added:
    - "pnpm.overrides resolution mechanism (top-level package.json directive)"
  patterns:
    - "Single animation runtime via npm alias (PITFALLS § 1 documented workaround — applied with required 4-file legacy-import migration to motion/react)"
    - "Route-group layouts are fragment-style; root layout owns <html>/<body>/font/globals.css"
    - "motionTokens.ts as canonical source of duration/easing constants — every section animation imports from it (POLISH-07)"

key-files:
  created:
    - src/app/(marketing)/motionTokens.ts
    - src/app/(marketing)/_components/.gitkeep
    - src/app/(marketing)/_data/.gitkeep
    - src/app/(marketing)/_hooks/.gitkeep
    - src/app/(marketing)/v3/.gitkeep
    - public/landing/placeholders/.gitkeep
    - .planning/phases/01-foundation-scaffold/deferred-items.md
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/app/(marketing)/layout.tsx
    - src/components/app/simulation/analysis-loading.tsx
    - src/components/app/simulation/loading-phases.tsx
    - src/components/viral-results/FactorCard.tsx
    - src/components/viral-results/ViralScoreRing.tsx

key-decisions:
  - "motion v12.x d.ts files re-export from 'framer-motion', so the override alias creates a circular type-resolution chain. Mitigated by migrating 4 legacy 'framer-motion' import statements to 'motion/react' (PITFALLS § 1 pattern #1 + pattern #2 combined). Net effect: single runtime preserved, zero new tsc errors."
  - "Deleted marketing layout's local metadata export entirely (not just edited title) — Next.js cascades parent metadata when child omits the export. Root metadata ('Virtuna | AI Content Intelligence for TikTok Creators') will own the live `/` route until cutover; the `/v3` page in Plan 05 will export its own page-level title."
  - "Pre-existing 743 tsc errors (vitest globals missing in src/lib/engine/__tests__/) treated as out-of-scope — logged to deferred-items.md. Plan acceptance reinterpreted as 'no NEW tsc errors from alias' (zero introduced)."

patterns-established:
  - "pnpm.overrides for legacy package aliasing: place at top-level of package.json (sibling of dependencies/devDependencies), use 'npm:motion@^X.Y.Z' syntax for npm-registry alias targets"
  - "Marketing layout pattern: import Header, return fragment with <Header /> + {children}, NO local metadata/font/globals.css"
  - "motionTokens.ts contract is locked — values 0.15/0.2/0.3/0.5/0.8 (durations), 0.215/0.61/0.355/1 outCubic, 0.165/0.84/0.44/1 outQuart, 0.42/0/0.58/1 inOut, 0.34/1.56/0.64/1 spring (easings), 0.08/0.04/0.15 stagger, 0.2/0/0.1/0.4 viewports, triggerOnce true"

requirements-completed: [FOUND-02, FOUND-03, FOUND-06, FOUND-07, MOTION-04, MOTION-05, POLISH-07]

# Metrics
duration: 8min
completed: 2026-05-24
---

# Phase 01 Plan 01: Foundation Scaffold Summary

**pnpm.overrides single-runtime alias for framer-motion → motion@12.34, fragment marketing layout, locked motionTokens.ts shared constants, and five .gitkeep-tracked scaffold directories for Phase 1+ landing build.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-24T04:24:20Z
- **Completed:** 2026-05-24T04:33:03Z
- **Tasks:** 3 of 3
- **Files modified:** 13 (7 modified, 6 created, 1 deferred-items.md)

## Accomplishments

- Single animation runtime guaranteed: `pnpm why framer-motion` reports `motion@12.34.0` (caret semver from `^12.29.2`); pnpm-lock.yaml records framer-motion resolving to motion package; bundle will no longer ship duplicate framer-motion chunk
- Marketing layout reduced to a fragment that wraps `{children}` with `<Header />` — duplicate `<html>`/`<body>` removed (hydration warning eliminated), stale "Artificial Societies | Human Behavior, Simulated" metadata deleted, root metadata cascades for `/` route until Plan 05's `/v3/page.tsx` lands
- `motionTokens.ts` exports the locked constants object with `as const` (5 occurrences for outer + 4 easing tuples), JSDoc header references POLISH-07 / MOTION-04 / MOTION-05 guardrails; ready for consumption by every section animation in Phases 2-10
- Four route-private directories (`_components/`, `_data/`, `_hooks/`, `v3/`) + `public/landing/placeholders/` asset namespace scaffolded with `.gitkeep`, satisfying FOUND-06 / FOUND-07 and unblocking Plans 02/03/05's component drops

## Task Commits

Each task was committed atomically:

1. **Task 1: pnpm.overrides alias + single-runtime verification** — `e156d8b` (feat)
2. **Task 2: Slim marketing layout to fragment** — `43b0331` (fix)
3. **Task 3: motionTokens.ts + 5 .gitkeep scaffolds** — `7d56fd4` (feat)

## Files Created/Modified

**Created:**
- `src/app/(marketing)/motionTokens.ts` — locked motion constants (durations, easings, staggerDelays, viewportThresholds, triggerOnce) for cross-section consistency
- `src/app/(marketing)/_components/.gitkeep` — route-private components directory marker
- `src/app/(marketing)/_data/.gitkeep` — route-private data directory marker
- `src/app/(marketing)/_hooks/.gitkeep` — route-private hooks directory marker
- `src/app/(marketing)/v3/.gitkeep` — staging route directory marker
- `public/landing/placeholders/.gitkeep` — placeholder asset namespace marker
- `.planning/phases/01-foundation-scaffold/deferred-items.md` — out-of-scope pre-existing tsc failures (vitest globals missing in engine __tests__)

**Modified:**
- `package.json` — added top-level `pnpm.overrides` block with `framer-motion: npm:motion@^12.29.2`
- `pnpm-lock.yaml` — regenerated by `pnpm install` under override; framer-motion entries now resolve to motion package
- `src/app/(marketing)/layout.tsx` — slimmed from 30 lines (full html/body/font/globals.css/metadata wrapper) to 11 lines (fragment + Header + children)
- `src/components/app/simulation/analysis-loading.tsx` — `from 'framer-motion'` → `from 'motion/react'`
- `src/components/app/simulation/loading-phases.tsx` — `from 'framer-motion'` → `from 'motion/react'`
- `src/components/viral-results/FactorCard.tsx` — `from "framer-motion"` → `from "motion/react"`
- `src/components/viral-results/ViralScoreRing.tsx` — `from "framer-motion"` → `from "motion/react"` (motion, useSpring, useTransform)

## Decisions Made

- **Caret semver lockfile resolution accepted:** Override specified `^12.29.2`; pnpm install resolved to `motion@12.34.0`. Per plan acceptance text "output contains the substring `motion@12.29` (not a separate `framer-motion@12.29.3` install)" — interpretation refined to "motion@12.x (single runtime, not duplicate framer-motion install)" because caret semver is the documented behavior in the override expression itself. PITFALLS § 1 verification command `pnpm why framer-motion` confirms single runtime regardless of patch version.
- **Marketing layout metadata deleted entirely (not just title rewritten):** Plan instruction step 5 was explicit — "delete the local `metadata` export entirely so the root layout's metadata cascades through." Honored.
- **motionTokens.ts file path:** Created at `src/app/(marketing)/motionTokens.ts` (NOT nested inside `_data/` or `_hooks/`). Per UI-SPEC § Component Inventory: file lives at the marketing route-group root, alongside `layout.tsx`. Both Plan 01-01 frontmatter `files_modified` and the UI-SPEC inventory agreed on this location.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migrated 4 stale `framer-motion` imports to `motion/react`**
- **Found during:** Task 1 (pnpm install + tsc verification gate after override applied)
- **Issue:** Plan's task 1 verify step is `pnpm exec tsc --noEmit`. After applying the override and running `pnpm install`, tsc reported new errors in 6 source files importing from `framer-motion` (TS2305: no exported member 'motion'/'AnimatePresence'/'useSpring'/'useTransform') and 7 source files importing from `motion/react` (TS2305: no exported member 'useReducedMotion'/'AnimatePresence', TS2724: no exported member 'useMotionValue'/'useTransform'). Root cause: motion v12.x package's d.ts files declare `export * from 'framer-motion'`, so the override alias creates a circular type-resolution chain — `motion/react` → `framer-motion` (aliased back to motion) → `motion/dom` (subpath that doesn't exist). At runtime the alias works (motion's JS is self-contained), but at type-check time TypeScript can't resolve the named exports.
- **Fix:** Applied PITFALLS § 1 mitigation pattern #1 ("After every shadcn-registry install, grep -r 'from framer-motion' components/ and rewrite to 'motion/react'") in conjunction with the override. Migrated all 4 legacy `framer-motion` imports to `motion/react`. After migration, the 7 files that already imported from `motion/react` (fade-in.tsx, fade-in-up.tsx, slide-up.tsx, hover-scale.tsx, stagger-reveal.tsx, page-transition.tsx, useCountUp.ts) also resolved cleanly — confirming the circular-resolution issue was triggered solely by the presence of any `framer-motion` import.
- **Files modified:** `src/components/app/simulation/analysis-loading.tsx`, `src/components/app/simulation/loading-phases.tsx`, `src/components/viral-results/FactorCard.tsx`, `src/components/viral-results/ViralScoreRing.tsx`
- **Verification:** `pnpm exec tsc --noEmit 2>&1 | grep -E "framer-motion|motion/react"` returns 0 lines after the migration. Total tsc error count unchanged from pre-override baseline (743 — all in `src/lib/engine/__tests__/`, pre-existing).
- **Committed in:** `e156d8b` (Task 1 commit — bundled with override application, since the migration is required for the override to satisfy the plan's tsc verify gate)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** No scope creep. Migration is the documented Pitfall 1 mitigation; bundling it with Task 1 was necessary because the override alone breaks the tsc verify gate. STACK.md research note #3 explicitly anticipated this ("ALL new components must import from `motion/react`, not `framer-motion`. Both deps are installed but `framer-motion` is legacy. Add a lint check or accept the two existing legacy imports in `src/components/app/simulation/*.tsx` and migrate later") — Plan 01-01 effectively completed the "migrate later" follow-up as part of foundation hardening.

## Issues Encountered

- **Pre-existing tsc baseline is not clean (743 errors).** All errors are in `src/lib/engine/__tests__/*.test.ts` and stem from vitest globals (`describe`, `it`, `expect`, `vi`, `beforeEach`) not being declared in `tsconfig.json`. Verified: identical error count before and after this plan's changes. Per scope-boundary rule, did not auto-fix — logged to `.planning/phases/01-foundation-scaffold/deferred-items.md` for a future maintenance pass. Plan 01-01 acceptance criterion "`pnpm exec tsc --noEmit` exits 0" reinterpreted as "no NEW tsc errors from the alias" per the literal parenthetical in the acceptance text ("no new TypeScript errors from the alias"). Zero new errors introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 02 (Tailwind v4 motion utilities + globals.css landing block):** Can safely add `@theme inline` keyframe blocks for landing animations; PITFALLS § 3 oklch guardrail referenced in motionTokens.ts header so future contributors are aware.
- **Plan 03 (Header refresh + above-fold trust strip):** marketing layout is now a fragment; Header (currently still labeled "Artificial Societies" in `src/components/layout/header.tsx`) will get rebranded to Virtuna in Plan 03 — the layout itself is foundation-clean.
- **Plan 04 (Magic UI + Aceternity install audit):** Single-runtime alias active. PITFALLS § 1 mitigation #3 still applies — Plan 04 should grep installed components for any new stray `from "framer-motion"` and rewrite to `motion/react` (pattern now demonstrated by this plan).
- **Plan 05 (/v3 staging route + page-level title):** Scaffolded `v3/` directory exists; ready to receive `page.tsx` with the `"Virtuna | Predict viral before you post"` title per UI-SPEC § Copywriting Contract.
- **Blocker:** None for Phase 01. (Phase-wide blockers from STATE.md remain: Phase 3 Spline scene file, Phase 8 citations, Phase 9 lockup SVG, Phase 11 pricing + Vercel approval.)

## Self-Check: PASSED

Verified before finalizing this SUMMARY (per `<self_check>`):

- `[ -f .planning/phases/01-foundation-scaffold/deferred-items.md ]` → FOUND
- `[ -f src/app/(marketing)/motionTokens.ts ]` → FOUND
- `[ -d src/app/(marketing)/_components ]` → FOUND
- `[ -d src/app/(marketing)/_data ]` → FOUND
- `[ -d src/app/(marketing)/_hooks ]` → FOUND
- `[ -d src/app/(marketing)/v3 ]` → FOUND
- `[ -d public/landing/placeholders ]` → FOUND
- `git log --oneline -10 | grep e156d8b` → FOUND (Task 1)
- `git log --oneline -10 | grep 43b0331` → FOUND (Task 2)
- `git log --oneline -10 | grep 7d56fd4` → FOUND (Task 3)

---
*Phase: 01-foundation-scaffold*
*Completed: 2026-05-24*
