# Deferred Items — Phase 01 Foundation

Out-of-scope discoveries logged during plan execution. Each entry includes
the plan that found it + the root cause + suggested fix.

## D-01-DEF-01: `@google/genai` package missing from `node_modules`

- **Discovered:** Plan 01-02 execution, verification phase
- **Root cause:** `src/lib/engine/gemini/schemas.ts:18` imports `@google/genai`,
  but the package is NOT listed in `package.json` dependencies (or the parent
  worktree's `node_modules` does not provide it).
- **Impact:**
  - `tsc --noEmit` reports 2 baseline errors (this file + `scripts/backfill-trending-sound-embeddings.ts`).
  - 8 test files transitively fail to load (`route.test.ts`, `wave3.test.ts`,
    `wave3-cost-budget.test.ts`, `wave4/platform-fit.test.ts`,
    `stage10-critique.test.ts`, `aggregator-phase10.test.ts`,
    `aggregator-platform-fit.test.ts`, `corpus/eval-harness.test.ts`).
- **Workaround (per-test):** Mock `@google/genai` at the top of test files that
  reach `types.ts → gemini/schemas.ts` (see Plan 01-02 T3
  `route-started-event.test.ts` for the pattern).
- **Suggested fix:** Install the package via `pnpm add @google/genai` from the
  main worktree at `~/virtuna-v1.1/`. Out of scope for Phase 01 because no
  plan in this phase consumes the `Type` enum at runtime; the dev environment
  apparently dropped the package without a corresponding `package.json` patch.
