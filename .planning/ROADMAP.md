# Roadmap: Engine Foundation

## Overview

Twelve phases that build, train, and validate the content intelligence engine. **Phase 1 (training corpus + eval) is the foundation — every subsequent phase benchmarks against it.** Phases 2-8 build engine layers additively (no rewrite of existing pipeline.ts or aggregator.ts). Phase 9 extends aggregator + adds critique/counterfactuals. Phase 10 audits ML + trains calibration. Phase 11 wires existing UI. Phase 12 runs the acceptance benchmark — engine must demonstrate measurable accuracy improvement vs v2.1 baseline before milestone ships.

## Phase Numbering

Milestone-scoped, starts at 1.

## Wave Structure for Parallel Execution

```
Wave 1 (kickoff):    P1 (corpus + eval)  ║  P2 (profile + interview)
                            │                       │
Wave 2:              P3 (pipeline infra: events, versioning, caching)
                            │
Wave 3:              P4 (Wave 0: content type + niche detection)
                            │
Wave 4 (4-parallel): P5 (segmentation + hook decomp)
                     P6 (audio analysis + fingerprint)
                     P7 (multi-persona simulation)
                     P8 (benchmark retrieval / pgvector)
                            │
Wave 5:              P9 (algo-fit + critique + counterfactuals)
                            │
Wave 6:              P10 (ML audit + calibration + aggregator extension)
                            │
Wave 7:              P11 (existing UI integration + privacy policy)
                            │
Wave 8 (final gate): P12 (accuracy benchmark + acceptance)
```

## Phases

- [x] **Phase 1: Training Corpus & Eval Foundation** — Build labeled 500-video corpus + eval harness. Measure v2.1 baseline accuracy. Set target threshold. **Completed 2026-05-11 (pending verifier)**
- [x] **Phase 2: Creator Profile & 9-Card Interview** — `creator_profiles` schema, modal flow, settings edit, profile-aware `CreatorContext`. **Completed 2026-05-17 (pending verifier)**
- [x] **Phase 3: Pipeline Infrastructure** — `onStageEvent` callback, SSE infra in /api/analyze, engine versioning + provenance, caching layer (content hash + persona prompt + niche taxonomy). **Completed 2026-05-18 (PARTIAL — SC#4/#5 defer-smoke pending live deploy)**
- [x] **Phase 4: Wave 0 — Content Type + Niche Detection** — V3 classifier + hierarchical niche detector before Wave 1; drives downstream signal weighting. **Completed 2026-05-18 (5 plans: 3 planned + 2 gap-closure; HUMAN-UAT partial — 2 live-API items pending)**
- [x] **Phase 5: Video Segmentation + Hook Decomposition** — Native Gemini `videoMetadata` parallel calls (Pro hook + Flash body/CTA), multi-modal hook decomp, visual-audio coherence, cognitive load. **Completed 2026-05-19**
- [x] **Phase 6: Audio Analysis + Fingerprint** — Real audio stage replacing no-op, audio fingerprint matching against trending sounds DB. **Completed 2026-05-19 (3/3 HUMAN-UAT passed; 5 code-review follow-ups deferred)**
- [x] **Phase 7: Multi-Persona Simulation** — Wave 3 with 10 FYP-weighted personas on V3 (6 FYP + 2 niche + 1 loyalist + 1 cross-niche). (completed 2026-05-19)
- [x] **Phase 8: Benchmark Retrieval** — pgvector setup, embedding pipeline, top-K similar competitor video retrieval. (completed 2026-05-19)
- [x] **Phase 9: Platform Algo Fit + Self-Critique + Counterfactuals** — TikTok/IG/YT-specific signals, creator-tier awareness, watermark detection, critique pass, counterfactual generation. **Completed 2026-05-20 (7 plans, 84 test files green, pending verifier)**
- [ ] **Phase 10: ML Audit + Calibration + Aggregator Extension** — Audit ML against corpus, decide retrain/down-weight, train Platt on corpus, extend SignalAvailability with new signals, bump to engine v3.0.
- [ ] **Phase 11: Existing UI Integration + Privacy Policy** — Wire /api/analyze + video-upload component to new engine, storage retention policy, onboarding integration with 9-card profile.
- [ ] **Phase 12: Accuracy Benchmark + Acceptance Gate** — Final benchmark run, target accuracy improvement met, cost in budget, no regressions, M1 ships.
- [ ] **Phase 13: Real Pipeline Validation + Production Hardening** — Real-video end-to-end validation; Stage 11 rebuild; Gemini model audit; DeepSeek hang mitigation; code review phases 9-12. Replaces Phase 12 as the actual milestone gate. Only after 10 real videos pass cleanly does ENGINE_VERSION flip 3.0.0-dev → 3.0.0 and milestone merge.

## Phase Details

### Phase 1: Training Corpus & Eval Foundation
**Goal:** Labeled 500-video training corpus exists and an eval harness measures engine accuracy against it. Current engine (v2.1) baseline measured. Target accuracy threshold set.
**Depends on:** Nothing (kickoff)
**Requirements:** CORPUS-01..08, EVAL-01..08
**Success Criteria** (what must be TRUE):
  1. `training_corpus` table in Supabase contains exactly 500 videos: 100 viral, 200 average, 200 underperforming, stratified across ≥5 niches
  2. Outcome metadata per video: views, completion %, shares, comments, saves, creator follower tier — all captured and validated
  3. Eval harness can run any engine version over the corpus and produce a report with prediction error per signal, calibration drift, and overall accuracy metrics
  4. Baseline measurement of current engine v2.1 against corpus is persisted (`benchmark_results` table) — every future phase compares against it
  5. Target accuracy threshold for v3 acceptance is documented in `.planning/research/` and committed (e.g., "v3 must reduce MAE on engagement prediction by ≥20% vs v2.1")
**Plans:** 7 plans across 4 waves
Plans:
- [x] 01-01-PLAN.md — Wave 1: training_corpus + benchmark_results migrations
- [x] 01-02-PLAN.md — Wave 1: eval-config, thresholds, bucketing, pure metrics
- [x] 01-03-PLAN.md — Wave 1: cron stub + apify-jobs + normalize-scrape
- [x] 01-04-PLAN.md — Wave 2: orchestrator + build-corpus CLI
- [x] 01-05-PLAN.md — Wave 2: eval-harness + baseline + eval CLI
- [x] 01-06-PLAN.md — Wave 3: pilot run + threshold recalibration (Completed 2026-05-11)
- [x] 01-07-PLAN.md — Wave 4: full corpus + v2.1 baseline + threshold doc (Completed 2026-05-11)

### Phase 2: Creator Profile & 9-Card Interview
**Goal:** Creators complete a 9-card interview before their first analysis; profile is loaded into every analysis as enriched `CreatorContext`.
**Depends on:** Nothing (kickoff, parallel with Phase 1)
**Requirements:** PROFILE-01..17
**Success Criteria:**
  1. `creator_profiles` table with RLS policies; profile-per-user with all 9 card fields persisted
  2. 9-card modal triggers on first upload click for users without profile; mandatory flow but individual cards skippable
  3. Truthfulness messaging surfaced in modal UI ("Honest answers improve your prediction accuracy by ~30%")
  4. Profile editable from `/settings/profile` route at any time
  5. Existing `creator.ts` `fetchCreatorContext()` returns enriched context including profile fields; downstream pipeline consumers (Gemini prompts, persona allocation, etc.) reference them
**Plans:** 6 plans
Plans:
- [x] 02-01-PLAN.md — Wave 1: schema migration + Wave 0 test scaffolds
- [x] 02-02-PLAN.md — Wave 1: niche taxonomy module + tests
- [x] 02-03-PLAN.md — Wave 2: 9 card-picker components (Cards 0-8)
- [x] 02-04-PLAN.md — Wave 3: ProfileInterviewModal + Zustand store + gate hook + content-form interception (Completed 2026-05-17)
- [x] 02-05-PLAN.md — Wave 3: Settings 6th tab + ProfileSettingsForm + TanStack hooks + new API route + welcome trim (Completed 2026-05-17)
- [x] 02-06-PLAN.md — Wave 4: engine CreatorContext extension + reference-creator side-effect + e2e + supabase migration applied + PROFILE-16 traceability (Completed 2026-05-17)
**UI hint:** yes

### Phase 3: Pipeline Infrastructure
**Goal:** Pipeline emits stage events via optional callback (no behavioral change to existing callers), every prediction is tagged with engine version + provenance, and caching reduces cost on heavy users.
**Depends on:** Phase 1 (eval harness ready to measure caching impact)
**Requirements:** PIPE-01..09, CACHE-01..06
**Success Criteria:**
  1. `runPredictionPipeline()` accepts optional `onStageEvent` callback; existing call sites continue passing `undefined` without behavior change
  2. SSE response from `/api/analyze` works when client sends `Accept: text/event-stream` (Vercel-compatible)
  3. Every prediction stored in DB tagged with `engine_version` and `signal_availability` JSON column
  4. Content hash cache hits return cached result in <2s for re-uploaded videos
  5. Persona prompt cache verified working with DeepSeek input cache header (80% discount on cached portion)
  6. Existing 465 tests pass without modification (research updated the stale "203" count to 465 across 35 files)
**Plans:** 4 plans across 4 waves
Plans:
- [x] 03-01-PLAN.md — Wave 1: leaf modules + test stubs (version.ts, events.ts, types extension, 4 no-op stubs, prediction-cache) + 4 new test files
- [x] 03-02-PLAN.md — Wave 2: pipeline.ts options-bag + stub invocations; aggregator.ts version relocation + signal_availability surfacing + Stage 10/11 calls; deepseek.ts stable system prompt + cache telemetry
- [x] 03-03-PLAN.md — Wave 3: /api/analyze route — Vercel config (runtime/dynamic/maxDuration), Accept-header negotiation, cache short-circuit, onStageEvent forwarding, provenance INSERT, route.test.ts
- [x] 03-04-PLAN.md — Wave 4: Supabase migration (signal_availability + content_hash + cache index) + [BLOCKING] schema push + types regen + full-suite test gate + manual smoke

### Phase 4: Wave 0 — Content Type + Niche Detection
**Goal:** A new Wave 0 runs two V3 classifier calls before Wave 1, producing `content_type` and hierarchical `niche` signals that drive downstream weighting.
**Depends on:** Phase 3 (pipeline infrastructure)
**Requirements:** CONTENT-01..04
**Success Criteria:**
  1. Pipeline's Wave 0 fires before Wave 1 stages with two parallel V3 calls (content type + niche)
  2. Content type classifier returns one of: talking head, B-roll, slideshow, action, tutorial, vlog — with confidence
  3. Niche detector returns hierarchical {primary, sub_niche, micro_niche} with confidence; falls back to creator profile Card 1 if confidence <0.6
  4. Niche taxonomy tree exists in code with mappings to persona archetypes + benchmark filters
  5. Aggregator weights content-type-aware (slideshows down-weight pacing signal; action videos up-weight visual_production_quality)
**Plans:** 5/5 plans complete (3 planned + 2 gap-closure from VERIFICATION)
Plans:
- [x] 04-01-PLAN.md — Wave 1: foundations (types + Zod schemas, content-type weight matrix, taxonomy persona/benchmark extensions)
- [x] 04-02-PLAN.md — Wave 2: detector implementations (Gemini 3 Flash content-type, DeepSeek V4 Flash niche with dual-env DEEPSEEK_NICHE_MODEL, STABLE/VOLATILE prompts)
- [x] 04-03-PLAN.md — Wave 3: orchestration + integration (wave0.ts Promise.allSettled, pipeline pre_creator_context, aggregator selectWeights filter + content-type weight matrix wiring)
- [x] 04-04-PLAN.md — Gap closure GAP-04-01 (BLOCKER): replace `fetch(payload.video_url)` with `supabase.storage.from("videos").download(payload.video_storage_path)`; Option A normalize contract decouples `video_url` (tiktok_url mode only) from `video_storage_path` (video_upload mode only); 6 regression-lock tests
- [x] 04-05-PLAN.md — Gap closure GAP-04-02 (WARNING): niche-detector cost fallback to `prompt_tokens × CACHE_MISS_PRICE` when DeepSeek omits cache breakdown; pattern mirrors `deepseek.ts:338-362`; 3 regression tests
**Status:** Verifier passed 5/5 SCs at code+test level (2026-05-18). HUMAN-UAT status: partial — 2 live-API tests pending in 04-HUMAN-UAT.md.

### Phase 5: Video Segmentation + Hook Decomposition
**Goal:** Gemini analyzes the video in 3 parallel segments (Pro hook, Flash body, Flash CTA) via native `videoMetadata`. Hook is decomposed into 4 sub-modalities with cross-modal coherence + cognitive load scores.
**Depends on:** Phase 3 + Phase 4 (Wave 0 niche feeds segment prompts)
**Requirements:** SEGMENT-01..06, HOOK-01..07
**Success Criteria:**
  1. Three parallel Gemini calls execute against a single Files API upload using `videoMetadata: { startOffset, endOffset }` to scope by time range
  2. Hook segment uses `gemini-2.5-pro` model; body and CTA use `gemini-2.5-flash` (configurable via env)
  3. Hook decomposition returns 4 sub-scores: visual stop power, audio hook, text overlay, first words / speech — plus identified weakest modality
  4. Visual-audio coherence score and cognitive load score computed from cross-modal analysis (free Gemini prompt extension)
  5. Existing `analyzeVideoWithGemini` test surface still passes; new tests cover segmented analysis with mocked `videoMetadata` calls
**Plans:** 3 plans across 3 waves
Plans:
**Wave 1**
- [x] 05-01-PLAN.md — Wave 1: foundations (Zod schemas + Gemini responseSchema literals, per-model cost helper, prompt builders, types widening, env vars)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-02-PLAN.md — Wave 2: segment helpers + orchestrator + merge (3 parallel videoMetadata-scoped Gemini calls via Promise.allSettled, null-safe partial-failure merge)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 05-03-PLAN.md — Wave 3: pipeline + aggregator integration (Wave 1 video-branch swap, per-segment SignalAvailability, D-06 CTA penalty, AI-SPEC eval D1-D17 alignment)

### Phase 6: Audio Analysis + Fingerprint Matching
**Goal:** Audio stage produces real signals (voice clarity, audio hook, silence ratio, fingerprint match) replacing the current no-op.
**Depends on:** Phase 3 (pipeline infrastructure)
**Requirements:** AUDIO-01..06, HOOK-02 (migrated from Phase 5 per D-H1)
**Success Criteria:**
  1. `Stage 4: Audio` returns a real result object (not `null`) with voice clarity, audio hook score, silence/voiceover/music ratio
  2. Audio fingerprint match against trending sounds DB returns matched sound + velocity (rising / peak / declining) when match found
  3. Audio signal feeds aggregator with appropriate weight
  4. Existing trend enrichment fuzzy string match still works as fallback when fingerprint match is unavailable
  5. Audio analysis adds <2s to total pipeline latency (folded into existing Gemini calls where possible)
**Plans:** 6 plans across 5 waves (Plan 05 split into 05 + 06 per checker WARNING 5; Plan 06 lifted to Wave 5 by explicit dependency on Plan 05)
Plans:
- [x] 06-01-PLAN.md — Wave 1: Gemini Flash audio reliability smoke test (gates SC#1) + HOOK-02 REQUIREMENTS.md migration (D-H1)
- [x] 06-02-PLAN.md — Wave 2: Types + migration (pgvector + HNSW + match RPC + analysis_results.audio_description) + BLOCKING schema push
- [x] 06-03-PLAN.md — Wave 3: Gemini schema extension (audio_signals optional for graceful degradation) + audio-perceptual module (D-G3 coefficients)
- [x] 06-04-PLAN.md — Wave 3: audio-fingerprint stage (explicit Sentry-vs-warn asymmetry) + backfill script (FULL D-F4 pipeline)
- [x] 06-05-PLAN.md — Wave 4: pipeline rename + trends D-F3 gating + types.ts PipelineResult widening
- [x] 06-06-PLAN.md — Wave 5: aggregator D-G1/G2/G3/G4 + analysis_results.audio_description persistence (Q4 RESOLVED) + cron full D-F4 pipeline

### Phase 7: Multi-Persona Simulation
**Goal:** 10 personas allocated FYP-first (6/2/1/1) run in parallel as Wave 3 after Wave 2 (DeepSeek synthesis + trends). Each persona produces structured reactions used both as the new behavioral signal and the data source for M2's audience viz.
**Depends on:** Phase 3 (pipeline infrastructure)
**Requirements:** PERSONA-01..11, PIPE-08
**Success Criteria:**
  1. Wave 3 of pipeline runs exactly 10 parallel V3 calls (deepseek-chat) with persona-specific system prompts
  2. Persona allocation defaults to 6 FYP + 2 niche + 1 loyalist + 1 cross-niche; tunable per content type (FYP-heavier for discovery-style content)
  3. Each persona returns structured JSON with `scroll_past_second`, `watch_through_pct`, `comment_intent`, `share_intent`, `save_intent`
  4. Aggregate persona output replaces the single `behavioral_predictions` from single DeepSeek call in v2 aggregator
  5. Per-persona drop-off second persisted on prediction (data ready for M2 retention curve)
  6. Persona prompt cache (DeepSeek input cache) verified active — cost per analysis ≤$0.025 for 10-persona stage
**Plans:** 5/5 plans complete
Plans:
- [x] 07-01-PLAN.md — Wave 1: persona registry + prompts + types widening; reuse wave0/prompts.ts tryUrlHost via single-keyword export (PERSONA-02, 03, 05, 06, 08)
- [x] 07-02a-PLAN.md — Wave 2: foundations — PipelineResult/PredictionResult widening + factories + wave3/aggregator.ts pure-math helper (PERSONA-08, 09, 11, PIPE-08)
- [x] 07-02b-PLAN.md — Wave 3: wave3.ts orchestrator rewrite + pipeline.ts call-site widening + orchestration tests; uses existing isCircuitOpen export from deepseek.ts:736 (PERSONA-01, 02, 03, 04, 05, 06, 07, 10)
- [x] 07-03-PLAN.md — Wave 4: aggregator additive integration (signal_availability.personas + optional behavioralSource param) (PERSONA-07, 10, 11)
- [x] 07-04-PLAN.md — Wave 5: A/B eval harness wiring via existing runEvalHarness + cost budget test + operator review checkpoint (PERSONA-10, 11)

### Phase 8: Benchmark Retrieval
**Goal:** pgvector-backed top-K retrieval returns 3-5 similar competitor videos as evidence on every prediction; filtered by niche, platform, and creator tier.
**Depends on:** Phase 3 (pipeline infrastructure)
**Requirements:** RETRIEVAL-01..06
**Success Criteria:**
  1. `pgvector` extension installed in Supabase; `training_corpus.embedding` + `scraped_videos.embedding` columns with HNSW indexes (per D-01 two-pool decision — supersedes original `competitor_videos.embedding`)
  2. Backfill job embeds all existing rows in both pools (one-time via `pnpm tsx scripts/embed-corpus.ts --backfill`)
  3. Predict-time embedding of input video summary completes in <1s and queries top-K=5 with niche + platform + tier filter (hierarchical relaxation per D-04)
  4. Retrieval results stored on prediction (`retrieval_evidence` JSONB + `retrieval_score` NUMERIC) with similarity scores + outcomes
  5. Retrieval signal added to aggregator at LOW initial weight (0.05 per D-03b; Phase 10 owns calibration)
**Plans:** 5/5 plans executed — Phase Complete (2026-05-19)
Plans:
- [x] 08-01-PLAN.md — Wave 1: pgvector migration SQL + REQUIREMENTS-02 conflict resolution
- [x] 08-02-PLAN.md — Wave 1: types.ts extension — Zod schemas + interfaces (interface-first contracts)
- [x] 08-03-PLAN.md — Wave 2: Retrieval modules — embedder + bucket-derivation + re-ranker + pgvector-client + unit tests
- [x] 08-04-PLAN.md — Wave 3: retrieval-stage orchestration + pipeline.ts Wave-1 wiring + aggregator extension
- [x] 08-05-PLAN.md — Wave 4 [BLOCKING]: DB push + types regen + auto-embed insert paths + backfill CLI + percentile snapshot

### Phase 9: Platform Algo Fit + Self-Critique + Counterfactuals
**Goal:** Platform-specific algorithm fit signals (TikTok/IG/YT), self-critique pass on aggregator output, counterfactual suggestions, watermark detection, anti-virality warnings.
**Depends on:** Phase 5, 6, 7, 8 (all new signals available)
**Requirements:** ALGO-01..06, CRITIQUE-01..03, COUNTER-01..04
**Success Criteria:**
  1. Per-platform fit score (TikTok / IG Reels / YT Shorts) computed using platform-specific signal weighting + creator-tier adjustments
  2. Watermark detection fires (Gemini prompt extension) and flags IG penalty risk
  3. Self-critique V3 call grades aggregator output for internal consistency, references creator's wins/flops from Card 6
  4. Counterfactual V3 call generates 1-3 "what if hook moved to 0:02" suggestions tied to retention drop points
  5. Anti-virality "this will likely flop" warning surfaced when prediction confidence is high but overall score <30
**Plans:** 7 plans
Plans:
**Wave 1**
- [ ] 09-01-PLAN.md — Wave 1: Interface-first types.ts extension + 5 Wave 0 test stub files
- [ ] 09-02-PLAN.md — Wave 1: Gemini hook-segment watermark detection extension

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 09-03-PLAN.md — Wave 2: Platform-fit V3 module (wave4/platform-fit.ts + prompts)
- [ ] 09-04-PLAN.md — Wave 2: Aggregator wiring (platform_fit: 0.05 signal)
- [ ] 09-05-PLAN.md — Wave 2: Self-critique V3 module (stage10-critique.ts + prompts)
- [ ] 09-06-PLAN.md — Wave 2: Counterfactuals V3 module + LIKELY_FLOP (stage11)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 09-07-PLAN.md — Wave 3: Pipeline integration + API route wiring + BENCH-05 gate

**Cross-cutting constraints:**
- LIKELY_FLOP check uses POST-CRITIQUE confidence (Pitfall 7 ordering invariant)

### Phase 10: ML Audit + Calibration + Aggregator Extension
**Goal:** ML classifier audited on corpus; decision made (retrain / down-weight / disable). Platt calibration trained on corpus and applied to all predictions. Aggregator extended with new signals and engine bumped to v3.0.
**Depends on:** Phase 9 (all signals must be ready before aggregator extension)
**Requirements:** ML-01..06, AGG-01..06
**Success Criteria:**
  1. ML classifier accuracy on corpus measured; report committed to `.planning/research/`
  2. Decision documented: retrained (if salvageable), down-weighted (if marginal), or disabled (if harmful)
  3. Platt calibration trained on corpus predictions vs actual outcomes; calibration parameters stored
  4. `is_calibrated: true` set on predictions where calibration applies
  5. Aggregator extended via SignalAvailability with personas, audio, retrieval, hook, algo-fit signals; dynamic redistribution updated
  6. `ENGINE_VERSION` bumped to `3.0.0`; all 203 existing tests still pass + new aggregator tests cover new signals
**Plans:** 3 plans across 3 waves
Plans:
**Wave 1**
- [ ] 10-01-PLAN.md — Wave 1: ml-audit.ts CLI + platt_parameters migration SQL + aggregator-phase10.test.ts stubs

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 10-02-PLAN.md — Wave 2: [BLOCKING] DB push + getPlattParameters() DB-read update + train-platt.ts CLI

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 10-03-PLAN.md — Wave 3: ML decision applied to SCORE_WEIGHTS + signal ablation tuning + weight-calibration-report.md

### Phase 11: Existing UI Integration + Privacy Policy
**Goal:** Existing video upload + analyze + dashboard flows work with engine v3. Storage retention policy enforced. New 9-card profile integrates cleanly with existing onboarding.
**Depends on:** Phase 10 (engine v3 must be complete)
**Requirements:** INT-01..07
**Success Criteria:**
  1. `/api/analyze` route switched to engine v3; smoke test passes end-to-end with both `tiktok_url` and `video_upload` modes
  2. Existing `video-upload.tsx` component now triggers 9-card profile modal for users without profile (interception via auth state check)
  3. Existing dashboard renders updated `PredictionResult` with new fields (basic display — polished card ships in M2)
  4. Storage retention cron job auto-deletes uploaded videos after 30 days unless opted in
  5. Retention policy text shown in upload UI before user uploads
  6. Existing MVP Launch onboarding (TikTok handle + goal personalization + 4 tooltips) integrates with new 9-card profile (no duplication of fields)
**Plans:** 5 plans across 3 waves
Plans:
**Wave 1**
- [ ] 11-01-PLAN.md — Wave 1: DB migration (analysis_count + storage_retention_opted_in + video_storage_path) + [BLOCKING] schema push + types regen

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 11-02-PLAN.md — Wave 2: /api/analyze modifications (analysis_count RPC + retention gate + video_storage_path) + retention cron + vercel.json
- [ ] 11-03-PLAN.md — Wave 2: Dashboard UI — SignalAvailabilityChips + GoalRecheckBanner + ResultsPanel wiring + DashboardClient profile fetch
- [ ] 11-04-PLAN.md — Wave 2: Upload/Settings UI — video-upload.tsx disclosure + profile-settings-form.tsx retention toggle + schema/hook/route updates

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 11-05-PLAN.md — Wave 3: Engine v3 dev-guard audit + smoke test + human-verify checkpoint
**UI hint:** yes

### Phase 12: Accuracy Benchmark + Acceptance Gate
**Goal:** Full benchmark run of engine v3 against corpus shows measurable accuracy improvement vs v2.1 baseline. Cost within budget. No regressions.
**Depends on:** Phase 11 (full engine + UI wired)
**Requirements:** BENCH-01..06
**Success Criteria:**
  1. Full corpus benchmark of engine v3 completed; report shows accuracy improvement against Phase 1 baseline meets target threshold
  2. Per-signal contribution analysis confirms all new signals contribute positively (no signal subtracts from accuracy)
  3. Average cost per analysis ≤ $0.075 across the 500-video corpus run
  4. Calibration loss reduced vs v2.1 baseline (Platt calibration measurably improves percentile mapping)
  5. All 203 existing tests + new tests pass; zero regressions in PredictionResult schema for downstream consumers
  6. Milestone-completion checklist signed off; ready to merge `milestone/engine-foundation` and start Intelligence Surface milestone
**Plans:** 3 plans across 3 waves
Plans:
**Wave 1**
- [ ] 12-01-PLAN.md — Wave 1: Platt training + test suite verification + Phase 11 readiness check

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 12-02-PLAN.md — Wave 2: --max-rows CLI flag + v2.1 rebaseline + v3 smoke (25-rows, LOO) + conditional full benchmark

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 12-03-PLAN.md — Wave 3: Gate evaluation + summary report + ENGINE_VERSION flip + user sign-off

### Phase 13: Real Pipeline Validation + Production Hardening
**Goal:** Engine v3 proven end-to-end on real TikTok uploads. Stage 11 (counterfactuals/suggestions) rebuilt to be hyper-specific, signal-grounded, and always-on. Gemini model IDs verified live. DeepSeek hang risk mitigated. Phases 9-12 code reviewed for logic correctness. Only after 10 real videos pass cleanly does `ENGINE_VERSION` flip `3.0.0-dev` → `3.0.0` and the milestone merge.
**Depends on:** Phase 12 infrastructure (text-mode benchmark exists but is the wrong tool — superseded as the gate by this phase)
**Requirements:** SC#1, SC#2, SC#3, SC#4, SC#5, SC#6, SC#7, SC#8 (mapped from CONTEXT.md D-01..D-32; success criteria above are the requirement set for Phase 13)
**Success Criteria:**
  1. Gemini model audit: every model slot in `src/lib/engine/gemini.ts` (hook, body, CTA) verified callable via a single live API call; standardized to confirmed GA models (no provisional/preview names)
  2. Stage 11 rebuild: always runs (no skip on `overall_score ≥ 70`), prompt receives full signal context (Gemini factor scores, fired rules, trend matches, persona dissent, platform fit), uses a stronger model than `deepseek-v4-flash`, and surfaces "what's working" reinforcement for high-scoring content
  3. Stage 11 UI wiring verified: `CounterfactualResult` renders on the prediction card; merge behavior with `result.suggestions[]` from earlier stages is intentional and visible to the user
  4. E2E smoke: 1 real TikTok URL → 5 URLs → 10 URLs through `/api/analyze` without crashes; every wave produces non-degraded output (audio fingerprinting, Wave 3 personas, Wave 4 platform fit, Stage 11 all verified on real content)
  5. Code-logic review of phases 9-12: wave wiring correct, signal fallback paths sound, no silent degradations
  6. DeepSeek hang mitigation: deterministic kill path for stuck TCP connections at video-mode latencies (≥60s); tested under load
  7. `ENGINE_VERSION` flipped `3.0.0-dev` → `3.0.0` in `src/lib/engine/version.ts` after all 10 real videos pass
  8. `milestone/engine-foundation` merged to `main` after sign-off
**Plans:** 5/8 plans executed
Plans:
**Wave 1**
- [x] 13-01-PLAN.md — Wave 1: Gemini self-test (D-21) + caption-less audit (D-13) + Phase 12 cleanup doc (D-29) + cache D-23 regression test

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 13-02-PLAN.md — Wave 2: Stage 11 rebuild (D-01..D-06) + SCORE_WEIGHTS retuning (D-14/15/16) + -preview drop (D-09) + D-10 silent-fallback fix + UI rebuild (UI-SPEC + D-30)
- [x] 13-04-PLAN.md — Wave 2: Cross-phase code-logic review of Phases 9-12 (SC#5) — read-only artifact

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 13-03-PLAN.md — Wave 2: Wave 0 niche fold (D-17) + shared fileUri threading (D-18) + 287MB upload cap (D-19) + final D-24 test sweep

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 13-05-PLAN.md — Wave 3: Build smoke-tiktok-pipeline.ts runner + 1-video E2E (SC#4 partial) + D-22 hang mitigation if manifests

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 13-06-PLAN.md — Wave 4: 5-video cadence (videos 2-5) with stratification audit + cumulative pass rate

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 13-07-PLAN.md — Wave 5: 10-video cadence (videos 6-10) + 13-FINAL-VALIDATION-REPORT.md + user sign-off (D-28)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 13-08-PLAN.md — Wave 6: ENGINE_VERSION flip (D-27) + Phase 12 cleanup execution (D-29) + milestone merge (SC#8) + STATE/MILESTONES closure
**UI hint:** verify only — no new UI features (M2 scope)

## Progress

**Execution Order:** 1 ∥ 2 → 3 → 4 → 5 ∥ 6 ∥ 7 ∥ 8 → 9 → 10 → 11 → 12 → 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Training Corpus & Eval Foundation | 7/7 | Complete (pending verifier) | 2026-05-11 |
| 2. Creator Profile & 9-Card Interview | 6/6 | Complete (UAT deferred) | 2026-05-17 |
| 3. Pipeline Infrastructure | 4/4 | Complete (PARTIAL — defer-smoke for SC#4/#5) | 2026-05-18 |
| 4. Wave 0 — Content Type + Niche Detection | 5/5 | Complete (HUMAN-UAT partial — 2 live-API items pending; verifier 5/5 SCs) | 2026-05-18 |
| 5. Video Segmentation + Hook Decomposition | 3/3 | Complete (verifier passed; code review advisory 4C/9W/6I) | 2026-05-19 |
| 6. Audio Analysis + Fingerprint | 6/6 | Complete (3/3 HUMAN-UAT passed; code review 5W/4I closed inline) | 2026-05-19 |
| 7. Multi-Persona Simulation | 5/5 | Complete    | 2026-05-19 |
| 8. Benchmark Retrieval | 5/5 | Complete (live DB applied; 7614 rows embedded; HNSW self-match validated) | 2026-05-19 |
| 9. Platform Algo Fit + Self-Critique + Counterfactuals | 0/TBD | Not started | - |
| 10. ML Audit + Calibration + Aggregator Extension | 0/TBD | Not started | - |
| 11. Existing UI Integration + Privacy Policy | 0/5 | Planned (2026-05-20) | - |
| 12. Accuracy Benchmark + Acceptance Gate | 0/TBD | Not started | - |
| 13. Real Pipeline Validation + Production Hardening | 5/8 | In Progress|  |
