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
