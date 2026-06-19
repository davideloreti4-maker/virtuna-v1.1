# Deferred Items — Phase 14

Out-of-scope discoveries logged during execution (NOT fixed — pre-existing, unrelated to the task's changes).

## From 14-01 (2026-06-20)

- **Pre-existing `tsc --noEmit` errors (46 errors in 19 files).** All in files NOT touched by 14-01.
  Cross-checked: zero overlap between the tsc-error file set and 14-01's changed files. Dominant codes:
  TS2532 (object possibly undefined — mostly in `__tests__/*.test.ts`), TS2353 (`user_id` not on `ProfileRow`
  in runner test fixtures), TS2352/TS2345/TS6133. These predate this plan and are an app-wide test-fixture
  typing debt. `vitest run` passes (1318 tests green) because vitest transpiles tolerantly. The plan's own
  files (`niche-resolver.ts`, `persona-registry.ts`, `flash-aggregate.ts`, both runners, both new test files)
  compile clean under tsc and lint clean under eslint.
- **Pre-existing `npm run lint` warnings/errors across ~80+ unrelated files** (e.g. `competitor-table.tsx`,
  `composer.tsx`, `society-selector.tsx`, `reading.tsx` — react-hooks/*, no-explicit-any, no-unused-vars).
  `npx eslint` on the 7 files this plan touched: "No issues found". Out of scope.
