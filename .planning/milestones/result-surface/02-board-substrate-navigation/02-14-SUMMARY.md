---
phase: 02-board-substrate-navigation
plan: 14
subsystem: database
tags: [supabase, postgresql, migrations, rls, typescript]

requires:
  - phase: 01-foundation
    provides: analysis_results table with user_id FK

provides:
  - projects table with RLS, seed, backfill (applied remote)
  - analysis_results.project_id nullable FK (ON DELETE SET NULL)
  - TypeScript types for projects + analysis_results.project_id

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
    - src/types/database.types.ts

key-decisions:
  - "Timestamp 20260526100000 — strictly greater than latest 20260524000000"
  - "ON DELETE SET NULL on analysis_results.project_id — deleting project never deletes analyses"
  - "Partial unique index (user_id WHERE name=My Boards AND archived=FALSE) as Pitfall 8 mitigation"
  - "Hand-maintained types file — manually added projects block + project_id fields (no CLI generator wired)"

patterns-established:
  - "Seed + backfill ordering: seed runs before backfill to guarantee no null project_id after migration"

requirements-completed: [R1.1]

duration: 35min
completed: 2026-05-26
---

# Phase 02 Plan 14: projects schema migration (D-27)

**Idempotent projects table + RLS + My Boards seed/backfill migration applied remotely, TypeScript types updated**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-26
- **Completed:** 2026-05-26
- **Tasks:** 4/4 complete
- **Files modified:** 2

## Accomplishments

- Pre-flight confirmed: `user_id` canonical FK on `analysis_results`; latest migration `20260524000000`
- Migration `20260526100000_add_projects.sql` written with full idempotent schema: `projects` table, partial unique index (Pitfall 8), 4 RLS policies, `analysis_results.project_id` FK, seed, backfill
- Migration applied remotely via Supabase MCP — all 5 verification checks passed (table exists, column exists, zero duplicates, backfill clean)
- `src/types/database.types.ts` manually updated: `projects` Row/Insert/Update/Relationships block added; `project_id` added to `analysis_results` Row/Insert/Update + FK relationship entry
- `tsc --noEmit` passes with zero errors from these changes (2 pre-existing test file errors logged as deferred)

## Task Commits

1. **Task 1: Pre-flight — confirm schema shape** - folded into Task 2 (read-only)
2. **Task 2: Write the projects migration SQL** - `df5d0f5` (feat)
3. **Task 3: Apply migration (human-verify checkpoint)** - applied remotely via Supabase MCP
4. **Task 4: Regenerate database.types.ts** - `5399763` (feat)

## Files Created/Modified

- `supabase/migrations/20260526100000_add_projects.sql` — projects table + RLS + seed + backfill, idempotent
- `src/types/database.types.ts` — added projects table type block + project_id to analysis_results

## Decisions Made

- Timestamp `20260526100000` (2026-05-26 10:00 UTC) — strictly greater than latest `20260524000000`
- ON DELETE SET NULL on `analysis_results.project_id` — project deletion never deletes analyses
- Partial unique index `(user_id) WHERE name='My Boards' AND archived=FALSE` — race-condition guard (Pitfall 8)
- Manual type update (no generator wired) — added projects block alphabetically between `platt_parameters` and `referral_clicks`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Two pre-existing TypeScript errors in test files (`Board.test.tsx` TS2347, `use-camera.test.ts` TS6133) — not caused by this plan's changes, logged as deferred.

## Note for Future Workspace Milestone

- Read-side: `useProjects()` hook via TanStack Query querying `projects` table (RLS auto-filters to `auth.uid()`)
- Write-side: direct Supabase client insert/update (RLS enforces ownership)
- `analysis_results.project_id` FK already wired — no further migration needed for basic project attribution
- Type: `Database['public']['Tables']['projects']['Row']` resolves; `analysis_results.Row.project_id` is `string | null`

## Note for Plan 2.5 Sidebar

The `Projects · Coming soon` placeholder ships unchanged. This plan enables the schema only. Sidebar wiring is a future Workspace milestone deliverable.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. Schema changes are within the existing Supabase trust boundary. RLS policies fully cover all STRIDE threats per threat_model (T-02-14-01 through T-02-14-04).

## Self-Check

- [x] `supabase/migrations/20260526100000_add_projects.sql` exists — `df5d0f5`
- [x] `src/types/database.types.ts` has `projects:` entry (1 match confirmed)
- [x] `src/types/database.types.ts` has `project_id` entries (5 matches confirmed)
- [x] Migration applied remotely — verified by human (all 5 checks passed)
- [x] `tsc --noEmit` — 0 errors from these changes

**Self-Check: PASSED**
