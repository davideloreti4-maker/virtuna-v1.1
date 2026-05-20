---
gsd_state_version: 1.0
milestone: engine-foundation
milestone_name: Engine Foundation
status: planning
stopped_at: Phase 9 context gathered
last_updated: "2026-05-20T14:00:13.088Z"
last_activity: 2026-05-19 -- Phase 08 merged into milestone
progress:
  total_phases: 12
  completed_phases: 8
  total_plans: 41
  completed_plans: 41
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.
**Current focus:** Phase 09 — Platform Algo Fit + Self-Critique + Counterfactuals (next phase to plan; Phases 1-8 all executed and merged)

## Current Position

Phase: 9 (next to plan; Phases 1-8 complete)
Plan: Not started
Status: Ready to plan Phase 9 — depends on Phase 5/6/7/8 signals (all shipped)
Last activity: 2026-05-19 -- Phase 08 merged into milestone

Progress: [██████████████░░░░░░] 8 of 12 phases (67%) — 41 plans across executed phases

## Verification Debt (carry into Phase 9 cleanup pass)

- **Phase 2** — UAT deferred (never run)
- **Phase 3** — SC#4 + SC#5 DEFERRED-PENDING-LIVE-DEPLOY (post-deploy smoke tests)
- **Phase 4** — HUMAN-UAT partial: 2 live-API tests pending (end-to-end Wave 0 content-type via /api/analyze, niche-detector cost-cents > 0 with cache breakdown absent)
- **Phase 6** — Code review follow-ups: WR-04 (cron N+1), WR-05 (audio_description bounds nesting), IN-01 (video-analysis retry restructure), IN-02 (pgvector cast helper), IN-03 (sound_url SSRF allowlist — Phase 12 threat model T-06-13)
- **Pre-existing** — 966 TypeScript errors in src/app/api/{profile,settings,team}/* reference a `user_settings` table that doesn't exist in live Supabase (surfaced when Plan 06-02 regen'd types). Either write the migration or rip out the consumers. Out of any single phase scope but blocks any clean `tsc --noEmit` run.

## Phase 02 Plan Status

- ✓ 02-01 Schema migration + Wave 0 test scaffolds (migration applied to live DB via Studio SQL editor in Plan 02-06 Task 2)
- ✓ 02-02 Niche taxonomy module + tests
- ✓ 02-03 Nine card-picker components (Cards 0-8)
- ✓ 02-04 ProfileInterviewModal + Zustand store + gate hook + content-form interception
- ✓ 02-05 Settings 6th tab + ProfileSettingsForm + TanStack hooks + new API route + welcome trim
- ✓ 02-06 Engine integration + reference-creator side-effect + e2e + supabase migration applied
  - ✓ Task 1 (642f4ba) addCompetitor source-aware + Card 5 fire-and-forget wired in profile-interview-store
  - ✓ Task 2 (user-applied via Studio SQL editor + types regen 39cadb3) live DB has 14 new columns + user_competitors.source
  - ✓ Task 3 (74ca923) engine CreatorContext extension + 4 active vitest assertions
  - ✓ Task 4 (d2c506f) Playwright e2e activation + REQUIREMENTS.md PROFILE-16 annotation + 19-row Traceability table

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
- [Phase 08]: Phase 8 Plan 02: Locked Zod contracts for RetrievalEvidenceItem (D-02 16-field shape) and BenchmarkRetrievalResult before any Plan 03-05 implementation — Interface-first task — every downstream plan imports these types; locking them in one place prevents drift on field names/types across the parallel implementation plans.
- [Phase 08]: Phase 8 Plan 02: SignalAvailability + PredictionResult extended additively; 13 expected cross-plan TS errors are the intentional compile-time gate Plan 04 must close — Per plan <done> note — aggregator.ts + aggregator.test.ts literal SignalAvailability objects are missing the new retrieval key by design. This is the working-as-intended mechanism that prevents Plan 04 from silently omitting the new field.
- [Phase ?]: [Phase 08]: Plan 03: Gemini embedding model upgraded to gemini-embedding-001 with outputDimensionality 768 (RESEARCH Finding 1, supersedes deprecated text-embedding-004)
- [Phase ?]: [Phase 08]: Plan 03: NON_CORPUS_ENGAGEMENT_PERCENTILES shipped as 0/0 placeholders for all 5 non-calibrated niches (tech-gadgets, gaming, fashion-style, music-performance, food-cooking); Plan 05 backfill overwrites with real P80/P40; deriveBucket falls back to 'average' until then
- [Phase ?]: [Phase 08]: Plan 03: Soft re-ranker hashtag-overlap bonus applies to rerank_score (sort key) only; original similarity field NEVER mutated — preserves D-02 persistence integrity so D-03 bucket-vote denominator uses original cosine score

### Pending Todos

- Spawn gsd-verifier for Phase 01 sign-off
- Phase 02 (Creator Profile) can begin independently
- Phase 03 (Pipeline Infrastructure) can begin after verifier sign-off
- **[DEFERRED]** Stage 2 corpus-video persistence — migration `20260512010000_corpus_videos_storage.sql` + `scripts/upload-corpus-videos.ts` are written and committed but NOT pushed to remote Supabase. Blocked on free-tier limits (50 MB per-file cap, 1 GB project Storage cap; corpus is 1.68 GB with 2 files >50 MB). Run after upgrading tier OR when video-mode eval is actually needed (Phase 10/12 per 01-05 SUMMARY deferral). 222/225 mp4s already on disk at `.planning/videos-cache/` (1.68 GB, gitignored).
- **[RESOLVED 2026-05-19]** Phase 06 SC#1 live Gemini audio smoke test — script `scripts/smoke-test-gemini-audio.ts` ran against 3 fixtures repurposed from `.planning/videos-cache/` (Phase 01 corpus). 12/12 validation gates passed; Gemini cleanly distinguished talking_head (98% voiceover, 0% music) from music_heavy (60/40) and slideshow (14% voiceover, 85% music); ratios sum to 1.0 on each; descriptions 139-153 chars (within 50-150 target). D-A1 reliability assumption empirically validated. See 06-HUMAN-UAT.md Item 1 + `tests/fixtures/audio-smoke/smoke-test-results.json` (gitignored).
- **[RESOLVED 2026-05-19]** Phase 06 HUMAN-UAT — all 3 items passed. (1) Smoke test 12/12 gates pass (see 06-01-SUMMARY.md Smoke Test Resolution). (2) Backfill ran clean against 3 seeded rows after polling defect was fixed (commit 5ab6bdf — `Gemini Files API not in ACTIVE state` → `PROCESSING→ACTIVE` poll added to both backfill script + cron route; mirrors smoke test + gemini.ts pattern). (3) E2E driver `scripts/e2e-uat-phase6.ts` exercised live runPredictionPipeline + aggregateScores; happy-path run showed audio_perceptual_score=86, audio_fingerprint matched at similarity=0.918, audio_description=118c semantically correct. Two retry runs hit Gemini API transience and validated D-G2 graceful degradation (signal_availability accurately reported audio=false, no crash). See `.planning/phases/06-audio-analysis-fingerprint-matching/06-HUMAN-UAT.md`.
- **[PHASE 06 FOLLOW-UP]** Code-review WR-04 from `06-REVIEW.md`: the cron route `src/app/api/cron/calculate-trends/route.ts` does an N+1 idempotency check (per-row `SELECT` inside the embedding loop). Refactor to a single bulk pre-fetch of already-embedded sound_names before the batch loop. Performance nicety at current scale (~50 sounds/day) but worth addressing before the cron frequency increases.
- **[PHASE 06 FOLLOW-UP]** Code-review WR-05 (audio_description bounds nesting), IN-02 (centralize `vector as unknown as string` cast into `src/lib/supabase/pgvector.ts`), IN-03 (sound_url SSRF allowlist — Phase 12 hardening per threat model T-06-13). All non-blocking; tracked here so they don't get lost.
- **[PHASE 06 FOLLOW-UP]** IN-01 partial-fix landed in 5dec5a3 (text-analysis retry loop). The video-analysis path in `analyzeVideoWithGemini` (gemini.ts ~lines 515-535) has the same `clearTimeout` only-on-success pattern but it's a single try/catch rather than a retry loop — restructure into try/finally when convenient. Same harmless-but-wasteful semantics.
- **[PHASE 06 FOLLOW-UP]** Pre-existing 966 TypeScript errors in `src/app/api/profile/*`, `src/app/api/settings/*`, `src/app/api/team/*` reference a `user_settings` table that does NOT exist on the live Supabase project (`qyxvxleheckijapurisj` / virtuna-v1.1). Surfaced when Plan 06-02 regenerated `src/types/database.types.ts` from the live schema — the local types had a hand-patched `user_settings` table that diverged. Either (a) write a migration to actually create the table, or (b) rip out the user_settings consumers in the API routes. Out of Phase 6 scope but blocks any future fresh `tsc --noEmit` clean run.

### Blockers/Concerns

- **[RESOLVED]** Apify FREE plan exhausted → APIFY_ACTOR_LEGACY=clockworks fallback used for full.2026-05-11 scrape
- **[CARRY-FORWARD]** apidojo Starter plan still needs activation for future corpus refreshes (Phase 4+ scraping)
- **[CARRY-FORWARD]** completion_pct = null on all 225 rows (KNOWN GAP — no Apify actor provides watch-time data)
- **[CARRY-FORWARD]** Whop plan IDs still need creation in Whop dashboard — not blocking Phase 01 or 02
- **[CARRY-FORWARD]** Supabase free-tier blocks Stage 2 corpus-video upload (see Pending Todos)

## Session Continuity

Last session: 2026-05-20T14:00:13.084Z
Stopped at: Phase 9 context gathered
Next action: `/gsd-discuss-phase 4` or `/gsd-plan-phase 4` to start Wave 0 — Content Type + Niche Detection. All of Phases 5, 6, 7, 8 are now in trunk.

Resume command: `cd ~/virtuna-engine-foundation && /gsd-progress`

## Plan 02-06 Decisions (extracted from SUMMARY key-decisions)

- User applied migration via Supabase Studio SQL editor rather than `npx supabase db push` (operator workflow; equivalent outcome — plan's `<how-to-verify>` already lists Studio SQL editor as documented alternative)
- JSONB columns type-cast at the read boundary in `fetchCreatorContext` rather than re-parsed with zod (write-path zod in `creator-profile.ts` is the only ingress; cast pattern matches existing aggregator.ts ENGINE_VERSION pattern)
- `posting_frequency` reuses existing CreatorContext field name but source changes from "null derived" to "profile column"; null is the explicit fallback when Card 7 unfilled
- Null-guarded formatter blocks live AFTER `platform_averages`, NOT inside `if (ctx.found)` — preserves D-20 (found tracks scraped record; profile fields are independent)
- Past wins/flops surface as COUNTS only in prompt output (T-02-01 prompt-injection mitigation; URLs never reach LLM)
- No per-test `seen_at` reset hook in e2e — sequential ordering accepted for M1; documented inline in spec

## Phase 03 Decisions (extracted from SUMMARYs)

- Migration applied via Supabase Studio SQL editor (CLI unlinked in worktree); database.types.ts hand-patched with signal_availability + content_hash
- Plan 03-04 Task 5 (post-deploy smoke tests) DEFERRED — re-run after next Vercel deploy to flip SC#4 + SC#5 from DEFERRED to MET
- Phase 3 SCs: #1, #2, #3, #6 MET in code (549/0 tests). #4, #5 DEFERRED-PENDING-LIVE-DEPLOY
- ENGINE_VERSION moved to dedicated leaf module `src/lib/engine/version.ts` (`"3.0.0-dev"`); re-exported from aggregator.ts for backwards compat
- Two-tier prediction cache (L1 in-memory + L2 Supabase analysis_results) keyed by `${contentHash}::${ENGINE_VERSION}::${userId}` — SHA-256, bypass option for eval harness
- /api/analyze adds Accept-header content negotiation (SSE default, JSON on `application/json`) + Vercel route segment config (force-dynamic, maxDuration=300, X-Accel-Buffering: no)
