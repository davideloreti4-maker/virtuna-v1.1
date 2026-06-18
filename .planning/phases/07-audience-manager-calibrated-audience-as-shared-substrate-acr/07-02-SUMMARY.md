---
phase: 07-audience-manager-calibrated-audience-as-shared-substrate-acr
plan: "02"
subsystem: audience-persistence
tags: [audience, supabase, migration, crud, tdd, virtual-constants, rls]
dependency_graph:
  requires: [src/lib/audience/audience-types.ts, src/lib/audience/goal-intent.ts, supabase/migrations/20260617000000_threads_messages.sql, supabase/migrations/20260527000000_audience_overrides.sql]
  provides: [supabase/migrations/20260619000000_audiences.sql, src/lib/audience/audience-repo.ts, src/lib/audience/__tests__/audience-repo.test.ts]
  affects: [07-03, 07-04, 07-05, 07-06]
tech_stack:
  added: []
  patterns: [TDD-London-School, virtual-constant-resolution, RLS-owner-scoped, CR-01-session-user-id, Zod-boundary-validation]
key_files:
  created:
    - supabase/migrations/20260619000000_audiences.sql
    - src/lib/audience/audience-repo.ts
    - src/lib/audience/__tests__/audience-repo.test.ts
  modified: []
decisions:
  - "Virtual constants (Open Q2 RESOLVED): General + 2 presets are in-memory constants (no DB seed row); absence of active_audience_id = General; regression gate free by construction"
  - "Sentinel ids: GENERAL_AUDIENCE.id='general', PRESET_AUDIENCES[0].id='preset-growth' (grow), PRESET_AUDIENCES[1].id='preset-conversion' (sell) — stable, referenced by 07-04 chip + 07-05 gate"
  - "database.types.ts regeneration DEFERRED to 07-05 post-push: live DB does not have the migration yet; (supabase as any) casts hold the type surface in the interim"
  - "CR-01 enforced in application layer: audienceToRow() always injects sessionUserId; user_id stripped from updateAudience payload"
metrics:
  duration: "~6m"
  completed: "2026-06-18"
  tasks_completed: 3
  files_count: 3
---

# Phase 7 Plan 02: Audience Persistence + CRUD Summary

Additive persistence layer for the Audience object — `audiences` table + `threads.active_audience_id` column + RLS-scoped CRUD repo with virtual General/preset constants. Migration does not touch `analysis_results`, `creator_persona_weights`, or `ARCHETYPE_DEFINITIONS`. Database types regeneration deferred to 07-05 post-push.

## What Was Built

### Migration: `supabase/migrations/20260619000000_audiences.sql`

**`public.audiences` table columns:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | audience_id — multi-select ready |
| `user_id` | `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | RLS owner |
| `name` | `text NOT NULL` | creator display name |
| `type` | `text NOT NULL CHECK (type IN ('personal','target'))` | |
| `platform` | `text NOT NULL CHECK (platform IN ('tiktok','instagram','youtube','custom'))` | |
| `goal_label` | `text` | free-text display (D-05) |
| `goal_intent` | `text CHECK (goal_intent IN ('grow','sell','authority','nurture'))` | |
| `is_general` | `boolean NOT NULL DEFAULT false` | |
| `is_preset` | `boolean NOT NULL DEFAULT false` | |
| `fyp` | `NUMERIC(5,4) NOT NULL DEFAULT 0.65` | PersonaWeights field |
| `niche` | `NUMERIC(5,4) NOT NULL DEFAULT 0.20` | PersonaWeights field |
| `loyalist` | `NUMERIC(5,4) NOT NULL DEFAULT 0.10` | PersonaWeights field |
| `cross_niche` | `NUMERIC(5,4) NOT NULL DEFAULT 0.05` | PersonaWeights field |
| `personas` | `jsonb NOT NULL DEFAULT '[]'` | 10 calibrated CalibratedPersona entries |
| `profile` | `jsonb` | AudienceProfile aggregate |
| `calibration` | `jsonb` | calibration metadata |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

**Weight sum CHECK (verbatim from `creator_persona_weights`):**
```sql
ABS((fyp + niche + loyalist + cross_niche) - 1.0) < 0.01
```

**RLS policies (verbatim from `cpw_select_own` / `cpw_upsert_own`):**
- `audiences_select_own`: FOR SELECT — `USING (auth.uid() = user_id)`
- `audiences_all_own`: FOR ALL — `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`

**`threads.active_audience_id` column (D-04):**
```sql
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS active_audience_id uuid NULL
    REFERENCES public.audiences(id) ON DELETE SET NULL;
```
NULL = General default. ON DELETE SET NULL degrades to General gracefully.

### audience-repo.ts Public API

```typescript
// Virtual constants (no DB row)
GENERAL_AUDIENCE: Audience      // id='general', is_general=true, DEFAULT mix
PRESET_AUDIENCES: Audience[]    // [0] id='preset-growth' (grow), [1] id='preset-conversion' (sell)

// CRUD
listAudiences(supabase)         // → Audience[] — [GENERAL, ...PRESETS, ...userRows]
getAudience(supabase, id)       // → Audience | null — sentinel short-circuit for virtual ids
createAudience(supabase, input) // → Audience — user_id from session (CR-01)
updateAudience(supabase, id, Partial<Audience>) // → Audience — user_id stripped from payload
deleteAudience(supabase, id)    // → void — throws on sentinel ids
```

### Sentinel IDs (stable — referenced by 07-04 + 07-05)

| Constant | id | Meaning |
|----------|----|---------|
| `GENERAL_AUDIENCE` | `'general'` | Default (no override → DEFAULT mix) |
| `PRESET_AUDIENCES[0]` | `'preset-growth'` | Growth-leaning (`biasForGoalIntent('grow')`) |
| `PRESET_AUDIENCES[1]` | `'preset-conversion'` | Conversion-leaning (`biasForGoalIntent('sell')`) |

### database.types.ts Status

**DEFERRED to 07-05 post-push.** The migration has NOT been pushed to the live DB yet (`supabase db push` is the BLOCKING task in 07-05). Generation against the remote returns no `audiences` table or `active_audience_id` column (confirmed with `supabase gen types typescript --project-id qyxvxleheckijapurisj`). The `(supabase as any).from('audiences')` cast convention in `audience-repo.ts` holds the type surface in the interim without errors.

**After 07-05 push:** re-run `supabase gen types typescript --project-id qyxvxleheckijapurisj > src/types/database.types.ts` and remove the `(supabase as any)` casts from `audience-repo.ts`.

## Test Coverage

| File | Tests | Result |
|------|-------|--------|
| audience-repo.test.ts | 24 | PASS |

## Key Decisions Made

1. **Virtual constants (no seed migration):** Open Q2 resolved. General = absence of row/override. Presets = in-memory constants materialized only if the creator customizes. This keeps the regression gate trivially true (AUD-03) and avoids a per-user seed migration.

2. **Sentinel ids are stable strings:** `'general'`, `'preset-growth'`, `'preset-conversion'` — not UUIDs. Downstream plans (07-04 chip, 07-05 gate) can reference these constants by id without a DB query.

3. **CR-01 enforced at application layer:** `audienceToRow()` always sets `user_id = sessionUserId` from `supabase.auth.getUser()`. The `updateAudience` path explicitly `delete rowPayload.user_id` so the update payload never overwrites the owner field. DB RLS is a second line of defense.

4. **database.types.ts regeneration deferred:** `supabase db push` happens in 07-05 (BLOCKING gate). Types cannot be regenerated until the migration is live. Cast convention (`supabase as any`) holds until then.

## Downstream Contracts

**07-03 (calibration):** import `createAudience`, `updateAudience` from `@/lib/audience/audience-repo`. The repo handles weights mapping (fyp/niche/loyalist/cross_niche ← PersonaWeights) — caller passes an `Audience` domain object, repo flattens for DB.

**07-04 (chip + wiring):** use `GENERAL_AUDIENCE`, `PRESET_AUDIENCES`, `listAudiences`, `getAudience`. Sentinel id `'general'` maps to NULL in `threads.active_audience_id` (General is the absence of override, not a real row).

**07-05 (BLOCKING gate):** after `supabase db push` succeeds, run `supabase gen types typescript --project-id qyxvxleheckijapurisj > src/types/database.types.ts` and remove `(supabase as any)` casts from `audience-repo.ts`.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors found in unrelated files (flash-schema.test.ts, flash-aggregate.test.ts, flop-warning.test.ts, etc.) — all pre-date this plan and are out of scope per deviation rules.

## Commits

| Hash | Message |
|------|---------|
| f66e753e | feat(07-02): audiences migration + threads.active_audience_id column |
| 0e627b35 | test(07-02): add failing tests for audience-repo CRUD + virtual constants (RED) |
| d05cf269 | feat(07-02): audience-repo CRUD + virtual General/preset constants (GREEN) |

## Threat Flags

None — persistence layer is RLS-scoped (owner-only access). No new network endpoints introduced in this plan (routes come in 07-04/07-05). User_id trust enforced at application layer (CR-01) + DB RLS.

## Known Stubs

None — all public API functions are fully implemented. The `(supabase as any)` cast is intentional (type surface gap pending migration push), not a stub.

## Self-Check: PASSED
