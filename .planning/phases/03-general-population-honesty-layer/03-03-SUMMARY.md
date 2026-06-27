---
phase: 03-general-population-honesty-layer
plan: 03
subsystem: audience-schema
status: COMPLETE — migration applied to live DB + verified (via Supabase MCP)
tags: [migration, supabase, audiences, mode, honesty-layer, D-04, D-03, D-07]
requires:
  - 03-02 (Audience.mode / success_criterion / custom_context domain contracts)
provides:
  - "public.audiences.mode (text NOT NULL DEFAULT 'socials' CHECK IN socials/general)"
  - "public.audiences.success_criterion (text)"
  - "public.audiences.custom_context (jsonb NOT NULL DEFAULT '[]')"
  - "mode-gated audiences_weights_sum_check (Socials byte-stable)"
affects:
  - 03-04 (repo row mappers read these columns)
  - 03-05 / 03-06 (UI + form author/edit success_criterion + custom_context)
tech-stack:
  added: []
  patterns:
    - "additive ADD COLUMN IF NOT EXISTS + in-place DEFAULT backfill"
    - "mode-gated CHECK via logical implication (mode <> 'socials' OR <predicate>)"
    - "verbatim predicate copy for byte-stability (same <0.01 epsilon)"
key-files:
  created:
    - supabase/migrations/20260627000000_audience_general.sql
  modified: []
decisions:
  - "mode is first-class (NOT derived from is_general); DEFAULT 'socials' backfills every existing row"
  - "weight-sum CHECK re-gated to mode='socials' only; 4-weight predicate copied byte-identical from 20260619000000_audiences.sql:47-52"
  - "custom_context stored top-level (not nested in signature) so signature:null audiences can carry it (Pitfall 2)"
  - "live supabase db push DEFERRED to human checkpoint — production DB mutation is human-authorized (Task 2 = BLOCKING gate)"
metrics:
  duration: "~6min"
  completed: "2026-06-27 (Task 1 + Task 2 applied + checkpoint verified)"
  tasks_complete: "2 of 2 (+ checkpoint verified)"
  files: 1
---

# Phase 3 Plan 03: Additive Mode-Gated Audiences Migration Summary

One additive migration (`mode` axis + `success_criterion` + `custom_context`) with a mode-gated weight-sum CHECK that keeps existing Socials rows byte-stable — written and committed; the BLOCKING live `supabase db push` is deferred to the human checkpoint.

## What Was Built

**Task 1 — `supabase/migrations/20260627000000_audience_general.sql` (committed `6d8b6073`)**

1. `ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'socials' CHECK (mode IN ('socials','general'))` — DEFAULT backfills every historical row to `'socials'` in-place (no separate UPDATE), making `mode` a first-class axis (D-04).
2. `ADD COLUMN IF NOT EXISTS success_criterion text` (D-03) + `ADD COLUMN IF NOT EXISTS custom_context jsonb NOT NULL DEFAULT '[]'` (D-07, top-level so `signature:null` audiences can still carry it — Pitfall 2).
3. `DROP CONSTRAINT IF EXISTS audiences_weights_sum_check`.
4. Re-created `audiences_weights_sum_check` GATED via logical implication: `mode <> 'socials' OR ( <4-weight predicate> )`. The OR-branch predicate is byte-identical to `20260619000000_audiences.sql:47-52` (same `[0,1]` bounds + same `ABS(... - 1.0) < 0.01` epsilon) so previously-valid Socials rows pass identically (T-03-04 mitigation).

COMMENT lines added for `mode` / `success_criterion` / `custom_context`. The four weight columns keep their NOT-NULL definitions and defaults (not altered). No edit to other tables, scoring config, ENGINE_VERSION, or RLS.

## Validation (grep gates — all PASS)

| Criterion | Result |
|-----------|--------|
| File exists | PASS |
| `ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'socials'` + `CHECK (mode IN ('socials','general'))` | PASS |
| Gated `mode <> 'socials' OR (...)` implication form | PASS |
| `ABS((fyp + niche + loyalist + cross_niche) - 1.0) < 0.01` byte-identical in new + ref (`20260619000000`) | PASS (both) |
| `success_criterion text` + `custom_context jsonb NOT NULL DEFAULT '[]'` | PASS |
| No `analysis_results` / `DROP POLICY` / `ALTER COLUMN` tokens | PASS |
| Plan `<verify>` automated gate (`MIGRATION_OK`) | PASS |

## Deviations from Plan

**1. [Rule 3 — Blocking-issue avoidance] Header comment reworded to keep AC6 grep clean**
- **Found during:** Task 1 validation.
- **Issue:** AC6 forbids `grep` matches for `analysis_results` / `DROP POLICY` / `ALTER COLUMN`. Initial header comment referenced the `analysis_results` analog filename and a "DO NOT touch analysis_results" guardrail, tripping the literal grep.
- **Fix:** Reworded the two header comment lines to reference analogs by timestamp/purpose without the literal forbidden tokens. No DDL change.
- **Files modified:** `supabase/migrations/20260627000000_audience_general.sql` (comments only).
- **Commit:** `6d8b6073`.

## Task 2 — Applied to the live DB (via Supabase MCP, human-authorized)

The operator authorized application via the Supabase MCP (not the CLI `db push`). Applied to the **`virtuna-v1.1`** project (`qyxvxleheckijapurisj`, ACTIVE_HEALTHY, EU-west-1) — confirmed the correct prod DB via a pre-flight read-back (audiences table present, 2 rows, the unconditional weight CHECK in place, `has_mode_column=false`).

**Applied:** `mcp__supabase__apply_migration(name="audience_general")` → `{"success": true}`.

**Read-back verification (Task 3 — all PASS):**
| Check | Result |
|-------|--------|
| Existing rows by mode | `socials: 2` — all backfilled, **0 general** |
| Gated CHECK present | `CHECK ((mode <> 'socials') OR (fyp/niche/loyalist/cross_niche bounds AND ABS(sum-1.0)<0.01))` — verbatim predicate |
| New columns present | `mode`, `success_criterion`, `custom_context` (all three) |
| Migration recorded | `supabase_migrations.schema_migrations` row, name `audience_general` |

**Version reconciliation:** the MCP stamped the remote history version `20260627141829` (apply-time); reconciled to **`20260627000000`** (UPDATE on `schema_migrations`) to match the committed file's midnight-timestamp convention, so a future `supabase db push` sees it as already-applied (clean no-op). The DDL is idempotent (`ADD COLUMN IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS`) regardless.

## Status

- Task 1: DONE (migration file written, all gates pass, committed `6d8b6073`).
- Task 2 (live apply): DONE — applied via Supabase MCP to `virtuna-v1.1`, all read-backs green, version reconciled.
- Checkpoint (human-verify): SATISFIED — rows socials-stable, three columns + gated CHECK present.
- Plan 03-03 is **COMPLETE**.

## Self-Check: PASSED
- FOUND: supabase/migrations/20260627000000_audience_general.sql
- FOUND: commit 6d8b6073
- LIVE: public.audiences.mode / success_criterion / custom_context present on virtuna-v1.1; 2 rows mode='socials'; gated CHECK active
