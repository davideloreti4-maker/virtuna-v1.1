---
phase: 06-reshoot-script-optimal-post-time
plan: "01"
subsystem: database-migrations, utilities, types, constants
tags: [migrations, supabase, typescript, vitest, tdd, script, optimal-post]
dependency_graph:
  requires: []
  provides:
    - analysis_results.script_result JSONB column (migration, pending DB push)
    - analysis_results.optimal_post_override JSONB column (migration, pending DB push)
    - formatTime(ms) pure function
    - stripMarkdown(text) pure function
    - convertUTCWindow(day, hourRange, userTz) TZ converter
    - ScriptResult discriminated union type
    - SCRIPT_COPY constants (verbatim from 06-UI-SPEC.md)
    - OPTIMAL_POST_COPY + DAY_LABELS + DayOfWeek type
    - TELEMETRY extended with 8 Phase 6 events
  affects:
    - Plans 02-06 (all consume types/utils/constants from this plan)
tech_stack:
  added:
    - src/lib/script-utils.ts (pure formatTime + stripMarkdown)
    - src/lib/optimal-post-time.ts (Intl.DateTimeFormat-backed UTC converter)
    - src/components/board/actions/script/ (new directory)
    - src/components/board/actions/optimal-post/ (new directory)
  patterns:
    - TDD RED-GREEN cycle (vitest)
    - Additive JSONB migration pattern (idempotent ADD COLUMN IF NOT EXISTS)
    - Pure utility modules (no app-layer imports, no side effects)
    - Discriminated union types for API response shapes
key_files:
  created:
    - supabase/migrations/20260530000000_script_result.sql
    - supabase/migrations/20260530000001_optimal_post_override.sql
    - src/lib/script-utils.ts
    - src/lib/script-utils.test.ts
    - src/lib/optimal-post-time.ts
    - src/lib/optimal-post-time.test.ts
    - src/components/board/actions/script/script-types.ts
    - src/components/board/actions/script/script-constants.ts
    - src/components/board/actions/optimal-post/optimal-post-constants.ts
  modified:
    - src/components/board/actions/actions-constants.ts (TELEMETRY extended)
decisions:
  - AM/PM boundary test: changed test input from UTC 11-13 to UTC 16-18 for America/New_York. UTC 11-13 EST = 6-8 AM (both AM, no crossing). UTC 16-18 EST = 11 AM - 1 PM (crosses noon). Fix was to test expectation per plan guidance.
  - Europe/London DST: reference date 2024-01-01 falls in winter (GMT = UTC+0), so UTC 18-21 = GMT 18-21 (same day, no crossing). Test asserts day=Tue and crossedMidnight=false only (dropped hour-range regex per plan DST note).
  - Supabase DB push: BLOCKED - see Blocking Items section below.
metrics:
  duration: "7m 16s"
  completed: "2026-05-28"
  tasks_completed: 3
  tasks_blocked: 1
  files_created: 9
  files_modified: 1
---

# Phase 6 Plan 01: Foundations — Migrations, Utils, Types, Constants

Schema + pure utilities + type contracts that Plans 02–06 build against. Two additive JSONB migrations, three utility modules, four type/constant files, one extended TELEMETRY enum.

## Tasks Completed

| Task | Status | Commit |
|------|--------|--------|
| Task 1: Two Supabase migrations | DONE | 2b48ae5 |
| Task 2: Push migrations to live DB | BLOCKED (checkpoint) | — |
| Task 3: Utility modules (RED) | DONE | 0be26f0 |
| Task 3: Utility modules (GREEN) | DONE | c0edbce |
| Task 4: Types + constants + TELEMETRY | DONE | 1086fe4 |

## Blocking Items

### Task 2: Supabase DB Push Required

The two migration files are committed to the repo. The live Supabase DB does NOT yet have the new columns. This is a human-action gate.

**What to do:**
1. Set `SUPABASE_DB_PASSWORD` environment variable (or run `supabase login` for token-based auth)
2. Run: `supabase db push` from the repo root
3. Confirm both migrations applied: `20260530000000_script_result` and `20260530000001_optimal_post_override`
4. Verify: `select column_name, data_type from information_schema.columns where table_name = 'analysis_results' and column_name in ('script_result', 'optimal_post_override');` returns 2 rows

**Why blocked:** `SUPABASE_DB_PASSWORD` not set in environment. `supabase link` succeeded but `supabase db push --linked` requires the DB password to create a login role.

**Impact on downstream plans:** Plans 02–06 can still build and type-check (types come from TypeScript, not the live DB). But runtime functionality requires the columns to exist. Plans that write to `script_result` or `optimal_post_override` will fail at runtime until the push is done.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AM/PM boundary test expectation**
- **Found during:** Task 3 GREEN phase
- **Issue:** Test `handles AM/PM boundary span (UTC 11-13 in US/Eastern)` expected `/AM.*PM/i` but UTC 11-13 in EST (UTC-5) = 6-8 AM (both AM, no noon crossing)
- **Fix:** Changed test input to `UTC 16-18 → EST = 11 AM – 1 PM` (correctly crosses noon). Per plan guidance: "Fix the test, not the function"
- **Files modified:** src/lib/optimal-post-time.test.ts
- **Commit:** c0edbce

### Design Decisions

**2. Europe/London test simplified**
- **Found during:** Task 3 planning + plan note
- **Reason:** Reference date 2024-01-01 = winter (GMT = UTC+0), so UTC 18-21 → GMT 18-21 (same hours, no conversion). BST wouldn't apply until March
- **Action:** Test asserts `day === 'Tue'` and `crossedMidnight === false` only. Dropped hour-range regex per plan DST note
- **Files modified:** src/lib/optimal-post-time.test.ts

## Verification Results

```
Test Files  2 passed (2)
Tests       14 passed (14)
```

All 14 tests pass:
- formatTime: 5 cases (8s, 72s, 0, fractional seconds, negative clamping)
- stripMarkdown: 4 cases (bold+backtick, underline, trim edges, plain prose)
- convertUTCWindow: 5 cases (PST/Tue, JST/Wed midnight-crossing, GMT/Tue winter, AM-PM span, hour-range 24 edge)

TypeScript: zero errors in Phase 6 files (pre-existing errors in react-konva/detect-gpu stubs are unrelated).

## DB Migration Status

| Migration | File | DB Applied |
|-----------|------|------------|
| `20260530000000_script_result` | committed | PENDING (needs `supabase db push`) |
| `20260530000001_optimal_post_override` | committed | PENDING (needs `supabase db push`) |

No RLS policy changes in either migration. Both inherit existing `"Users can update their own analysis results"` policy.

## Known Stubs

None. All files contain complete, functional implementations.

## Self-Check: PASSED

All 10 created/modified files verified on disk. All 4 task commits verified in git log.

| Item | Status |
|------|--------|
| 10 files on disk | PASS |
| 4 commits in log | PASS |
| 14 vitest tests pass | PASS |
| 0 TypeScript errors in Phase 6 files | PASS |
| TELEMETRY count = 10 (2+8) | PASS |
| No RLS policies in migrations | PASS |
