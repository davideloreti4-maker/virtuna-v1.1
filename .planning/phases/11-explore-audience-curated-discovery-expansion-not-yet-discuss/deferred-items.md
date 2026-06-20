# Deferred Items — Phase 11

Out-of-scope discoveries logged during execution (SCOPE BOUNDARY rule). NOT fixed here —
none are caused by this phase's changes.

## Pre-existing TypeScript errors in test/fixture files (discovered Plan 11-05)

A full `npx tsc --noEmit` during Plan 11-05 surfaced type errors that exist ONLY in
`__tests__/`, `fixtures/`, and `.test.*` files — all UNRELATED to the Explore work
(none reference `use-explore-stream`, `outlier-tile`, `outlier-grid-block`, or
`discover-grid`). They predate this plan. Production `tsc` is clean across the touched
files; the affected-area Vitest suite is green (55/55).

Affected files (test-only):
- `src/app/api/tools/hooks/__tests__/route.test.ts` (TS2488 iterator)
- `src/components/app/home/__tests__/composer-navigate-guard.test.tsx` (TS2532)
- `src/components/board/verdict/__tests__/fixtures/prediction-result.ts` (TS2352 — missing `partial_analysis`)
- `src/components/layout/__tests__/header.test.tsx` (TS18048)
- `src/components/marketing/proof/__tests__/testimonials.test.tsx` (TS6133 unused `screen`)
- `src/lib/engine/__tests__/flop-warning.test.ts`, `stage10-critique.test.ts` (TS2353 `views` on EngagementRange)
- `src/lib/engine/flash/__tests__/flash-aggregate.test.ts`, `flash-schema.test.ts` (TS2352 / TS2322)
- `src/lib/engine/wave3/__tests__/fold-adapter.test.ts`, `fold-diversity-guard.test.ts` (TS2345 / TS2532)

Cause: engine/flash/board test fixtures drifted from their production types in earlier
milestones. They do not affect runtime or the production build. Recommend a dedicated
test-fixture-typing cleanup pass (not blocking Explore).

## Pre-existing repo-wide ESLint baseline (discovered Plan 11-08 Task 3)

A repo-wide `eslint .` during the Plan 11-08 BLOCKING gate reports **161 problems
(63 errors, 98 warnings)** across ~80 files — ALL pre-existing and UNRELATED to Explore.
The 63 errors live in files last touched by Phase 07 and earlier (spot-checked:
`src/app/api/audiences/route.ts` → 07-03; `src/components/board/__tests__/Board.test.tsx`
→ board redesign; `src/app/error.tsx` → phase-7). Rule mix: `@typescript-eslint/no-explicit-any`,
`@typescript-eslint/no-require-imports` (board `__tests__`), `react-hooks/*`
(exhaustive-deps / static-components / set-state-in-effect), `@next/next/no-html-link-for-pages`,
`@typescript-eslint/no-unused-vars`.

Scope decision (matches the 11-05 convention — "`npx eslint` on the [touched] files —
No issues found"): Plan 11-08 lints its OWN touched file only.
`eslint src/lib/tracked-accounts/tracked-accounts-repo.ts` → **EXIT 0, clean** (the dropped
`(supabase as any)` casts + their now-unused `eslint-disable` comments removed; no new
`no-explicit-any`). `npm run build` (`next build`) **succeeds** — these eslint findings do not
gate the production build in this project's config (`next.config.ts` sets no eslint/ts ignore
flags; the flat-config `eslint .` lint script is decoupled from `next build`).

The repo-wide eslint baseline is NOT fixed here (SCOPE BOUNDARY + explicit 11-08 task
instruction: pre-existing out-of-scope lint = note, don't fix). Recommend a dedicated
lint-cleanup pass alongside the test-fixture-typing pass above (neither blocks Explore).
