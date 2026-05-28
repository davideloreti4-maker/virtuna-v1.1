# Milestone: MVP Cut

**Branch:** `milestone/mvp-cut`
**Worktree:** `~/virtuna-mvp-cut/`
**Started:** 2026-05-28
**Status:** Active
**Forks from:** `main` post-merge of PR #3 (result-surface @ 94b4663) + PR #4 (engine-hardening @ d772777)

## Purpose

Cut Virtuna down to the minimum surface a signed-up user needs to get their first useful prediction and act on it. Everything that depends on the M2 retrieval corpus, the /trending dashboard, or unshipped persistence machinery comes out of the runtime. The carryover bugs the Result Surface milestone left visible (schema drift, orphaned video storage, half-wired hook decomposition + emotion arc) get fixed under one banner so MVP ship can stand on green tests, persisted columns, and a clean E2E happy path.

This is a scope cut, not a redesign — Result Surface board substrate stays, engine pipeline stays, all model routing stays.

## Locked Decisions

- **User scope:** signed-up users only. Teams are not MVP-critical.
- **Dropped from MVP runtime:**
  - Similar videos card + retrieval reads
  - /trending dashboard page + `/api/trending/*` routes
  - Old Phase 7 "Share & Export" entirely
- **Kept (do not regress):**
  - `scraped_videos` + `trending_sounds` tables + scraper cron
  - Trend enrichment inside `/api/analyze` pipeline
  - Audio fingerprint (re-enabled after embedder unblock, currently dormant)
- **M2 corpus dependency:** rip retrieval / embedder / SimilarVideosCard from runtime; ingestion side stays intact so the M2 corpus milestone can pick it up later.

## Out of Scope (Deferred from old Phase 8)

- Orientation tooltip polish
- Paced verdict reveal
- Full telemetry instrumentation
- Lighthouse 90+ target
- Full WCAG AA audit

## Success Criteria

A signed-up user can:

1. Sign in, land on /analyze, upload a video (mobile or desktop)
2. Watch the engine pipeline complete with live audience heatmap, verdict, reshoot script, optimal post time — all populated from persisted columns, not derived workarounds
3. Read hook decomposition + emotion arc with real values (not null-fallback paths)
4. Not encounter orphaned video storage objects from their analysis
5. Complete one end-to-end happy-path Playwright run in CI without flakiness
6. Pass cross-browser smoke (Chromium + WebKit) on a regression audit before ship

## Carryover Acknowledgments (Inputs to this Milestone)

From Result Surface (handed forward, not blocking this milestone's start):

- Schema drift: `counterfactuals`, `hook_decomposition`, `confidence_label`, `anti_virality_gated` columns absent from `analysis_results`. Script route currently derives `confidence_label` inline.
- Orphaned video storage: analysis `-I4GtlGVCQKO` confirmed orphan; root cause is retention cron timing OR upload→insert race.
- Hook decomposition + emotion arc only half-wired (`aggregator.ts:686-693` path with null fallback).
- Audience headline chips fixed today (0-1 → 0-100 scaling).
- `videos/sign` returns 404 (not 500) for missing storage objects + logs.

## Test Posture Entry

`pnpm test`: 1619/1620 unit tests green on `main` at fork time (one flaky `Sidebar.recent.test.tsx`).
`tsc --noEmit`: clean.
