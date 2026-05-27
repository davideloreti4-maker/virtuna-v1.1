---
phase: 03
plan: 01
subsystem: engine/test-scaffolding
tags: [phase-3, wave-0, test-scaffolding, vitest, tdd]
dependency_graph:
  requires: []
  provides:
    - src/lib/engine/__tests__/pass2.test.ts
    - src/lib/engine/__tests__/weighted-aggregator.test.ts
    - src/lib/engine/__tests__/filmstrip.test.ts
    - src/lib/engine/__tests__/persona-weights.test.ts
    - src/lib/engine/__tests__/anti-virality.test.ts (extended)
    - src/lib/engine/wave3/pass2.ts (stub)
    - src/lib/engine/wave3/weighted-aggregator.ts (stub)
    - src/lib/engine/persona-weights.ts (stub)
  affects:
    - Plans 04, 05, 06, 07 (implementation plans flip it.skip to live assertions)
tech_stack:
  added: []
  patterns:
    - Vitest it.skip/describe.todo stubs for pre-implementation test surface locking
    - Stub source files (throw Not Implemented) to satisfy ESM import resolution without mocks
key_files:
  created:
    - src/lib/engine/__tests__/pass2.test.ts
    - src/lib/engine/__tests__/weighted-aggregator.test.ts
    - src/lib/engine/__tests__/filmstrip.test.ts
    - src/lib/engine/__tests__/persona-weights.test.ts
    - src/lib/engine/wave3/pass2.ts
    - src/lib/engine/wave3/weighted-aggregator.ts
    - src/lib/engine/persona-weights.ts
  modified:
    - src/lib/engine/__tests__/anti-virality.test.ts
decisions:
  - "Stub source files (not vi.mock) to resolve ESM imports: vi.mock hoisting does not prevent resolution failure for completely missing modules in Vitest v4 ESM mode. Created minimal throw-Not-Implemented stub files so imports resolve at runtime."
  - "Filmstrip test uses vi.mock for ffmpeg-static/child_process/supabase as those are infrastructure deps not stubs for our own code."
metrics:
  duration: "~10 minutes"
  completed: "2026-05-27"
  tasks_completed: 1
  files_created: 7
  files_modified: 1
---

# Phase 3 Plan 01: Wave 0 Vitest Test Scaffolds Summary

**One-liner:** 5 Vitest stub files (4 new + 1 extended) lock the Phase 3 test surface before implementation — 50 `it.skip` blocks targeting Pass 2, weighted aggregator, filmstrip pipeline, persona weights, and dual-trigger anti-virality.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create 4 new Vitest stub files + extend anti-virality.test.ts | 6045a69 | 7 created, 1 modified |

## Verification Results

```
pnpm vitest run src/lib/engine/__tests__/pass2.test.ts \
  src/lib/engine/__tests__/weighted-aggregator.test.ts \
  src/lib/engine/__tests__/filmstrip.test.ts \
  src/lib/engine/__tests__/persona-weights.test.ts \
  src/lib/engine/__tests__/anti-virality.test.ts --reporter=dot

Test Files: 1 passed | 4 skipped (5)
Tests: 5 passed | 50 skipped (55)
Exit code: 0
```

## it.skip Block Counts

| File | it.skip count | Target plan |
|------|--------------|-------------|
| pass2.test.ts | 12 | Plan 06 |
| weighted-aggregator.test.ts | 9 | Plan 04 |
| filmstrip.test.ts | 11 | Plan 07 |
| persona-weights.test.ts | 8 | Plan 04 |
| anti-virality.test.ts (new blocks) | 10 | Plan 05 |
| **Total new stubs** | **50** | |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESM import resolution fails for completely missing modules even with vi.mock**
- **Found during:** Task 1 verification
- **Issue:** Vitest v4 ESM mode resolves static import paths on disk before vi.mock hoisting takes effect. Files in `src/lib/engine/wave3/pass2.ts`, `wave3/weighted-aggregator.ts`, and `persona-weights.ts` did not exist, causing `Cannot find module` errors.
- **Fix:** Created minimal stub source files with `throw new Error("not yet implemented — see Plan XX")` so the import path resolves. The `@ts-expect-error` comment on the import line is preserved per plan spec (still accurate: the stub's types don't match the final implementation types).
- **Files modified:** `src/lib/engine/wave3/pass2.ts`, `src/lib/engine/wave3/weighted-aggregator.ts`, `src/lib/engine/persona-weights.ts` (all created as part of this fix)
- **Commit:** 6045a69

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/lib/engine/wave3/pass2.ts | throws Not Implemented | Placeholder for Plan 06 — full Pass 2 orchestrator |
| src/lib/engine/wave3/weighted-aggregator.ts | throws Not Implemented | Placeholder for Plan 04 — weighted curve math |
| src/lib/engine/persona-weights.ts | throws Not Implemented | Placeholder for Plan 04 — weight precedence resolver |

These stubs are intentional. Plans 04, 05, 06, 07 replace them with live implementations.

## Threat Flags

None — test files and import-resolution stubs introduce no new network endpoints, auth paths, or trust boundaries.

## Self-Check: PASSED

Files exist:
- [x] src/lib/engine/__tests__/pass2.test.ts
- [x] src/lib/engine/__tests__/weighted-aggregator.test.ts
- [x] src/lib/engine/__tests__/filmstrip.test.ts
- [x] src/lib/engine/__tests__/persona-weights.test.ts
- [x] src/lib/engine/__tests__/anti-virality.test.ts
- [x] src/lib/engine/wave3/pass2.ts
- [x] src/lib/engine/wave3/weighted-aggregator.ts
- [x] src/lib/engine/persona-weights.ts

Commits exist:
- [x] 6045a69 — feat(03-01): Wave 0 test scaffolds
