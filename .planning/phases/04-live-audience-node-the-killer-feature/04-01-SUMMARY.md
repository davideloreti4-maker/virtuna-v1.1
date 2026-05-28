---
phase: 04-live-audience-node-the-killer-feature
plan: "01"
subsystem: audience-node-test-scaffold
tags: [wave-0, test-stubs, fixtures, migration, nyquist, tdd-red]
dependency_graph:
  requires: []
  provides:
    - src/components/board/audience/__tests__/fixtures/heatmap-fixture.ts
    - src/components/board/audience/__tests__/fixtures/streaming-fixture.ts
    - src/components/board/audience/__tests__/**/*.test.{ts,tsx} (18 stubs)
    - src/lib/engine/wave3/__tests__/weighted-aggregator-client.test.ts
    - supabase/migrations/20260527000000_audience_overrides.sql
  affects:
    - Plans 04-02 through 04-10 (each uses these stubs as automated verify targets)
    - Plan 04-11 (migration push)
tech_stack:
  added: []
  patterns:
    - Wave 0 Nyquist scaffold: lock test surface before production code
    - Deterministic fixture formula: (i+j)*0.07%1 (no Math.random)
    - @ts-expect-error guards for missing-module imports in RED state
    - it.todo() per VALIDATION.md behavior row
key_files:
  created:
    - src/components/board/audience/__tests__/fixtures/heatmap-fixture.ts
    - src/components/board/audience/__tests__/fixtures/streaming-fixture.ts
    - src/components/board/audience/__tests__/HeadlineChips.test.tsx
    - src/components/board/audience/__tests__/Filmstrip.test.tsx
    - src/components/board/audience/__tests__/RetentionCurve.test.tsx
    - src/components/board/audience/__tests__/RetentionCurve.reduced-motion.test.tsx
    - src/components/board/audience/__tests__/DropoffMarkers.test.ts
    - src/components/board/audience/__tests__/HeatmapDrawer.test.tsx
    - src/components/board/audience/__tests__/HeatmapDrawer.mobile.test.tsx
    - src/components/board/audience/__tests__/HeatmapDrawer.a11y.test.tsx
    - src/components/board/audience/__tests__/PersonaRow.test.tsx
    - src/components/board/audience/__tests__/use-audience-choreography.test.ts
    - src/components/board/audience/__tests__/use-audience-choreography.streaming.test.ts
    - src/components/board/audience/__tests__/TapPopover.test.tsx
    - src/components/board/audience/__tests__/TapPopover.a11y.test.tsx
    - src/components/board/audience/__tests__/PersonaInspector.test.tsx
    - src/components/board/audience/__tests__/AntiViralityOverlay.test.tsx
    - src/components/board/audience/__tests__/WeightOverrideDrawer.test.tsx
    - src/components/board/audience/__tests__/use-client-weights.test.ts
    - src/components/board/audience/__tests__/weight-rebalance.test.ts
    - src/lib/engine/wave3/__tests__/weighted-aggregator-client.test.ts
    - supabase/migrations/20260527000000_audience_overrides.sql
  modified: []
decisions:
  - "Used (i+j)*0.07%1 formula for deterministic persona attentions — avoids Math.random, keeps tests reproducible"
  - "Placed @ts-expect-error on all missing-component imports to keep TS compiling in Wave 0 RED state"
  - "buildAntiViralityHeatmap() sets segments 4-6 attention to 0.15 across all personas to trigger timeline_pattern"
  - "Migration adds CHECK constraint sum ≈ 1.0 ±0.01 per STRIDE threat T-04-01 mitigation"
metrics:
  duration_min: 15
  completed_date: "2026-05-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 22
  files_modified: 0
---

# Phase 4 Plan 01: Wave 0 Test Scaffold Summary

Locked Nyquist-compliant verification surface for Phase 4 (Live Audience Node) before any production code: 18 audience test stubs + 1 wave3 aggregator test + 2 deterministic fixture builders + 1 SQL migration scaffold with RLS.

## What Was Built

### Task 1: Fixture Builders

**`heatmap-fixture.ts`** exports:
- `buildHeatmapFixture(overrides?)` — returns valid `HeatmapPayload` with 10 segments (0-3 hook_zone), 10 personas in PERSONA_SLOT_ORDER, deterministic attentions via `(i+j)*0.07%1`, monotonically decreasing `weighted_curve`, default weights
- `buildAntiViralityHeatmap()` — overrides segments 4-6 to attention=0.15 (triggers `timeline_pattern`)
- `PERSONA_SLOT_ORDER` and `ARCHETYPE_BY_SLOT` constants

**`streaming-fixture.ts`** exports:
- `STREAMING_FIXTURE: StageEvent[]` — full Pass 2 timeline: wave_0_segmentation start/end, 10× pass2_persona_start, 10× pass2_persona_end, 10× filmstrip_segment_ready
- `buildStageEvent<T>(type, overrides)` — typed helper for per-test event construction

Both files compile under strict TS with zero errors and zero `Math.random` usage.

### Task 2: 19 Test Stubs

18 stubs in `src/components/board/audience/__tests__/` + 1 in `src/lib/engine/wave3/__tests__/`:
- 48 total `it.todo()` entries mapped verbatim from `04-VALIDATION.md` behavior rows
- `.tsx` files use `/** @vitest-environment happy-dom */` pragma
- Pure-function `.ts` files use default `node` environment
- All missing-component imports guarded by `@ts-expect-error -- created in Plan 04-XX`
- `vitest run` result: 19 files skipped, 48 todos, 0 failed

### Task 3: Migration Scaffold

`supabase/migrations/20260527000000_audience_overrides.sql`:
- `ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS analysis_override JSONB`
- `CREATE TABLE IF NOT EXISTS creator_persona_weights` with NUMERIC(5,4) defaults (0.65/0.20/0.10/0.05)
- CHECK constraint: sum ≈ 1.0 ±0.01 (STRIDE T-04-01 tamper mitigation)
- RLS enabled + `cpw_select_own` / `cpw_upsert_own` policies
- Schema push deferred to Plan 04-11 BLOCKING task

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | fa8e726 | feat(04-01): add fixture builders heatmap + streaming |
| 2 | d667f09 | test(04-01): add 19 failing test stubs for Phase 4 components |
| 3 | d7db924 | feat(04-01): scaffold audience overrides migration |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - this plan intentionally creates test stubs (Wave 0 RED state). The `it.todo` entries are intentional; they will be replaced with real assertions in Plans 04-02 through 04-10.

## Threat Surface Scan

Migration introduces `creator_persona_weights` table at the auth boundary:
- `cpw_select_own` / `cpw_upsert_own` RLS policies gate all DML to `auth.uid() = user_id`
- CHECK constraint prevents invalid weight distributions (sum != 1.0)
- `analysis_override JSONB` protected by existing `analysis_results` RLS (no new exposure)
- Both threats covered in plan's STRIDE register (T-04-01, T-04-02)

## Self-Check: PASSED

Files verified:
- `src/components/board/audience/__tests__/fixtures/heatmap-fixture.ts` - FOUND
- `src/components/board/audience/__tests__/fixtures/streaming-fixture.ts` - FOUND
- `supabase/migrations/20260527000000_audience_overrides.sql` - FOUND
- All 19 test stubs - FOUND (19 vitest-skipped, 0 failed)

Commits verified:
- fa8e726 - FOUND
- d667f09 - FOUND
- d7db924 - FOUND
