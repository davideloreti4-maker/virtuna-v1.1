---
phase: 10-account-read-saved-shelf-recalibration-flywheel
plan: 07
subsystem: flywheel-shelf-landing
tags: [migrations, supabase, db-push, types-regen, regression-gate, engine-version, uat]

# Dependency graph
requires:
  - phase: 10
    plan: 02
    provides: "the 3 migration files (outcome_signatures, reconciliations, saved_items) + repos on interim (supabase as any) casts"
  - phase: 10
    plan: 03
    provides: "outcome-signature route/repo reads that need the live tables"
  - phase: 10
    plan: 04
    provides: "saved-items route/repo + SaveAffordance that need saved_items live"
  - phase: 10
    plan: 05
    provides: "Account Read consuming reconciliation history"
  - phase: 10
    plan: 06
    provides: "propose/confirm/drift writing reconciliations rows + General-unchanged regression anchor"
provides:
  - "3 additive sibling tables live on Supabase (qyxvxleheckijapurisj): outcome_signatures, reconciliations, saved_items — RLS own-rows-only, outcomes untouched (Pitfall 1)"
  - "database.types.ts regenerated (2402 lines) including the 3 new tables"
  - "interim (supabase as any) casts + TODO(10-07) markers removed from outcome-repo/reconciliation-repo/shelf-repo (now typed)"
  - "BLOCKING engine regression gate green: full suite 2823 passed, ENGINE_VERSION 3.19.0 unchanged, no scoring-source mutation, General-unchanged anchor green"
affects: [phase-10-verify, account-read-surface, saved-shelf-surface, flywheel-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live schema push performed via Supabase MCP apply_migration (owner-elected) rather than `supabase db push` CLI — additive sibling tables only, FK order outcome_signatures → reconciliations → saved_items"
    - "Types regenerated via Supabase MCP generate_typescript_types, written verbatim to src/types/database.types.ts"
    - "Post-merge engine gate caught a cross-plan integration regression invisible to per-plan self-checks (hook-handoff test missing QueryClientProvider after SaveAffordance mount)"

key-files:
  created: []
  modified:
    - "src/types/database.types.ts (regenerated — includes outcome_signatures, reconciliations, saved_items)"
    - "src/lib/flywheel/outcome-repo.ts (casts removed, now typed)"
    - "src/lib/flywheel/reconciliation-repo.ts (casts removed, now typed)"
    - "src/lib/shelf/shelf-repo.ts (casts removed, now typed)"
    - "src/components/thread/__tests__/hook-test-handoff.test.tsx (QueryClientProvider wrapper — cross-plan regression fix)"

requirements-completed: [FLYWHEEL-01, FLYWHEEL-04, SAVE-01]
---

# Plan 10-07 — Land the phase: migrations live + types regen + regression gate

## What shipped

**Task 1 (human-action, live) — DONE.** The three Plan-02 additive sibling migrations
were applied to the **live** Supabase project `qyxvxleheckijapurisj` (virtuna-v1.1,
ACTIVE_HEALTHY) via Supabase MCP `apply_migration`, in FK-dependency order:

1. `outcome_signatures` — predicted-vs-realized disposition signature + provenance + raw metrics
2. `reconciliations` — cross-creator seed log (divergence_vector, classification, follower_tier bucket)
3. `saved_items` — typed flat cross-skill shelf (D-07)

All three are RLS own-rows-only (`auth.uid() = user_id`), confirmed live via `list_tables`
(RLS enabled, 0 rows). The **contested `outcomes` table was NOT touched** (Pitfall 1) — verified
still present (0 rows) post-push. `database.types.ts` regenerated (2402 lines) to include the three
tables, and the interim `(supabase as any)` casts + `// TODO(10-07)` markers (plus now-unused
`eslint-disable no-explicit-any` directives) were removed from `outcome-repo.ts`,
`reconciliation-repo.ts`, `shelf-repo.ts`. `grep "TODO(10-07)"` clean; `npm run build` green; lint clean.

**Task 2 (auto, BLOCKING) — PASSED.** Full suite **2823 passed / 0 failed / 27 skipped** (281 files).
Regression anchors green: `audience-regression-gate.test.ts` (5/5) and `version.test.ts` (3/3,
`ENGINE_VERSION = "3.19.0"`). `version.ts` (the ENGINE_VERSION SSOT) and
`DEFAULT_PERSONA_WEIGHT_CONFIG`/`ARCHETYPE_DEFINITIONS` were **not** mutated by any non-test phase-10
file — the only matches in `propose.ts`/`recalibration.ts` are comments asserting they never touch them.
A confirmed recalibration provably leaves General weights byte-identical (Plan 06 anchor).

**Task 3 (human-verify, live UAT) — PENDING.** The seven end-to-end scenarios (capture → reconcile
log → propose/confirm → drift → shelf save/use → Account Read incl. empty-track-record SELF-03 path →
flat-warm/cream-not-coral visual pass) require a live driven session against the pushed schema with a
real `APIFY_TOKEN` + `CRON_SECRET`. This surfaces as the phase-verification human-needed UAT
(`/gsd-verify-work 10`).

## Deviation (Rule 3, surfaced)

**Push mechanism.** The plan specified `supabase db push` (CLI). The owner elected to push via the
Supabase MCP `apply_migration` tool instead (same end state — additive tables live + typed). The
non-autonomous gate was honored: the live mutation was owner-confirmed before execution.

## Cross-plan regression fixed

The post-merge engine gate (Task 2) surfaced a failure NOT visible to any single plan's self-check:
Plan 10-04 mounted `SaveAffordance` (→ `useSaveItem` → `useQueryClient`) on hook cards, which broke
the pre-existing `hook-test-handoff.test.tsx` (it rendered `HookCardRenderer` with no
`QueryClientProvider`). Fixed with a `renderWithClient` helper mirroring the repo's established
test-wrapper pattern; all 10 tests green. This is exactly the merge-time integration blind spot the
gate exists to catch.

## Carry-forward for UAT (Task 3 / verify-work)

- **apidojo single-post field names unverified live.** `scrapeSinglePostMetrics` targets
  `apidojo/tiktok-scraper-api` (Single Post Query tier) with `startUrls` input + `bookmarks→saves`
  remap, unit-tested but not live-probed (no token at build time). UAT must confirm the real
  `startUrls`/`bookmarks` field names against a live token and adapt the remap if the dataset
  version differs.
- **`pinPredictedSignature` runner wiring.** The pin seam (10-03) is built + unit-tested; wiring the
  call into each tool runner's post-SIM point is a follow-up integration to validate in UAT.
- **Drift composition-shift detection (10-06).** The drift PATH is complete (writes `drift_scrape`
  row, folds into reconcile/gate/propose), but `hasShift` rarely fires until calibration derives real
  composition from scraped signals — an engine-side calibration-math change out of P10 scope.
- **`patterns.dropPoints` (10-05).** Ships `[]` in v1 ("— none detected yet", never fabricated);
  `analysisHistory` enrichment seam reserved.

## Self-Check: PASSED

- [x] Three tables live on Supabase; `database.types.ts` includes them; no `TODO(10-07)` casts remain
- [x] `outcomes` table untouched (Pitfall 1)
- [x] `npm run build` green against regenerated types
- [x] Full suite green (2823 passed); ENGINE_VERSION unchanged; no scoring-source mutation; General-unchanged anchor green
- [ ] End-to-end live UAT (Task 3) — pending `/gsd-verify-work 10`
