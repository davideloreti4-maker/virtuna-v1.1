---
phase: 06-reshoot-script-optimal-post-time
plan: "03"
subsystem: api-route, optimal-post-override
tags: [api, zod, vitest, security, optimal-post, tdd]
dependency_graph:
  requires:
    - analysis_results.optimal_post_override JSONB column (Plan 01 Task 2)
  provides:
    - POST /api/analyze/[id]/optimal-post-override handler
    - Zod discriminated-union body schema (SET + CLEAR variants)
    - 9-case Vitest test matrix
  affects:
    - Plan 05 (Reset link uses CLEAR variant to write NULL per D-27)
tech_stack:
  added:
    - src/app/api/analyze/[id]/optimal-post-override/route.ts
    - src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts
  patterns:
    - Zod discriminated union (z.union([SetSchema, ClearSchema]))
    - Defense-in-depth: RLS + explicit .eq('user_id', user.id) on UPDATE
    - Params validation BEFORE auth (security improvement over /override/route.ts)
    - Generic error codes — no raw input echoed
key_files:
  created:
    - src/app/api/analyze/[id]/optimal-post-override/route.ts
    - src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts
  modified: []
decisions:
  - ParamsSchema validates id BEFORE createClient() call — matches /comparisons/route.ts pattern; improves on /override/route.ts which skipped Zod id validation (RESEARCH item 10)
  - CLEAR variant uses z.literal(true) so only boolean true passes; clear:false, clear:'true', clear:1 all rejected
  - SET variant payload includes saved_at: new Date().toISOString() for traceability
  - Non-null assertion (!  on captured[0]) needed in test file to satisfy TS2532 strictness
metrics:
  duration: "3m 1s"
  completed: "2026-05-28"
  tasks_completed: 2
  tasks_blocked: 0
  files_created: 2
  files_modified: 0
---

# Phase 6 Plan 03: POST /api/analyze/[id]/optimal-post-override

POST route accepting Zod-validated SET/CLEAR body, writing JSONB or NULL to `analysis_results.optimal_post_override` with defense-in-depth user_id filter and 9 passing Vitest cases.

## Tasks Completed

| Task | Status | Commit | Files |
|------|--------|--------|-------|
| Task 1: POST route (feat) | DONE | 179812f | src/app/api/analyze/[id]/optimal-post-override/route.ts |
| Task 2: 9-case test matrix (test) | DONE | df58ba9 | src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts |
| Fix: non-null TS assertions in tests | DONE | 5318c14 | __tests__/route.test.ts |

## Security Confirmations (STRIDE T-06-14 to T-06-20)

**T-06-15 — ParamsSchema validates BEFORE auth check:**
`ParamsSchema.safeParse(resolvedParams)` runs before `createClient()`. Bonus test proves `createClient` is NOT called when id is invalid.

**T-06-16b — Discriminated-union body schema (SET + CLEAR):**
`z.union([SetSchema, ClearSchema])` compiles and both branches are reachable per tests 4 (SET) and 7 (CLEAR). `z.literal(true)` accepts only the boolean primitive — test 8 verifies `{ clear: false }` is rejected with 400.

**D-27 CLEAR variant writes SQL NULL:**
Test 7 captures the UPDATE payload via `_capturedUpdates` and asserts `optimal_post_override === null`. This is the API surface used by Plan 05's Reset link — clears the override and restores engine recommendation (D-29 source pill stays accurate).

**T-06-18/T-06-19 — Error responses never echo raw input:**
Test 6 (XSS guard) posts `{ day_of_week: '<script>alert(1)</script>' }` and verifies the response body contains no `<script>` or `alert(1)`. Zod enum constrains to 7 literal day strings — malicious string cannot reach the DB.

**T-06-17 — Defense-in-depth UPDATE filter:**
`.eq('id', id).eq('user_id', user.id)` plus existing RLS UPDATE policy. Both must pass; failure of either yields 0 rows affected.

## Test Matrix Results

```
Test Files  1 passed (1)
Tests       9 passed (9)
```

| Test | Scenario | Status |
|------|----------|--------|
| 1 | Invalid day_of_week → 400 invalid_override | PASS |
| 2 | hour_range end <= start → 400 invalid_override | PASS |
| 3 | No auth user → 401 unauthorized | PASS |
| 4 | SET variant → 200 + JSONB payload captured | PASS |
| 5 | Supabase UPDATE error → 500 override_write_failed | PASS |
| 6 | XSS guard — response never echoes raw input | PASS |
| 7 | CLEAR variant → 200 + null payload captured (D-27) | PASS |
| 8 | CLEAR rejection: { clear: false } → 400 invalid_override | PASS |
| bonus | Invalid id → 400 invalid_id, createClient NOT called | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2532 Object possibly undefined in test file**
- **Found during:** Task 2 final tsc check
- **Issue:** `captured[0].optimal_post_override` on array index access fails strict TS (TS2532: Object is possibly 'undefined')
- **Fix:** Added non-null assertion `captured[0]!.optimal_post_override` on lines 87 and 131 of test file
- **Files modified:** src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts
- **Commit:** 5318c14

## Known Stubs

None. Both files are complete functional implementations.

## Threat Flags

None. All routes and patterns are within the plan's threat model scope (T-06-14 through T-06-20 all mitigated).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| route.ts exists on disk | PASS |
| __tests__/route.test.ts exists on disk | PASS |
| Commit 179812f in git log | PASS |
| Commit df58ba9 in git log | PASS |
| Commit 5318c14 in git log | PASS |
| 9 vitest tests pass | PASS |
| 0 TypeScript errors in Phase 6 files | PASS |
| No modifications to STATE.md or ROADMAP.md | PASS |
| No modifications outside files_modified list | PASS |
