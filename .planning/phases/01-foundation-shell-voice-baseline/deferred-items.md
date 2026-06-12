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
