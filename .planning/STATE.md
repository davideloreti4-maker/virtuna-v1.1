---
gsd_state_version: 1.0
milestone: engine-foundation
milestone_name: Engine Foundation
status: executing
stopped_at: Block A complete — awaiting operator to provide Apify Starter APIFY_TOKEN for live scrape (Block B)
last_updated: "2026-05-11T11:15:00.000Z"
last_activity: 2026-05-11 -- 01-06 Block A complete — apidojo migration + orchestrator split + calibration module + 4-mode CLI
progress:
  total_phases: 12
  completed_phases: 0
  total_plans: 7
  completed_plans: 5
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.
**Current focus:** Phase 01 — training-corpus-eval-foundation

## Current Position

Phase: 01 (training-corpus-eval-foundation) — EXECUTING
Plan: 01-06 (code refactored, awaiting operator for live scrape — Block B)
Status: Block A complete; Block B awaiting Apify Starter token + operator smoke test approval
Last activity: 2026-05-11 -- 01-06 Block A — apidojo migration committed (7 commits)

Progress: [███████░░░] 71%

## Completed (this session)

- ✓ Wave 1 (01-01, 01-02, 01-03) — Supabase tables, pure-function metrics, Apify infra primitives (parallel worktrees)
- ✓ Wave 2 (01-04, 01-05) — Corpus orchestrator + CLI, eval harness + measureV21Baseline (sequential — package.json overlap)
- ✓ Wave 3 Block A (01-06 code refactor, 2026-05-11):
  - Migrated apify-jobs.ts from clockworks (~$3.70/1K) to apidojo (~$0.30/1K) — ~12× cheaper
  - Split orchestrator into scrapeRawToCache() + bucketAndPersist() + JSONL cache helpers
  - Added calibration.ts pure-function module + scripts/calibrate-thresholds.ts CLI
  - Extended build-corpus.ts with 4 modes: --smoke | --scrape | --calibrate | --build
  - Rewrote 01-06-PLAN.md and 01-07-PLAN.md for the new apidojo + scrape-big + baseline-small strategy
  - 262 tests pass; 0 TypeScript errors in production code
  - 7 commits: 1ccbb0c, a54f856, b1fb5f2, 4616be3, b7c5936, 2cb72fd, 24446c2

## In Progress (Wave 3 Block B — awaiting operator)

01-06 Block B requires:
1. **Valid Apify Starter APIFY_TOKEN in .env.local**
   - Verify: `node -e "require('dotenv').config({path:'.env.local'});const{ApifyClient}=require('apify-client');new ApifyClient({token:process.env.APIFY_TOKEN}).user().get().then(r=>console.log('plan:',r.plan?.id,'maxUSD:',r.plan?.maxMonthlyUsageCreditsUsd))"`
   - Must show plan NOT "FREE"
2. **Smoke test:** `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --smoke`
3. **Broad scrape (~$5):** `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --scrape`
4. **Calibrate:** `npx tsx scripts/calibrate-thresholds.ts --version full.2026-05-12` + hand-paste code block into thresholds.ts
5. **Build:** `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --build`

## Pending (Wave 4)

- **01-07** (Wave 4): autonomous=false. v2.1 baseline on 500-video stratified subsample. Blocked by 01-06 Block B (needs corpus data in training_corpus).

## Performance Metrics

**Velocity (this session):**

- Plans completed: 5 of 7 (71%)
- Wave 1: 3 plans / ~11 min total (parallel)
- Wave 2: 2 plans / ~23 min (sequential, package.json overlap)
- Wave 3 Block A: 6 code steps / ~35 min (sequential, code-only migration)

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

Phase 01 decisions discovered during 01-06 Block A:

- 01-03 deviation: `Niche` type defined locally in `apify-jobs.ts` because 01-02's `eval-config.ts` didn't exist in the wave 1 worktree. Identical string-literal unions; will need a consolidation follow-up post-phase.
- 01-06 first-attempt failure: Apify FREE plan ($5/mo) is insufficient for a full 50-video pilot. Starter plan or higher required.
- Pitfall 2 confirmed severe: only 1.7% of scraped items fall below the D-08 under ceiling. Under bucket cannot fill from trending feeds without raising `resultsPerPage`.
- **apidojo migration decision (Block A, 2026-05-11):** Switched from clockworks (~$3.70/1K) to apidojo (~$0.30/1K) — ~12× cheaper. Enables 25K raw items for ~$5 vs $90+ with clockworks.
- **Two-phase orchestrator split:** scrapeRawToCache() + bucketAndPersist() with JSONL cache between. Enables calibrate-between-phases workflow required by D-09.
- **Scrape volume strategy:** 25K raw across 5 niches → ~6-15K labeled (after filters). 500-video baseline uses stratified subsample (seed=42) to keep cost ~$1-3 DeepSeek.

### Pending Todos

- 01-06 Block B once Apify Starter token confirmed
- 01-07 after 01-06 Block B produces real corpus data
- Post-phase: spawn gsd-verifier, run phase completion gate

### Blockers/Concerns

- **[ACTIVE BLOCKER] Apify account still on FREE plan.** Must provide new Apify Starter+ token in `.env.local`. Previous attempts hit $5 quota.
  - Code migration (Block A) is complete — no clockworks references remain in production code
  - apidojo costs ~12× less, so the same $5 now buys ~33× more data
- Whop plan IDs still need creation in Whop dashboard (carries forward from MVP Launch milestone) — not blocking M1 work

## Session Continuity

Last session: 2026-05-11 (Phase 01 Block A complete — code migration only, no live calls)
Stopped at: Block A complete — awaiting operator to provide Apify Starter APIFY_TOKEN for Block B
Resume command: `cd ~/virtuna-engine-foundation && /gsd-execute-phase 01`

**Fresh-session resume notes (Block B):**

- Block A code is committed (HEAD: 24446c2). All 262 tests pass.
- **FIRST: Verify Apify plan is Starter or higher** (not FREE):
  ```bash
  node -e "require('dotenv').config({path:'.env.local'});const{ApifyClient}=require('apify-client');new ApifyClient({token:process.env.APIFY_TOKEN}).user().get().then(r=>console.log('plan:',r.plan?.id,'maxUSD:',r.plan?.maxMonthlyUsageCreditsUsd))"
  ```
  Must show plan.id NOT "FREE". If still FREE, STOP — ask user to provide new token.
- Run smoke test to verify apidojo integration: `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --smoke`
- Run broad scrape (~$5): `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --scrape`
- Run calibration: `npx tsx scripts/calibrate-thresholds.ts --version full.2026-05-12`
- Operator reviews calibration output and hand-pastes threshold block into thresholds.ts
- Run build: `npx tsx scripts/build-corpus.ts --version full.2026-05-12 --build`
- training_corpus should have 0 rows until Block B completes (both previous attempts blocked by quota).
- SUMMARY: 01-06-SUMMARY.md already exists in `.planning/phases/01-training-corpus-eval-foundation/`
