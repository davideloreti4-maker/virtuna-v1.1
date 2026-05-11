---
phase: 01-foundation-route-scaffolding
plan: 01
subsystem: testing-foundation
tags: [vitest, invariant-tests, wave-0, magic-ui, marketing-shell]
dependency_graph:
  requires:
    - vitest.config.ts (existing, environment: "node", include: ["src/**/*.test.ts"])
    - src/app/(marketing)/page.tsx (existing, still contains AS imports — invariant target)
    - src/app/(marketing)/layout.tsx (existing, still contains AS title — invariant target)
    - src/app/(marketing)/pricing/page.tsx (existing — invariant target)
    - src/components/landing/ (existing — invariant target for deletion)
    - src/app/globals.css (existing — invariant target for @keyframes shine)
  provides:
    - src/components/magic-ui/__tests__/magic-card.test.ts (lock — coral gradientFrom #FF7F50)
    - src/components/magic-ui/__tests__/border-beam.test.ts (lock — coral rgba in colorFrom)
    - src/components/magic-ui/__tests__/shine-border.test.ts (lock — coral palette array in shineColor)
    - src/components/magic-ui/__tests__/marketing-shell.test.ts (lock — page.tsx empty, no plagiarized AS imports)
  affects:
    - Plan 01-02 (Magic UI install + tune) — these tests turn 3 of 4 files GREEN
    - Plan 01-03 (shell + cleanup) — turns marketing-shell.test.ts GREEN
    - Plan 01-05 (final verification) — re-runs full pnpm test
tech_stack:
  added: []
  patterns:
    - "Invariant tests as file-content assertions via node:fs + node:path"
    - "RED tests as Wave 0 lock contract (RED before downstream plans, GREEN after)"
key_files:
  created:
    - src/components/magic-ui/__tests__/magic-card.test.ts
    - src/components/magic-ui/__tests__/border-beam.test.ts
    - src/components/magic-ui/__tests__/shine-border.test.ts
    - src/components/magic-ui/__tests__/marketing-shell.test.ts
  modified: []
decisions:
  - "Use node:fs string assertions (not React render): compatible with vitest node environment + .test.ts include glob; no Vitest reconfig needed"
  - "Commit tests RED: Wave 0 contract — tests fail until Plans 02 + 03 land downstream"
metrics:
  duration_minutes: 5
  tasks_completed: 1
  files_created: 4
  files_modified: 0
  completed: 2026-05-11
requirements:
  - SC-2
  - SC-2.tuning
  - SC-1
---

# Phase 01 Plan 01: Wave 0 Invariant Tests Summary

**One-liner:** 4 vitest invariant tests committed RED (21/21 failing) as Wave 0 contract — turn GREEN after Plans 02 (Magic UI install + coral tuning) and 03 (marketing shell cleanup + AS deletion).

## What Shipped

Created `src/components/magic-ui/__tests__/` directory with 4 vitest test files that lock the tuning and cleanup invariants for Plans 02 + 03. All tests use `node:fs` + `node:path` string assertions on file contents — no React render, no JSX, no `@testing-library/react`. This makes them compatible with the existing `vitest.config.ts` (`environment: "node"`, `include: ["src/**/*.test.ts"]`) without any config changes.

### Invariants Encoded

**`magic-card.test.ts` (5 invariants):**
- Source file exists at `src/components/magic-ui/magic-card.tsx`
- Ships with `'use client'` directive
- `gradientFrom` default contains coral `#FF7F50` and does NOT contain stock violet `#9E7AFF`
- `gradientTo` default does NOT contain stock pink `#FE8BBB`
- Preserves `next-themes` mounted-state hydration guard (`useState(false)` + `setMounted(true)`)

**`border-beam.test.ts` (5 invariants):**
- Source file exists at `src/components/magic-ui/border-beam.tsx`
- Ships with `'use client'` directive
- `colorFrom` default contains coral rgba (`255, 127, 80`) and does NOT contain stock amber `#ffaa40`
- `colorTo` default does NOT contain stock violet `#9c40ff`
- Imports from `motion/react` (NOT `framer-motion`)

**`shine-border.test.ts` (5 invariants):**
- Source file exists at `src/components/magic-ui/shine-border.tsx`
- Ships with `'use client'` directive
- `shineColor` default contains coral rgba and is NOT stock black/`"#000000"`
- `shineColor` default is array-form (gradient arc, not single color)
- `@keyframes shine` is registered in `src/app/globals.css`

**`marketing-shell.test.ts` (6 invariants):**
- `src/app/(marketing)/page.tsx` has NO import from `@/components/landing`
- `src/app/(marketing)/page.tsx` renders `<main>` with `min-h-screen` + `bg-background`
- `src/app/(marketing)/page.tsx` contains no AS-plagiarized section names (HeroSection, BackersSection, FeaturesSection, StatsSection, CaseStudySection, PartnershipSection, FAQSection)
- Marketing layout metadata title is `"Virtuna"` (not `"Artificial Societies"`)
- Pricing page no longer imports FAQSection from `@/components/landing`
- `src/components/landing/` directory has been deleted

## Vitest Compatibility (confirmed)

Ran `vitest run src/components/magic-ui/__tests__/` against the existing config:
- **0 config errors** — vitest accepted all 4 files without complaint
- **All 4 test files detected** by the `include: ["src/**/*.test.ts"]` glob
- **21 tests executed** across the 4 files
- **Duration: 215ms** (well within the < 5s plan SLA)
- **No config changes required** — DOM/JSX tests would have required switching `environment` to `jsdom` + adding `@testing-library/react`; both deferred until needed

## RED Status (Wave 0 Contract — Expected)

All 21 tests fail today. This is the contract.

```
Test Files  4 failed (4)
Tests       21 failed (21)
Duration    215ms
```

Failure breakdown:
- **magic-card.test.ts:** 5 RED — `src/components/magic-ui/magic-card.tsx` does not exist (Plan 02 creates it)
- **border-beam.test.ts:** 5 RED — `src/components/magic-ui/border-beam.tsx` does not exist (Plan 02 creates it)
- **shine-border.test.ts:** 6 RED — `src/components/magic-ui/shine-border.tsx` + `@keyframes shine` in globals.css both missing (Plan 02 installs primitive, ensures keyframes injection)
- **marketing-shell.test.ts:** 5 RED — `src/app/(marketing)/page.tsx` still imports 7 AS sections; layout still says `"Artificial Societies | Human Behavior, Simulated"`; pricing page still imports from `@/components/landing`; `src/components/landing/` still exists (Plan 03 removes all of this)

After Plan 02 lands: 16 tests turn GREEN, 5 remain RED (marketing-shell).
After Plan 03 lands: All 21 tests turn GREEN.

## Decisions Made

| Decision | Outcome |
|----------|---------|
| `.test.ts` over `.test.tsx` (invariant: file content, not render) | Compatible with vitest node environment + existing include glob; no config change |
| `node:fs + node:path` over `@testing-library/react` | No new test infra; no `jsdom`; no DOM/component runtime required for these invariants |
| Commit tests RED, do NOT mark `.skip` or `.todo` | RED IS the Wave 0 contract per plan |
| Loose regex matches on rgba (`/255\s*,\s*127\s*,\s*80/`) | Tolerant to formatting variations (spaces around commas, opacity suffix) while still catching stock colors |
| Resolve paths via `__dirname` + relative segments | No build/config-time path resolution required; works in vitest node environment |

## Deviations from Plan

**None — plan executed exactly as written.** All 4 test files were created verbatim from the plan's `<action>` block.

The plan's verify command (`grep -E "Tests\s+[0-9]+ failed" /tmp/wave0.log`) did not match because vitest emits ANSI color escape codes around the count (`[1m[31m21 failed[39m[22m`). This is a cosmetic grep-pattern issue, not a real failure: the test files are detected, parsed, and ran (`Test Files 4 failed (4)` confirms this). The acceptance criteria are all satisfied via direct file-existence + import-count checks documented above.

## Threat Flags

None — test scaffolds only, no runtime exposure, no external input, no user-facing surface.

## Known Stubs

None.

## Authentication Gates

None encountered.

## Files Changed

| Path | Status |
|------|--------|
| `src/components/magic-ui/__tests__/magic-card.test.ts` | created |
| `src/components/magic-ui/__tests__/border-beam.test.ts` | created |
| `src/components/magic-ui/__tests__/shine-border.test.ts` | created |
| `src/components/magic-ui/__tests__/marketing-shell.test.ts` | created |

## Commits

| Hash | Message |
|------|---------|
| `375c33d` | `test(01-01): add Wave 0 invariant tests for Magic UI + marketing shell` |

## Verification Evidence

- **File existence:** All 4 files present in `git ls-files src/components/magic-ui/__tests__/`
- **Vitest accepts files:** `vitest run src/components/magic-ui/__tests__/` reports `Test Files 4 failed (4) / Tests 21 failed (21)` with **0 config errors**
- **Duration well under SLA:** 215ms total (plan budget: < 5s)
- **Grep audits:**
  - `grep -c "import.*vitest" src/components/magic-ui/__tests__/*.test.ts` → 1 per file = 4 total
  - `grep -l "@testing-library/react" src/components/magic-ui/__tests__/` → empty (correct)
  - `grep -lE "<MagicCard|<BorderBeam|<ShineBorder" src/components/magic-ui/__tests__/*.test.ts` → empty (correct)
- **No deletions in commit:** `git diff --diff-filter=D --name-only HEAD~1 HEAD` returns empty

## Wave 0 Validation Status

Wave 0 lock complete. The frontmatter checkbox `wave_0_complete: false` in `01-VALIDATION.md` can be flipped to `true` after Plan 02 + Plan 03 land and these 21 tests turn GREEN. Phase 01 final verification (Plan 05) re-runs `pnpm test` to confirm GREEN status.

## Self-Check: PASSED

- FOUND: `src/components/magic-ui/__tests__/magic-card.test.ts`
- FOUND: `src/components/magic-ui/__tests__/border-beam.test.ts`
- FOUND: `src/components/magic-ui/__tests__/shine-border.test.ts`
- FOUND: `src/components/magic-ui/__tests__/marketing-shell.test.ts`
- FOUND: commit `375c33d` (test(01-01): add Wave 0 invariant tests for Magic UI + marketing shell)
