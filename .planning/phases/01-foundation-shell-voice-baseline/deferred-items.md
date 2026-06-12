# Phase 01 — Deferred Items (out-of-scope discoveries)

Logged during execution per SCOPE BOUNDARY. NOT fixed — unrelated to the current plan's changes.

## Plan 01-01

### Pre-existing repo-wide lint failures (58 errors, 68 warnings)

- **Found during:** Plan 01-01 Task 1 verification (`pnpm run lint`).
- **Scope:** Errors live entirely in unrelated engine/store/schema files (e.g.
  `src/lib/engine/corpus/*`, `src/lib/engine/retrieval/*`, `src/lib/schemas/*`,
  `src/stores/__tests__/*`). The changed file `src/app/layout.tsx` lints CLEAN
  (eslint exit 0, zero output).
- **Why deferred:** Out of scope for this plan — not caused by the metadata edit.
  The plan's `npm run lint` gate maps to a bare `eslint` repo-wide run.
- **Tooling note:** `eslint@^9` is declared in `package.json` but was NOT installed
  in `node_modules` at execution start (project uses pnpm; `pnpm-lock.yaml` present).
  Restored declared deps via `pnpm install --frozen-lockfile` (deterministic, no new
  package introduced) so the lint gate could run at all.
- **Suggested owner:** Phase 4 polish (alongside the orphaned stale-component cleanup
  already deferred there), or a dedicated lint-debt pass.

## Plan 01-02

### Pre-existing repo-wide `tsc --noEmit` failures (14 errors, 8 files)

- **Found during:** Plan 01-02 Task 1 verification (`npx tsc --noEmit`).
- **Scope:** Errors live entirely in unrelated engine/board/numen TEST + fixture files
  (`src/components/board/verdict/__tests__/fixtures/prediction-result.ts`,
  `src/lib/engine/__tests__/*`, `src/lib/engine/wave3/__tests__/*`,
  `tests/numen/stage-reveal.test.ts`, `tests/numen/tokens.test.ts`). The new shell
  files under `src/components/numen-landing/` are type-clean (`tsc --noEmit | grep
  numen-landing` → none; per-file `eslint` exit 0).
- **Why deferred:** Out of scope — not caused by the new shell components; the files
  were untracked, so these errors pre-exist on HEAD. The plan's `npx tsc --noEmit`
  gate is whole-project and cannot reach exit 0 until this engine/test debt is cleared.
  Each new shell file is verified type+lint clean in isolation instead.
- **Error codes:** TS2352 (1), TS2353 (2), TS2345 (5), TS2532 (5), TS2769 (1).
- **Suggested owner:** engine/test-debt pass or Phase 4 polish.

## Plan 01-03

### Pre-existing hype string in a dev/showcase route (`board-preview/page.tsx`)

- **Found during:** Plan 01-03 Task 3 route-wide anti-snake-oil grep
  (`grep -riE "...|virality" "src/app/(marketing)"`).
- **Match:** `src/app/(marketing)/board-preview/page.tsx:281` — `label="Virality score"`.
- **Scope:** `board-preview/` is a pre-existing dev/showcase route (last touched by
  unrelated commit `a6add456` "fix(board): soften preview…", NOT this plan). The
  `(marketing)` route group also holds other dev/test routes — `showcase/`,
  `primitives-showcase/`, `viral-score-test/`, `viz-test/`, `coming-soon/`,
  `pricing/`. Per the plan `<interfaces>` note + D-04 these dev/showcase routes are
  explicitly UNTOUCHED by this phase; only the root marketing `layout.tsx`/`page.tsx`/
  `opengraph-image.tsx` are in scope.
- **Why deferred:** Out of scope — not customer-facing landing copy, not introduced
  by this plan, and the plan's per-task gate only requires the OG image to be
  hype-free (which it is). The route-wide grep in `<verification>` is broader than
  the plan's stated scope (dev/showcase untouched) and surfaces this pre-existing
  dev-label leak. The three in-scope files are verified hype-free.
- **Suggested owner:** Phase 4 polish (alongside the stale-component cleanup), or a
  dedicated dev/showcase de-hype pass once those routes are reviewed for retention.
