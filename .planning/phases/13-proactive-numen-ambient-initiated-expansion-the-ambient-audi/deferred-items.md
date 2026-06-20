# Phase 13 — Deferred / Out-of-Scope Items

Out-of-scope discoveries logged during execution (NOT fixed — pre-existing or outside task scope).

## Plan 13-01 (2026-06-20)

- **Pre-existing tsc errors in runner test files (NOT introduced by 13-01, NOT fixed):**
  - `src/lib/tools/runners/__tests__/ideas-runner.test.ts(144,9)` + `(426,12)`
  - `src/lib/tools/runners/__tests__/hooks-runner.test.ts(141,9)` + `(173,166)` + `(577,12)`
  - Cause: test fixtures pass a `user_id` field on `ProfileRow` (the interface has no `user_id`) + an index access TS narrows to possibly-undefined. Last touched in commit `e3f82e94` (Phase 14-02), predating this plan. Tests PASS at runtime (vitest); only `tsc --noEmit` flags them. Falls under STATE.md's documented "46 pre-existing tsc errors" baseline. Out of scope per the executor scope boundary (only auto-fix issues DIRECTLY caused by this task's changes).
