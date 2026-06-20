---
phase: 11-explore-audience-curated-discovery
plan: 02
subsystem: database
tags: [supabase, postgres, migration, rls, watchlist, tracked-accounts]

# Dependency graph
requires:
  - phase: 10-account-read-saved-shelf-recalibration-flywheel
    provides: "saved_items flat-typed RLS-own-rows migration idiom (saved_all_own) — the exact template mirrored here (D-07 → D-08)"
provides:
  - "tracked_accounts migration file — the durable, flat-typed watchlist input rail (the Explore PRODUCER half, EXPLORE-05 / D-08)"
  - "UNIQUE(user_id, platform, handle) idempotency constraint for the Track write"
  - "RLS own-rows-only policy (tracked_all_own) + tracked_accounts_user_idx index"
affects: [11-03 (tracked-accounts repo + route build over this table), 11-08 (BLOCKING wave — live prod push + database.types.ts regen), 12-library-acts-state-ia (surfaces/manages the watchlist with no rework)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat-typed input-State table mirroring saved_items RLS idiom (own-rows-only FOR ALL TO authenticated, auth.uid() = user_id)"
    - "Migration-file-only this wave; live push + types regen deferred to a final BLOCKING wave (mirrors 07-06, 10-07)"

key-files:
  created:
    - supabase/migrations/20260620090000_tracked_accounts.sql
  modified: []

key-decisions:
  - "NEW dedicated tracked_accounts table (not an overload of saved_items) — a tracked account is an input HANDLE, not a saved block snapshot; saved_items' own comment says P12 EXTENDS with separate tables (RESEARCH Open Q1 / Pattern 6)"
  - "FLAT by construction (D-08): columns = id, user_id, platform, handle, source_video_id, created_at + table-level UNIQUE — no folder_id, no tags, no snapshot, no CMS; P12 surfaces/manages with no rework"
  - "Idempotent Track via UNIQUE(user_id, platform, handle) — re-tracking the same account is a no-op, no duplicate rows"
  - "EXPLORE-06 (comment seeding) DEFERRED again (D-09) — no comments/seeding table added"
  - "Migration WRITTEN only — NOT applied to live DB; supabase db push + database.types.ts regen is the BLOCKING final wave 11-08"

patterns-established:
  - "tracked_accounts mirrors saved_items 1:1 on the RLS idiom: ENABLE ROW LEVEL SECURITY → DROP POLICY IF EXISTS → CREATE POLICY <name>_all_own FOR ALL TO authenticated USING/WITH CHECK (auth.uid() = user_id), + a user index"

metrics:
  duration: ~8 min
  completed: 2026-06-20
  tasks: 1
  files: 1
---

# Phase 11 Plan 02: tracked_accounts Watchlist Migration Summary

Authored the `tracked_accounts` migration — a flat-typed, RLS-own-rows-only watchlist input table mirroring `saved_items`, idempotent via `UNIQUE(user_id, platform, handle)`, written but NOT pushed to live prod (push deferred to BLOCKING wave 11-08).

## What Was Built

**`supabase/migrations/20260620090000_tracked_accounts.sql`** — the durable producer rail for Explore's "+ Track account" write (EXPLORE-05 / D-08):

- **Table** (`CREATE TABLE IF NOT EXISTS public.tracked_accounts`): `id uuid PK DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `platform text NOT NULL DEFAULT 'tiktok' CHECK (platform IN ('tiktok','instagram','youtube'))`, `handle text NOT NULL` (the @handle, no '@', lowercased), `source_video_id text` (provenance — the outlier tile it was tracked from), `created_at timestamptz NOT NULL DEFAULT now()`, plus a table-level `UNIQUE (user_id, platform, handle)`.
- **Idempotency:** the `UNIQUE (user_id, platform, handle)` constraint makes tracking the same account twice a no-op — no duplicate rows.
- **RLS:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `DROP POLICY IF EXISTS tracked_all_own` + `CREATE POLICY tracked_all_own ... FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` — own-rows-only, mirroring `saved_items`' `saved_all_own`.
- **Index:** `CREATE INDEX IF NOT EXISTS tracked_accounts_user_idx ON public.tracked_accounts (user_id)`.
- **Documenting comments:** `COMMENT ON TABLE` states the flat-by-construction intent (no folder_id/tags/CMS; P12 extends with no rework; UNIQUE = idempotent Track); column comments on `handle` and `source_video_id`.

**Flat by construction (D-08):** the column set carries no `folder_id`, no `tags`, no `snapshot`, no `item_type` — P12 surfaces/manages it (Library) with no rework. (The phrase "no folder_id, no tags" appears only inside the documenting `COMMENT` string, never as a column.)

**Scope boundary honored (D-09):** no comment-seeding/comments table was added — EXPLORE-06 stays deferred.

## How It Works

The Explore tile's "+ Track account" write (built in 11-03) POSTs `{ platform, handle }` and inserts/upserts one row here. RLS scopes every read/write to the session user (`auth.uid() = user_id`); the `UNIQUE` constraint absorbs duplicate tracks. The table is Library-compatible: P12 reads the same flat shape to render watchlist management without a schema change. Provenance (`source_video_id`) records which outlier tile a track originated from.

## Verification

Plan verify command and all gate checks passed:
- `MIGRATION OK` — file exists; `CREATE TABLE IF NOT EXISTS public.tracked_accounts`, `auth.uid() = user_id`, and `UNIQUE (user_id, platform, handle)` all present.
- `RLS-FORALL OK` — `FOR ALL TO authenticated` present (mirrors saved_items RLS idiom).
- `FLAT-COLUMNS OK` — no `folder_id`/`tags`/`snapshot`/`item_type` column (verified against the column block, lines 22–32; the only matches are inside the `COMMENT` string body).
- `POLICY+INDEX OK` — `CREATE POLICY tracked_all_own` + `tracked_accounts_user_idx` present.
- `CHECK+PROVENANCE OK` — platform CHECK constraint + `source_video_id text` present.
- Live DB NOT touched — no `supabase db push` / `db reset` invoked in this plan (deferred to 11-08).

## Deviations from Plan

None — plan executed exactly as written. The single task produced exactly the prescribed migration (columns, constraints, RLS policy, index, comments) per RESEARCH §Pattern 6 and the `saved_items` mirror.

## Known Stubs

None. This plan produces a complete migration file; it is intentionally NOT applied to the live DB in this wave (live push + `database.types.ts` regen is the BLOCKING final wave 11-08, mirroring how 07-06 and 10-07 sequenced live schema push into a gated final wave). This is a planned sequencing decision, not a stub — 11-03 builds the repo + route over this table next, and 11-08 applies it.

## Self-Check: PASSED

- FOUND: supabase/migrations/20260620090000_tracked_accounts.sql
- FOUND commit: 99bba176
