---
gsd_state_version: 1.0
milestone: engine-foundation
milestone_name: Engine Foundation
status: executing
stopped_at: Phase 3 context gathered
last_updated: "2026-05-17T20:02:42.720Z"
last_activity: 2026-05-17 -- Phase 03 execution started
progress:
  total_phases: 12
  completed_phases: 1
  total_plans: 11
  completed_plans: 7
  percent: 64
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.
**Current focus:** Phase 03 — pipeline-infrastructure

## Current Position

Phase: 03 (pipeline-infrastructure) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 03
Last activity: 2026-05-17 -- Phase 03 execution started

Progress: [██████████] 100% (Phase 01 plans)

## Completed (Phase 01)

- ✓ Wave 1 (01-01, 01-02, 01-03) — Supabase tables, pure-function metrics, Apify infra primitives (parallel worktrees)
- ✓ Wave 2 (01-04, 01-05) — Corpus orchestrator + CLI, eval harness + measureV21Baseline (sequential — package.json overlap)
- ✓ Wave 3 (01-06 Block A + Block B, 2026-05-11):
  - Block A: Migrated apify-jobs.ts to apidojo + APIFY_ACTOR_LEGACY=clockworks fallback; split orchestrator; added calibration.ts + calibrate-thresholds.ts CLI; extended build-corpus.ts to 4 modes
  - Block B: Broad scrape via clockworks FREE-tier (~$5 Apify) → 930 raw → 568 quality-filtered → 238 after 180-day recency filter → 225 upserted
  - 180-day recency ceiling fix committed (7540a96) — clockworks silently ignored oldestPostDate
  - Sealed full.2026-05-11 threshold snapshot (D-09 calibrated, D-13 immutable) at commit 7b2a8db
- ✓ Wave 4 (01-07, 2026-05-11):
  - v2.1 baseline run on 225-row corpus — ~$0.33 LLM cost, ~1h 56min wall time
  - Persisted canonical D-20 row to benchmark_results (row id: 3f6e8e28-38b1-41fb-b439-80fe9de76654)
  - Authored .planning/research/v2.1-baseline.md (full documentation with methodology + limitations)
  - Added BASELINE_REFERENCE_DOC constant to eval-config.ts (D-19 closure)

## D-20 Baseline Numbers (Phase 01 deliverable)

| Metric | Value |
|---|---|
| macro_f1 | 0.294 |
| ece | 0.372 |
| viral_recall | 0.106 |
| under_precision | 0.425 |
| rows_processed | 225 (1 failed) |
| cost_cents_total | 32.99 (~$0.33 USD) |

**v3 acceptance target (D-18):** macro_f1 ≥ 0.338 (15% relative improvement)
**Benchmark_results row id:** 3f6e8e28-38b1-41fb-b439-80fe9de76654

## Performance Metrics

**Velocity (Phase 01):**

- Plans completed: 7 of 7 (100%)
- Wave 1: 3 plans / ~11 min total (parallel)
- Wave 2: 2 plans / ~23 min (sequential, package.json overlap)
- Wave 3 Block A: 6 code steps / ~35 min (sequential, code-only migration)
- Wave 3 Block B: ~5h total (live scrape + calibrate + build operations)
- Wave 4: ~2h 30min (eval run + documentation)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table and the milestone summary at top of PROJECT.md.

Milestone-start decisions:

- Two-milestone split: Engine Foundation (this) → Intelligence Surface (next). Enabled by training-corpus insight that lets us measure engine accuracy without waiting for users to post content.
- Engine extension is **additive only** — no rewrite of existing `pipeline.ts` or `aggregator.ts`. New stages slot into existing wave pattern (Wave 0 added; Wave 3 added for personas; Stage 10 critique; Stage 11 counterfactuals).
- Video segmentation via **native Gemini `videoMetadata`** (no ffmpeg). Single Files API upload, parallel scoped calls.
- Gemini mix: 2.5 Pro on hook segment (0-3s), 2.5 Flash on body + CTA.
- Personas: 10 on `deepseek-chat` V3, FYP-weighted (6 FYP + 2 niche + 1 loyalist + 1 cross-niche) — TikTok pushes mostly to non-followers via FYP, so persona allocation must reflect this.
- Pipeline gains optional `onStageEvent` callback for SSE — no event-emitter rewrite needed.
- Outcome learning loop is **no longer deferred** — training corpus enables it as the foundation, not a future phase.
- Acceptance gate: engine v3 must demonstrate measurable accuracy improvement vs v2.1 baseline on corpus before milestone ships.

Phase 01 decisions:

- apidojo migration complete but running on clockworks FREE-tier (APIFY_ACTOR_LEGACY=clockworks) because apidojo requires Starter plan. Migration code is production-ready.
- 180-day recency ceiling added to normalize-scrape.ts (permanent fix, both actor paths).
- Comedy bucket compression (2.88× separation) accepted as genuine distribution.
- v2.1 baseline result: macro_f1=0.294 — BELOW random chance (0.333). Score has zero Spearman correlation with actual views within any niche.
- All 10 failure_cases are under→viral (severity=2): systematic rule-scoring over-credit.
- v3 acceptance target: macro_f1 ≥ 0.338 (D-18 15% relative improvement).

### Pending Todos

- Spawn gsd-verifier for Phase 01 sign-off
- Phase 02 (Creator Profile) can begin independently
- Phase 03 (Pipeline Infrastructure) can begin after verifier sign-off
- **[DEFERRED]** Stage 2 corpus-video persistence — migration `20260512010000_corpus_videos_storage.sql` + `scripts/upload-corpus-videos.ts` are written and committed but NOT pushed to remote Supabase. Blocked on free-tier limits (50 MB per-file cap, 1 GB project Storage cap; corpus is 1.68 GB with 2 files >50 MB). Run after upgrading tier OR when video-mode eval is actually needed (Phase 10/12 per 01-05 SUMMARY deferral). 222/225 mp4s already on disk at `.planning/videos-cache/` (1.68 GB, gitignored).

### Blockers/Concerns

- **[RESOLVED]** Apify FREE plan exhausted → APIFY_ACTOR_LEGACY=clockworks fallback used for full.2026-05-11 scrape
- **[CARRY-FORWARD]** apidojo Starter plan still needs activation for future corpus refreshes (Phase 4+ scraping)
- **[CARRY-FORWARD]** completion_pct = null on all 225 rows (KNOWN GAP — no Apify actor provides watch-time data)
- **[CARRY-FORWARD]** Whop plan IDs still need creation in Whop dashboard — not blocking Phase 01 or 02
- **[CARRY-FORWARD]** Supabase free-tier blocks Stage 2 corpus-video upload (see Pending Todos)

## Session Continuity

Last session: 2026-05-17T19:13:31.490Z
Stopped at: Phase 3 context gathered
Next action: `cd ~/virtuna-engine-foundation && /gsd-plan-phase 02`
