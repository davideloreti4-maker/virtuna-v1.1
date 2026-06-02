---
phase: 05-develop-predict-lineage
plan: "01"
subsystem: lineage-schema
tags: [migration, schema, types, route-threading]
dependency_graph:
  requires: []
  provides: [analysis_results.parent_id, AnalysisInputSchema.parent_id, AnalysisStreamInput.parent_id, database.types.ts.parent_id]
  affects: [src/app/api/analyze/route.ts, src/types/database.types.ts, src/lib/engine/types.ts, src/hooks/queries/use-analysis-stream.ts]
tech_stack:
  added: []
  patterns: [nullable-FK-with-on-delete-set-null, zod-optional-field, hand-edit-types-from-live-schema]
key_files:
  created:
    - supabase/migrations/20260602000000_add_parent_id_to_analysis_results.sql
  modified:
    - src/lib/engine/types.ts
    - src/hooks/queries/use-analysis-stream.ts
    - src/types/database.types.ts
    - src/app/api/analyze/route.ts
decisions:
  - "FK uses ON DELETE SET NULL so deleting a source row does not orphan-error the child (D-08)"
  - "Safety-net UPDATE (Site 5) not given parent_id: SQL UPDATE only writes listed columns, preserving the FK set by the placeholder INSERT (T-05-11)"
  - "buildInsertRow carries parent_id covering both JSON INSERT and SSE UPSERT via spread — only 2 literal edits needed for 4 write paths"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-02T10:53:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 05 Plan 01: parent_id Lineage Schema Foundation Summary

**One-liner:** Nullable FK `parent_id` column added to `analysis_results` live DB, type system extended in Zod + client interface + database.types.ts, and threaded at the two literal route write sites covering all four insert paths.

## What Was Built

Lineage data foundation for Develop & Predict (D-07/D-08):

1. **Migration file** `20260602000000_add_parent_id_to_analysis_results.sql` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS parent_id TEXT NULL REFERENCES public.analysis_results(id) ON DELETE SET NULL` + `COMMENT ON COLUMN`.

2. **Zod schema extension** `src/lib/engine/types.ts` — `parent_id: z.string().optional()` added to `AnalysisInputSchema` after the `mode` field. Zero new `.refine()` calls (still exactly 2).

3. **Client interface extension** `src/hooks/queries/use-analysis-stream.ts` — `parent_id?: string` added to `AnalysisStreamInput` after `mode?`.

4. **[BLOCKING] Live DB push** — migration applied to Supabase project `virtuna-v1.1` (qyxvxleheckijapurisj). Human-applied and verified.

5. **Types regeneration** `src/types/database.types.ts` — `parent_id` added to all three `analysis_results` blocks: `Row: parent_id: string | null`, `Insert: parent_id?: string | null`, `Update: parent_id?: string | null`.

6. **Route threading** `src/app/api/analyze/route.ts` — `parent_id: validated.parent_id ?? null` at two literal write sites:
   - Site 1: inside `buildInsertRow()` (~534) — covers JSON INSERT (~632) and SSE UPSERT (~842) via spread
   - Site 3: inside SSE-branch placeholder INSERT (~700)
   - Site 5 safety-net UPDATE deliberately NOT given `parent_id` — SQL UPDATE only writes listed columns; preserves the FK set by the placeholder INSERT (T-05-11/SC#2)

## Live DB Verification (Task 2 Proof)

Migration applied to Supabase project `qyxvxleheckijapurisj` (virtuna-v1.1).

**information_schema.columns result:**
```
column_name | data_type | is_nullable
------------+-----------+------------
parent_id   | text      | YES
```

**pg_constraint result:**
```
conname                              | confdeltype
-------------------------------------+------------
analysis_results_parent_id_fkey     | n  (ON DELETE SET NULL)
```

Column confirmed live. FK integrity enforced at DB level.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `8d8afffa` | Write parent_id migration + extend Zod and client input schemas |
| Task 2 | N/A (human-applied) | Applied migration to live Supabase DB |
| Task 3 | `3295c989` | Regenerate database.types.ts + thread parent_id at two literal write sites |

## Acceptance Criteria Verification

- [x] Migration file exists with `ADD COLUMN IF NOT EXISTS parent_id`, `REFERENCES public.analysis_results(id) ON DELETE SET NULL`, and `COMMENT ON COLUMN`
- [x] `grep parent_id src/lib/engine/types.ts` — present as `z.string().optional()` inside AnalysisInputSchema
- [x] `grep parent_id src/hooks/queries/use-analysis-stream.ts` — present as `parent_id?: string` inside AnalysisStreamInput
- [x] No new `.refine()` added — still exactly 2 `.refine(` calls on AnalysisInputSchema
- [x] `database.types.ts` Row block: `parent_id: string | null`; Insert/Update: `parent_id?: string | null`
- [x] `parent_id: validated.parent_id` appears at exactly 2 non-comment lines in route.ts (lines 534 + 700)
- [x] Sites 2 (~632) and 4 (~842) still spread `...buildInsertRow(...)` — no direct parent_id edit
- [x] Site 5 safety-net UPDATE (~870-904) has no `parent_id` field
- [x] `npx tsc --noEmit` — no new errors in any changed file
- [x] Live DB column confirmed: `parent_id | text | YES` + FK with `confdeltype = 'n'`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. `parent_id` is validated as `z.string().optional()` by `AnalysisInputSchema` (input bounded). FK referential integrity is DB-enforced. T-05-01 and T-05-02 mitigations applied as designed.

## Self-Check: PASSED

All created files exist on disk. Both task commits (`8d8afffa`, `3295c989`) confirmed in git log.
