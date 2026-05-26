---
phase: 02-board-substrate-navigation
plan: 14
subsystem: database
tags: [supabase, postgresql, migrations, rls, typescript]

requires:
  - phase: 01-foundation
    provides: analysis_results table with user_id FK

provides:
  - projects table with RLS, seed, backfill
  - analysis_results.project_id nullable FK
  - TypeScript types for projects + project_id (pending Task 4)

affects:
  - future Workspace milestone (read via useProjects TanStack, write via Supabase client)
  - plan 2.5 sidebar (Projects section — Coming soon placeholder)

tech-stack:
  added: []
  patterns:
    - "Idempotent migration: IF NOT EXISTS + ON CONFLICT DO NOTHING + DROP POLICY IF EXISTS"
    - "Partial unique index for business-rule dedup (Pitfall 8 pattern)"
    - "RLS: TO authenticated + WITH CHECK (user_id = auth.uid()) on every mutation policy"

key-files:
  created:
    - supabase/migrations/20260526100000_add_projects.sql
  modified:
    - src/types/database.types.ts (pending Task 4 after checkpoint)

key-decisions:
  - "Timestamp 20260526100000 — strictly greater than latest 20260524000000"
  - "ON DELETE SET NULL on analysis_results.project_id — deleting project never deletes analyses"
  - "Partial unique index (user_id WHERE name=My Boards AND archived=FALSE) as Pitfall 8 mitigation"

patterns-established:
  - "Seed + backfill ordering: seed runs before backfill to guarantee no null project_id after migration"

requirements-completed: [R1.1]

duration: in-progress (paused at checkpoint Task 3)
completed: 2026-05-26
---

# Phase 02 Plan 14: projects schema migration (D-27)

**Idempotent projects table + RLS + My Boards seed/backfill migration, awaiting apply to Supabase (local/remote)**

## Performance

- **Duration:** in-progress
- **Started:** 2026-05-26
- **Completed:** paused at checkpoint Task 3
- **Tasks:** 2/4 complete (paused at checkpoint)
- **Files modified:** 1

## Accomplishments

- Pre-flight confirmed: `user_id` is canonical FK column on `analysis_results`; latest migration is `20260524000000`
- Migration file `20260526100000_add_projects.sql` written with full schema: `projects` table, partial unique index, 4 RLS policies, `analysis_results.project_id` FK, seed, backfill
- All SQL statements idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING, DROP POLICY IF EXISTS)
- Pitfall 8 mitigated: partial unique index prevents duplicate My Boards per user under concurrent seeds

## Task Commits

1. **Task 1: Pre-flight — confirm schema shape** - folded into Task 2 commit (read-only)
2. **Task 2: Write the projects migration SQL** - `df5d0f5` (feat)
3. **Task 3: Apply migration** - CHECKPOINT (awaiting human apply + verify)
4. **Task 4: Regenerate database.types.ts** - pending (after checkpoint)

## Files Created/Modified

- `supabase/migrations/20260526100000_add_projects.sql` — projects table + RLS + seed + backfill, idempotent

## Decisions Made

- Used timestamp `20260526100000` (2026-05-26 10:00 UTC), strictly greater than latest `20260524000000`
- ON DELETE SET NULL on `analysis_results.project_id` — project deletion never deletes analyses
- Partial unique index `(user_id) WHERE name='My Boards' AND archived=FALSE` as race-condition guard

## Deviations from Plan

None - plan executed exactly as written through Task 2.

## Issues Encountered

None through Task 2.

## Checkpoint: Task 3 — Apply Migration

**Status:** PAUSED — awaiting human verification

Migration `supabase/migrations/20260526100000_add_projects.sql` is written and committed. It must now be applied to at least one Supabase environment.

**Path A — local Supabase + CLI:**
```bash
supabase db reset
# OR
supabase migration up
```

**Path B — remote Supabase via MCP:**
Use `apply_migration` MCP tool with name `add_projects` and the SQL from `supabase/migrations/20260526100000_add_projects.sql`.

**Manual verification steps (Supabase Studio / psql):**
1. `public.projects` table exists with 6 columns (id, user_id, name, color, created_at, archived)
2. `public.analysis_results.project_id` column exists, uuid, nullable, FK to projects
3. At least one existing user with prior analyses has a `My Boards` project row
4. All `analysis_results` rows for that user have non-null `project_id` pointing at My Boards
5. Re-run migration — zero errors, zero duplicate My Boards rows:
   ```sql
   SELECT user_id, count(*) FROM projects WHERE name='My Boards' GROUP BY user_id HAVING count(*) > 1;
   ```
   Expected: 0 rows returned.

**Resume signal:** Reply "applied" with note on which environments were updated.

## Note for Future Workspace Milestone

- Read-side: `useProjects()` hook via TanStack Query querying `projects` table (RLS auto-filters)
- Write-side: direct Supabase client insert/update (RLS enforces ownership via `auth.uid()`)
- `analysis_results.project_id` FK already wired — no further migration needed for basic project attribution

## Note for Plan 2.5 Sidebar

The `Projects · Coming soon` placeholder ships unchanged. This plan enables the schema only. The sidebar UI wires up in a future Workspace milestone.

## Self-Check

- [x] `supabase/migrations/20260526100000_add_projects.sql` exists and committed (`df5d0f5`)
- [ ] `src/types/database.types.ts` — pending Task 4 (after checkpoint)
- [ ] Migration applied to Supabase — pending Task 3 checkpoint

**Self-Check: PARTIAL** — pre-checkpoint tasks complete, post-checkpoint tasks pending.
