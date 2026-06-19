---
phase: 07-audience-manager-calibrated-audience-as-shared-substrate-acr
plan: "06"
subsystem: engine
tags: [audience, regression-gate, engine-version, migration-push, blocking-gate, aud-03, phase-closeout]

requires:
  - phase: 07-02
    provides: 20260619000000_audiences.sql migration (audiences table + threads.active_audience_id)
  - phase: 07-01
    provides: resolveAudienceWeights (General→DEFAULT identity guarantee)
provides:
  - 20260619000000_audiences.sql APPLIED to live prod DB (qyxvxleheckijapurisj)
  - src/types/database.types.ts regenerated against the migrated live schema
  - src/lib/engine/__tests__/audience-regression-gate.test.ts (BLOCKING gate)
affects: []

tech-stack:
  added: []
  patterns:
    - blocking-regression-gate (ENGINE_VERSION literal + General→DEFAULT identity, mirrors P6-05)
    - additive-migration-via-mcp (Supabase MCP apply_migration, no destructive DDL)
---

# 07-06 Summary — Schema push + BLOCKING engine regression gate (phase closeout)

## What shipped

1. **Migration applied to the live DB.** `20260619000000_audiences.sql` applied to prod
   `qyxvxleheckijapurisj` (virtuna-v1.1, eu-west-1) via the Supabase MCP `apply_migration`
   — the exact project that 404'd on `/audiences` in UAT. Verified post-apply against
   `information_schema` / `pg_policies` / `pg_indexes` / `pg_class`:
   - `public.audiences` table created — RLS enabled, 2 owner-only policies
     (`audiences_select_own`, `audiences_all_own`), `audiences_user_id_idx`, weights-sum CHECK.
   - `public.threads.active_audience_id` nullable FK added (`ON DELETE SET NULL`).
   - `analysis_results` / `creator_persona_weights` untouched (regression gate intact).
   - No destructive DDL; pre-check confirmed `audiences` did not pre-exist before apply.

2. **Types regenerated** against the now-migrated live schema → `src/types/database.types.ts`
   (2166 → 2240 lines). Contains the `audiences` Row/Insert/Update + `threads.active_audience_id`
   column + `threads_active_audience_id_fkey`. (Auto-wip hook captured the regen as `81d92bca`.)

3. **[BLOCKING] consolidated regression gate** — `audience-regression-gate.test.ts` (5 tests):
   - `ENGINE_VERSION === "3.19.0"` (no video-scoring change shipped this phase).
   - `resolveWeights(DEFAULT, {})` → DEFAULT mix, source `default`.
   - `resolveAudienceWeights([])` and `resolveAudienceWeights([generalAudience])` both →
     DEFAULT mix, source `default` (General injects no override).
   - Pitfall 1 guard: General carries NO `analysis_override` → the Max video path's
     `{niche}`-only resolution (aggregator.ts L1095-1122) is provably unaffected.

## Gate results

- **Full unit suite GREEN**: `pnpm test` (vitest run) — **258 files / 2647 tests passed**,
  1 file + 27 tests skipped, **0 failures**. Max same-video score-identity tests green
  (protected-path proof).
- **ENGINE_VERSION proven `3.19.0`** (gate + version.test.ts).
- **tsc**: the types regen introduced 2 new errors (thread fixtures in
  `open-thread.test.ts` + `threads.test.ts` missing the now-required `active_audience_id`
  column) — **both fixed** by adding `active_audience_id: null` to the fixtures.

## Documented-unrelated (NOT introduced this phase)

- **43 pre-existing tsc errors** remain, ALL in `__tests__` files, NONE in source and NONE
  audience/threads/database.types-related (e.g. `FlashAggregate` index-signature casts,
  `EngagementRange.views`, `PredictionResult.partial_analysis` fixture, unused-import in
  testimonials.test). These are baseline test-strictness debt, unrelated to the audience
  layer — the runtime suite is green on all of them. Tracked as separate cleanup, not a
  phase-7 blocker. Net new tsc errors introduced by this phase after fixes: **0**.

## UAT

Human-verify checkpoint **skipped** by owner directive ("skip uat"). Schema is live and the
automated protected-path proof (gate + full suite + tsc-clean audience layer) passed. The
live `/audience` page + calibration flow are unblocked on prod.

## Phase 7 closed

The DB matches the migrations (no false-positive verification), the protected Max video path
is provably untouched (ENGINE_VERSION 3.19.0, General reproduces DEFAULT, suite green), and
the audience substrate is live.
