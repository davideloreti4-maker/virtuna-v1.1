# Roadmap — MVP Cut

**Branch:** `milestone/mvp-cut`
**Worktree:** `~/virtuna-mvp-cut/`
**Phase range:** 1–6 (milestone-scoped numbering)
**Forks from:** `main` post-PR-#3 + PR-#4 merges

## Strategy

Cut the runtime surface to MVP minimum, fix the visible bugs that Result Surface handed forward, and finish with a regression + cross-browser pass plus one end-to-end happy-path Playwright test. Three middle phases (2, 3, 4) are independent and can fork in parallel from the milestone branch. Phase 5 needs Phases 2–4 visible on screen. Phase 6 sequences last.

## Parallelization Plan

```
        main (post-#3, post-#4)
              │
              ▼
         Phase 1 (sequential — strip retrieval / similar videos / /trending)
              │
   ┌──────────┼──────────┐
   │          │          │
Phase 2    Phase 3    Phase 4       (parallelizable — independent surfaces)
   │          │          │
   └──────────┼──────────┘
              │
         Phase 5 (needs 2–4 visible)
              │
              ▼
         Phase 6 (pre-ship audit)
```

Phase 0 is a scope-statement phase that lives entirely inside this ROADMAP — no code, no separate `phases/00-*` directory. It captures the Phase-8 keep/defer split below so the mobile + onboarding work in Phase 5 has a frozen reference.

## Phase 0: Phase-8 Keep / Defer Split (this section)

Out of the old `phase-8-launch-polish-and-onboarding` package, the MVP cut keeps the items that move signup → first-useful-prediction → act. Polish, telemetry, and accessibility audits get deferred to a post-MVP milestone.

**Keep (rolled into Phase 5):**

| Old ID | Item |
|--------|------|
| 8.1 | Mobile board layout |
| 8.2 | Mobile upload flow |
| 8.3 | Mobile audience touch interaction (Radix Sheet drawer) |
| 8.5 | First-analysis tutorial |
| 8.7 | Next-action prompts |
| 8.9 | Regression audit (run inside Phase 6 instead — kept here for traceability) |
| 8.12 | Cross-browser smoke (run inside Phase 6 instead — kept here for traceability) |

**Defer (out of MVP):**

- Orientation tooltip polish
- Paced verdict reveal
- Full telemetry instrumentation
- Lighthouse 90+ target
- Full WCAG AA audit

## Phase 1: Strip Retrieval + Similar Videos + /trending Dashboard

**Goal:** Remove all M2-corpus-dependent surfaces from the runtime. Ingestion side stays intact for a future corpus milestone.

**Depends on:** Nothing (forks directly from milestone base).

**Scope:**

- Delete `SimilarVideosCard` from board substrate
- Remove retrieval reads from `/api/analyze` pipeline (keep `scraped_videos` writes, scraper cron, trend enrichment)
- Delete `/trending` dashboard page (Next.js route) + `/api/trending/*` routes + supporting client code
- Keep `scraped_videos`, `trending_sounds`, scraper cron, and trend-enrichment-into-analyze pipeline UNTOUCHED
- Embedder code stays in the repo (dormant) — Phase 1 only removes its runtime call sites

**Success Criteria:**

1. `grep -r "SimilarVideosCard"` returns zero src/ hits
2. `grep -r "/api/trending"` returns zero src/ hits
3. `grep -r "/dashboard/trending\|trending-dashboard"` returns zero src/ hits
4. `/api/analyze` still writes `scraped_videos` and reads `trending_sounds` for trend enrichment
5. `pnpm build` green, `tsc --noEmit` 0 errors, `pnpm test` green

## Phase 2: Wire Hook Decomposition + Emotion Arc End-to-End

**Goal:** Replace the null-fallback path in `aggregator.ts:686-693` with the real hook decomposition + emotion arc emission, and surface both in board nodes.

**Depends on:** Nothing (parallel with 3, 4).

**Scope:**

- Audit the half-wired aggregator path; emit real `hook_decomposition` + `emotion_arc` instead of null fallback
- Confirm board nodes consume both fields and render correctly (no card placeholders)
- Tests: aggregator unit coverage for the populated path; component test that the card renders with real data shape

**Success Criteria:**

1. `aggregator.ts:686-693` no longer returns null-shaped hook_decomposition / emotion_arc on the happy path
2. Verdict node or hook-specific node renders the populated decomposition without "(unavailable)" copy
3. New aggregator unit tests cover the populated path

## Phase 3: Fix Orphaned Video Storage

**Goal:** Eliminate the upload → orphan storage object failure mode confirmed on analysis `-I4GtlGVCQKO`.

**Depends on:** Nothing (parallel with 2, 4).

**Scope:**

- Diagnose: retention cron timing OR upload → insert race (Phase opens with a 1-day diagnosis pass)
- Apply the fix that matches root cause:
  - If retention cron timing: tighten window, add an idempotency check
  - If upload → insert race: serialize storage insert behind analysis row creation, or move to a single transactional path
- Add a regression test or observability hook that would have caught the orphan

**Success Criteria:**

1. Root cause documented in a phase artifact (RESEARCH.md or DECISION.md)
2. Fix lands with a test that fails before the fix and passes after
3. A re-run of the original orphan repro (or its closest reproducible simulation) produces zero orphaned objects

## Phase 4: Schema Drift Fix

**Goal:** Persist the four columns the engine emits but the DB doesn't store. Revert the script-route inline workaround.

**Depends on:** Nothing (parallel with 2, 3) — coordinates with Phase 2 if hook_decomposition column shape ends up depending on Phase 2's data structure.

**Scope:**

- Migration: add `counterfactuals`, `hook_decomposition`, `confidence_label`, `anti_virality_gated` to `analysis_results` (column types finalized inside the phase)
- Regenerate `database.types.ts` from live schema
- Update `buildInsertRow` (and any sibling insert builders) to persist the four columns
- Revert the script-route workaround (the inline column-drop + label derivation landed 2026-05-28)
- Backfill strategy (or explicit "no backfill — null is fine" decision) documented

**Success Criteria:**

1. Migration applied to remote Supabase project
2. `database.types.ts` regenerated; no hand-patched types
3. `analysis_results` rows persisted by `/api/analyze` contain non-null values for the four columns on a fresh test analysis
4. Script route SELECTs the persisted columns directly (no inline derivation)
5. `pnpm build` + `tsc --noEmit` + `pnpm test` green

## Phase 5: Mobile + Onboarding

**Goal:** Land the 7 Phase-8 items kept above so first-time users on mobile and desktop both complete signup → first analysis → next action without friction.

**Depends on:** Phases 2, 3, 4 visible (engine emits the right fields, no orphans, schema persists).

**Scope (each item is a plan inside this phase):**

- 5.1 Mobile board layout (≡ old 8.1)
- 5.2 Mobile upload flow (≡ old 8.2)
- 5.3 Mobile audience touch interaction (≡ old 8.3)
- 5.4 First-analysis tutorial (≡ old 8.5)
- 5.5 Next-action prompts (≡ old 8.7)

**Success Criteria:**

1. Mobile board renders without horizontal scroll on iOS Safari + Chromium Android
2. Mobile upload flow completes a video upload from device gallery → analysis end-to-end
3. Audience node mobile drawer (Radix Sheet) accepts touch interaction across populated heatmap slots
4. First-analysis tutorial fires once on first signup, never again, and is dismissible
5. Next-action prompts appear post-verdict and route to the corresponding board node / script

## Phase 6: Pre-Ship Regression + E2E

**Goal:** One pass that closes the door on ship — regression audit, cross-browser smoke, one end-to-end Playwright happy-path test in CI.

**Depends on:** Phases 1, 2, 3, 4, 5 all merged.

**Scope:**

- 6.1 Regression audit (≡ old 8.9): walk every primary surface for regressions introduced by the cut
- 6.2 Cross-browser smoke (≡ old 8.12): Chromium + WebKit smoke on auth, upload, analysis, board, script, optimal-post
- 6.3 E2E happy-path Playwright test: signup → upload → wait for analysis complete → assert verdict node populated + reshoot script accessible

**Success Criteria:**

1. Regression audit report lists every surface checked and the outcome
2. Cross-browser smoke passes on Chromium + WebKit in CI (mobile + desktop viewports)
3. Happy-path E2E test merged into `e2e/` and green in CI for 3 consecutive runs
4. No P0 / P1 issues open in MILESTONE.md carryover list

---

## Execution Order

| Phase | Title | Depends on | Status | Notes |
|-------|-------|-----------|--------|-------|
| 0 | Phase-8 keep/defer split | — | Done (this doc) | No code, frozen here |
| 1 | Strip retrieval + similar videos + /trending | — | Pending | Sequential, first |
| 2 | Wire hook decomposition + emotion arc | 1 | Pending | Parallel with 3, 4 |
| 3 | Fix orphaned video storage | 1 | Pending | Parallel with 2, 4 |
| 4 | Schema drift fix | 1 | Pending | Parallel with 2, 3 |
| 5 | Mobile + onboarding | 2, 3, 4 | Pending | Needs 2–4 visible |
| 6 | Pre-ship regression + E2E | 1, 2, 3, 4, 5 | Pending | Last |
