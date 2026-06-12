---
phase: 02-view-model-data-contract-eng-06-d-12
plan: 03
subsystem: reading-data-contract
tags: [normalizer, determinism, data-02, d-11, view-model, route-refactor]
dependency_graph:
  requires:
    - "src/lib/reading/block-types.ts (CanonicalReading shape, 02-02)"
  provides:
    - "src/lib/reading/from-persisted-row.ts (pure deterministic persisted-row → CanonicalReading normalizer)"
    - "fromPersistedRow export consumed by [id]/route.ts now and view-model identical-render test in 02-04"
  affects:
    - "src/app/api/analysis/[id]/route.ts (now a thin caller; non-deterministic reconstruction dropped)"
tech_stack:
  added: []
  patterns:
    - "Pure deterministic normalizer (no random/time/DB source) — the DATA-02 precondition"
    - "Defensive optional-chained variants.* reads — degrade-not-throw"
    - "Prefer-persisted-column, threshold-fallback-only-on-null for confidence_label/anti_virality_gated"
key_files:
  created:
    - "src/lib/reading/from-persisted-row.ts"
    - "src/lib/reading/__tests__/from-persisted-row.test.ts"
  modified:
    - "src/app/api/analysis/[id]/route.ts"
decisions:
  - "fromPersistedRow accepts `unknown` and narrows to a permissive PersistedRowShape (not the generated Row type) so partial/old rows + the variants JSONB bag normalize without type fights."
  - "apolloReasoning narrowed to {rewrites, ceiling_capper?} (the CanonicalReading intersection), not the full apollo_reasoning object — dimensions/composite_score/confidence_scope excluded per D-09."
  - "Heatmap reads the column ONLY; null stays null (synth dropped). retention-degraded emission is the view-model's job (02-04), not the normalizer's."
metrics:
  duration_min: 22
  completed: "2026-06-12"
  tasks: 2
  files: 3
---

# Phase 2 Plan 03: Deterministic fromPersistedRow Normalizer Summary

Pure deterministic `fromPersistedRow(row) → CanonicalReading` (D-11) that resolves the load-bearing DATA-02 audit finding: the `[id]` route used to reconstruct four fields at load time — `synthHeatmap()` with `Math.random()` persona ids and a time/DB-dependent `optimal_post_window` recompute — making live ≠ replay. The deterministic shims are now absorbed into one pure module; the non-deterministic ones are DROPPED; the route is a thin, still-authorized caller.

## What Was Built

**Task 1 — `src/lib/reading/from-persisted-row.ts` (TDD: RED `60426daa` → GREEN `1eaf5cec`)**
- Pure `fromPersistedRow(input: unknown): CanonicalReading`. No randomness source, no wall-clock/time source, no network/DB I/O — `fromPersistedRow(sameRow)` returns deep-equal output on every call (asserted by a determinism unit test).
- ABSORBED deterministic shims: numeric coercion of string `confidence`/`overall_score` (Pitfall 5); degradation-tier derive — `analysisUnavailable` (`!gemini && !behavioral`) AND the newly-added `partialAnalysis` (`gemini !== behavioral`) the route omitted; defensive `variants.hero` / `variants.apollo` / `variants.craft` optional-chained reads.
- DROPPED non-deterministic shims: the synthesized heatmap (reads the `heatmap` column verbatim, null stays null — D-14/Pitfall 3); the `optimal_post_window` recompute + `creator_profiles` lookup (D-09 — not a Reading block, time/DB-dependent).
- `confidenceLabel` / `antiViralityGated`: prefer the persisted column, threshold-derive ONLY when the column is genuinely null (old rows), matching engine thresholds (0.7/0.4).
- 15/15 unit tests green (determinism, coercion, heatmap-null, degrade-not-throw on missing variants bag, degradation tiers, prefer-column).

**Task 2 — `src/app/api/analysis/[id]/route.ts` rewired (`d604c424`)**
- Replaced the inline shim block (146 lines) with `return Response.json(fromPersistedRow(data))`.
- Removed now-unused imports (`createServiceClient`, `computeOptimalPostWindow`).
- PRESERVED: `select("*").eq("id",id).eq("user_id",user.id).is("deleted_at",null).single()` ownership filter, the 401 Unauthorized guard, the `?summary` branch (unchanged — it consumed no dropped shim), 404/500 handling, and the entire DELETE handler. No new DB query introduced.
- Route shrank 256 → 110 lines.

## Deviations from Plan

None — plan executed exactly as written.

Out-of-scope discoveries logged (not fixed) to `deferred-items.md`: 19 pre-existing tsc errors in 11 files, all in phases/files this plan does not touch (`wave3/fold-schema.test.ts`, `tests/numen/{stage-reveal,tokens}.test.ts`) or expected RED scaffolds importing the not-yet-built `../view-model` (built in 02-04).

## Verification

- `pnpm exec tsc --noEmit`: no errors in either new/modified file (the 19 repo-wide errors are pre-existing + out-of-scope; the `../view-model` ones resolve in 02-04).
- Determinism grep on the normalizer: `Math.random|computeOptimalPostWindow|Date.now|new Date|fetch(` → no matches (PASS).
- Route grep: contains `fromPersistedRow` + `user_id`, contains no `synthHeatmap|computeOptimalPostWindow` (PASS); ownership filter + 401 guard present.
- `pnpm exec vitest run src/lib/reading/`: from-persisted-row 15/15 PASS. The 3 FAILs (`identical-render`, `verdict`, `view-model`) are pre-existing RED scaffolds from 02-01 awaiting the 02-04 view-model + the 02-01 human-action fixture pair — NOT new regressions.

## Known Stubs

None. The normalizer is fully wired (route calls it; output is the route's JSON response). Heatmap-null is intentional honest degradation (D-14), not a stub.

## Notes for Downstream (02-04)

- `fromPersistedRow` produces the exact `CanonicalReading` from `block-types.ts`; `toReadingBlocks` (02-04) consumes it. The `identical-render.test.ts` deep-equal lives in 02-04 and needs the real fixture pair (02-01 human-action gate).
- `apolloReasoning` is the narrow `{rewrites, ceiling_capper?}` — the view-model's expert-insight block must read only those two fields to stay path-symmetric with `canonicalFromLive`.

## Self-Check: PASSED

- FOUND: src/lib/reading/from-persisted-row.ts
- FOUND: src/lib/reading/__tests__/from-persisted-row.test.ts
- FOUND: src/app/api/analysis/[id]/route.ts (modified)
- FOUND commit: 60426daa (test/RED)
- FOUND commit: 1eaf5cec (feat/normalizer)
- FOUND commit: d604c424 (feat/route rewire)
