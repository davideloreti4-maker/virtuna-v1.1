---
gsd_state_version: 1.0
milestone: engine-foundation
milestone_name: Engine Foundation
status: executing
stopped_at: Awaiting valid Apify Starter APIFY_TOKEN — current token is FREE plan (maxMonthlyUsageCreditsUsd=$5, exhausted)
last_updated: "2026-05-11T07:35:00.000Z"
last_activity: 2026-05-11 -- 01-06 attempt 2 — found FREE plan token, fixed 2 bugs, 0 rows persisted
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
Plan: 1 of 7
Status: Executing Phase 01
Last activity: 2026-05-11 -- Phase 01 execution started

Progress: [███████░░░] 71%

## Completed (this session)

- ✓ Wave 1 (01-01, 01-02, 01-03) — Supabase tables, pure-function metrics, Apify infra primitives (parallel worktrees)
- ✓ Wave 2 (01-04, 01-05) — Corpus orchestrator + CLI, eval harness + measureV21Baseline (sequential — package.json overlap)

## In progress (Wave 3) — 01-06 attempt 2 findings

- 01-06 attempt 2 (2026-05-11): discovered APIFY_TOKEN in `.env.local` is for FREE plan account (`trusty_sleep`/`miniprojectors6@gmail.com`). Confirmed via Apify user API: `plan.id: "FREE"`, `maxMonthlyUsageCreditsUsd: 5`. Operator reported upgrading to Starter but the account API confirms it is still FREE.
- Auto-fixed (attempt 2): tsconfig-paths missing runtime dependency — installed via `pnpm add tsconfig-paths` (commit `8261876`).
- Auto-fixed (attempt 2): orchestrator ON CONFLICT batch dedup bug — PostgreSQL throws "cannot affect row a second time" when same platform_video_id appears twice in upsert batch. Fixed by deduplicating on platform_video_id before upsert (commit `8261876`).
- Pre-mitigation done: `resultsPerPage` for under configs bumped 80→200 (commit `60a33d9`). Confirmed improved under fill (26→39 items). However this accelerated quota consumption.
- Retrospective updated with attempt 2 data (commit `796a00b`).
- 0 rows in training_corpus after both attempts.

## Pending (Wave 3 + 4)

- **01-06 retry** (Wave 3): re-dispatch once valid Starter APIFY_TOKEN is in `.env.local`:
  - VERIFY plan upgrade: `node -e "require('dotenv').config({path:'.env.local'});const{ApifyClient}=require('apify-client');new ApifyClient({token:process.env.APIFY_TOKEN}).user().get().then(r=>console.log('plan:',r.plan?.id,'maxUSD:',r.plan?.maxMonthlyUsageCreditsUsd))"` — must show plan.id NOT "FREE"
  - Consider reverting under resultsPerPage from 200→100 to balance fill vs. quota on Starter plan — pilot needs ~$10-15 not ~$30+
  - Upsert dedup bug is already fixed — will persist rows on successful run
  - SUMMARY filename must be `01-06-SUMMARY.md`
- **01-07** (Wave 4): autonomous=false. Full corpus build + v2.1 baseline. Blocked by 01-06 (needs actual corpus data).

## Performance Metrics

**Velocity (this session):**

- Plans completed: 5 of 7 (71%)
- Wave 1: 3 plans / ~11 min total (parallel)
- Wave 2: 2 plans / ~23 min (sequential, package.json overlap)
- Wave 3: 1 failed attempt (~16 min) — work rescued, not counted

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

Phase 01 decisions discovered this session:

- 01-03 deviation: `Niche` type defined locally in `apify-jobs.ts` because 01-02's `eval-config.ts` didn't exist in the wave 1 worktree. Identical string-literal unions; will need a consolidation follow-up post-phase.
- 01-06 first-attempt failure: Apify FREE plan ($5/mo) is insufficient for a full 50-video pilot. Starter plan or higher required.
- Pitfall 2 confirmed severe: only 1.7% of scraped items fall below the D-08 under ceiling. Under bucket cannot fill from trending feeds without raising `resultsPerPage`.

### Pending Todos

- 01-06 retry once new Apify key is confirmed active
- 01-07 after 01-06 produces real corpus data
- Post-phase: spawn gsd-verifier, run phase completion gate

### Blockers/Concerns

- Whop plan IDs still need creation in Whop dashboard (carries forward from MVP Launch milestone) — not blocking M1 work
- Pro tier pricing review deferred — heavy-user worst case ~$190/mo at ~$0.065/analysis × 100/day
- **[ACTIVE BLOCKER] Apify account still on FREE plan.** Operator said upgrade to Starter done but API confirms plan.id="FREE". Must confirm upgrade applies to the account linked to the current APIFY_TOKEN (`miniprojectors6@gmail.com`). Alternatively, create a new Apify Starter account and update APIFY_TOKEN in `.env.local`.
- Note: even with quota restored, two bugs were found and fixed in attempt 2 (tsconfig-paths, upsert dedup) — these are committed and will not recur.

## Session Continuity

Last session: 2026-05-11 (Phase 01 waves 1–2 + 01-06 attempts 1 & 2)
Stopped at: Awaiting valid Apify Starter APIFY_TOKEN — current token is FREE plan (exhausted)
Resume command: `cd ~/virtuna-engine-foundation && /gsd-execute-phase 01`

**Fresh-session resume notes (attempt 3):**

- **FIRST: Verify Apify plan is Starter or higher** (not FREE):
  ```bash
  node -e "require('dotenv').config({path:'.env.local'});const{ApifyClient}=require('apify-client');new ApifyClient({token:process.env.APIFY_TOKEN}).user().get().then(r=>console.log('plan:',r.plan?.id,'maxUSD:',r.plan?.maxMonthlyUsageCreditsUsd))"
  ```
  Must show `plan: STARTER` (or higher) and `maxUSD: 49` (or higher). If still FREE, STOP — ask user to provide new token.
- Bugs already fixed in HEAD: tsconfig-paths installed, orchestrator upsert dedup fixed.
- under config resultsPerPage is 200 (bumped for Pitfall 2). Consider reverting to 100 to save Starter quota. See retrospective "Recommended Adjustments" section.
- Verify HEAD is `796a00b` (or a descendant) — `git log --oneline -3` should show that commit.
- training_corpus has 0 rows (both attempts blocked by quota).
- SUMMARY filename: must be `01-06-SUMMARY.md` in `.planning/phases/01-training-corpus-eval-foundation/`.
