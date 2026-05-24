---
phase: 02-creator-profile-9-card-interview
plan: 01
subsystem: database

tags: [supabase, migration, postgres, vitest, playwright, scaffold]

requires:
  - phase: 01-training-corpus-eval-foundation
    provides: existing creator_profiles + user_competitors tables (foundation for Phase 2 column adds)

provides:
  - "creator_profiles table extended with 14 nullable columns for 9-card interview data"
  - "user_competitors.source CHECK column for distinguishing manual adds vs Card 5 reference creators"
  - "Legacy onboarding_step rows ('goal'|'preview') migrated to 'connect' for welcome-trim safety"
  - "Wave 0 vitest scaffolds for handle parser (passing) and creator merger extension (skipped)"
  - "Wave 0 Playwright scaffold for profile-interview e2e (skipped)"

affects: [02-02, 02-03, 02-04, 02-05, 02-06]

tech-stack:
  added: []
  patterns:
    - "Nullable column adds with ADD COLUMN IF NOT EXISTS for additive, idempotent migrations"
    - "Wave 0 scaffold pattern: test files exist with passing or skipped assertions before production code lands"

key-files:
  created:
    - supabase/migrations/20260517210000_creator_profile_9card_columns.sql
    - src/lib/__tests__/handle-parser.test.ts
    - e2e/profile-interview.spec.ts
  modified:
    - src/lib/engine/__tests__/creator.test.ts

key-decisions:
  - "All 14 new creator_profiles columns are nullable for graceful degradation when user skips interview (D-05)"
  - "user_competitors.source has CHECK constraint at schema layer for defense in depth (D-08)"
  - "Migration NOT pushed in this plan — push deferred to Plan 02-05 BLOCKING task once all migration content reviewed"
  - "RLS policies inherit automatically to new columns (D-17) — no new policies added"
  - "e2e/profile-interview.spec.ts lives at e2e/ root (not tests/e2e/) because e2e/playwright.config.ts uses testDir: '.'"

patterns-established:
  - "Migration shape: PROFILE-N traceability comment → header block → ALTER TABLE ADD COLUMN IF NOT EXISTS … → ALTER junction table → legacy UPDATE for narrowed unions"
  - "Wave 0 scaffolds use a mix of 2 active passing assertions (handle parser) + 3 it.skip placeholders (creator merger) + 3 test.skip placeholders (e2e) — green-first cycle for Nyquist"

requirements-completed:
  - PROFILE-01
  - PROFILE-13
  - PROFILE-15
  - INT-04

duration: 4min
completed: 2026-05-17
---

# Phase 02 Plan 01: Migration + Wave 0 Scaffolds Summary

**Additive Postgres migration adding 14 nullable creator_profiles columns + user_competitors.source CHECK + legacy onboarding_step remap, plus four Wave 0 test scaffolds satisfying the Nyquist green-first contract.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-17T19:55:29Z
- **Completed:** 2026-05-17T19:59:19Z
- **Tasks:** 2
- **Files changed:** 4 (1 created SQL, 2 created TS test files, 1 modified TS test file)

## Accomplishments

- Authored `supabase/migrations/20260517210000_creator_profile_9card_columns.sql` with the exact verbatim shape locked by D-15/D-16: 14 nullable columns on `creator_profiles`, 1 CHECK-constrained column on `user_competitors`, and a legacy UPDATE for `onboarding_step` IN ('goal', 'preview').
- Top-of-file PROFILE-16 traceability comment confirms the re-prompt micro-card is deferred to Phase 11 per D-14 (no counter column added here).
- Created `src/lib/__tests__/handle-parser.test.ts` with 2 active passing assertions on `normalizeHandle` (extracts handle from `https://tiktok.com/@charlidamelio`, strips `@` and lowercases `@AddisonRae`) + 1 `it.skip` placeholder for Plan 02-03.
- Extended `src/lib/engine/__tests__/creator.test.ts` with a new `describe("CreatorContext 9-card extension (Phase 2 Wave 0 scaffold)", ...)` block containing 3 `it.skip` placeholders for Plan 02-05 (flat-merge of 9-card columns, found:boolean semantics, formatCreatorContext null-guards).
- Created `e2e/profile-interview.spec.ts` with 3 `test.skip` scenarios (happy path, skip-all, settings edit) — file lives at `e2e/` root because `e2e/playwright.config.ts` uses `testDir: '.'`.
- Vitest run on both scaffolds is green: 12 passed + 4 skipped (16 total).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author Phase 2 schema migration** — `c77a5ac` (feat)
2. **Task 2: Create Wave 0 test scaffolds** — `1005a41` (test)

## Files Created/Modified

- `supabase/migrations/20260517210000_creator_profile_9card_columns.sql` — Phase 2 schema extension (14 creator_profiles columns + user_competitors.source + legacy step remap). NOT pushed to live DB; push is deferred to Plan 02-05.
- `src/lib/__tests__/handle-parser.test.ts` — Card 5 reference-creator handle normalization (2 passing + 1 skipped).
- `src/lib/engine/__tests__/creator.test.ts` — appended `describe("CreatorContext 9-card extension (Phase 2 Wave 0 scaffold)", ...)` block with 3 `it.skip` placeholders. Existing 10 tests untouched.
- `e2e/profile-interview.spec.ts` — Playwright spec scaffold with 3 `test.skip` scenarios for Plan 02-05/02-06.

## Decisions Made

- **Migration shape copied verbatim from plan spec.** The plan provided the SQL content explicitly; no interpretation needed. Column order matches D-16.
- **Resolved verify-block inconsistency.** The plan's `<verify>` block uses `grep -c '^ADD COLUMN IF NOT EXISTS'` (no indent) while the acceptance block uses `grep -c '^[[:space:]]*ADD COLUMN IF NOT EXISTS'` (with indent). The verbatim migration shape (modeled on `20260213000000_onboarding_columns.sql`) uses 2-space indentation. Acceptance criteria definition wins: 14 indented ADD COLUMN lines on creator_profiles + 1 on user_competitors = 15 total indented. The plan's `<verify>` regex is a documentation typo — the verbatim migration text it embeds explicitly indents the columns.
- **No taxonomy scaffold created in this plan.** Plan task 2 explicitly notes the niche taxonomy test scaffold (`src/lib/niches/__tests__/taxonomy.test.ts`) is OWNED BY 02-02 to prevent same-wave conflict. The "5 new files" mentioned in the `<verification>` block is a leftover from an earlier plan revision and is inconsistent with the task `<files>` list, which enumerates only 3.

## Deviations from Plan

None — plan executed exactly as written. The verify-block grep regex inconsistency and the "5 new files" line in the global verification block are pre-existing documentation typos in the plan, not deviations introduced during execution; the migration file content and the test scaffold contents match the verbatim specs in the plan body. The Task 2 `<acceptance_criteria>` enumerates only the 3 files this plan creates, and they are all present.

## Issues Encountered

- **`pnpm test` initially failed: "vitest: command not found"** — the worktree has no `node_modules`. Resolved by symlinking the main worktree's `node_modules` (`ln -s /Users/davideloreti/virtuna-v1.1/node_modules ./node_modules`). The symlink is not tracked by git (worktree-local artifact). Tests pass after the symlink: 12 passed + 4 skipped across both files.

## User Setup Required

None — no external service configuration required by this plan. The migration is NOT pushed to live Supabase in this plan; the `supabase db push` runs in Plan 02-05.

## Next Phase Readiness

- Plan 02-02 (niche taxonomy) can start in the same wave — it owns `src/lib/niches/__tests__/taxonomy.test.ts` and `src/lib/niches/taxonomy.ts`. No file conflicts with this plan.
- Plans 02-03, 02-04 can land their components and server actions referencing the new column names — names are exact per the `<interfaces>` block.
- Plan 02-05 will:
  - Push the migration (`supabase db push`) as its BLOCKING task.
  - Flip the 3 `it.skip` placeholders in `creator.test.ts` to active assertions.
  - Flip the 3 `test.skip` scenarios in `e2e/profile-interview.spec.ts` to active.

## Self-Check: PASSED

Verified all claims in this summary:

- `supabase/migrations/20260517210000_creator_profile_9card_columns.sql` — FOUND
- `src/lib/__tests__/handle-parser.test.ts` — FOUND
- `e2e/profile-interview.spec.ts` — FOUND
- `src/lib/engine/__tests__/creator.test.ts` contains "CreatorContext 9-card extension" — FOUND
- Commit `c77a5ac` — FOUND in git log
- Commit `1005a41` — FOUND in git log
- 14 indented `ADD COLUMN IF NOT EXISTS` lines on creator_profiles section + 1 on user_competitors = 15 total — VERIFIED
- `PROFILE-16` top-of-file comment — VERIFIED
- `pnpm test --run` against scaffolds returns exit 0 (12 passed + 4 skipped) — VERIFIED

---
*Phase: 02-creator-profile-9-card-interview*
*Completed: 2026-05-17*
