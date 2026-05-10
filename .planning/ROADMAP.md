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

- [ ] **Phase 1: Training Corpus & Eval Foundation** — Build labeled 500-video corpus + eval harness. Measure v2.1 baseline accuracy. Set target threshold.
- [ ] **Phase 2: Creator Profile & 9-Card Interview** — `creator_profiles` schema, modal flow, settings edit, profile-aware `CreatorContext`.
- [ ] **Phase 3: Pipeline Infrastructure** — `onStageEvent` callback, SSE infra in /api/analyze, engine versioning + provenance, caching layer (content hash + persona prompt + niche taxonomy).
- [ ] **Phase 4: Wave 0 — Content Type + Niche Detection** — V3 classifier + hierarchical niche detector before Wave 1; drives downstream signal weighting.
- [ ] **Phase 5: Video Segmentation + Hook Decomposition** — Native Gemini `videoMetadata` parallel calls (Pro hook + Flash body/CTA), multi-modal hook decomp, visual-audio coherence, cognitive load.
- [ ] **Phase 6: Audio Analysis + Fingerprint** — Real audio stage replacing no-op, audio fingerprint matching against trending sounds DB.
- [ ] **Phase 7: Multi-Persona Simulation** — Wave 3 with 10 FYP-weighted personas on V3 (6 FYP + 2 niche + 1 loyalist + 1 cross-niche).
- [ ] **Phase 8: Benchmark Retrieval** — pgvector setup, embedding pipeline, top-K similar competitor video retrieval.
- [ ] **Phase 9: Platform Algo Fit + Self-Critique + Counterfactuals** — TikTok/IG/YT-specific signals, creator-tier awareness, watermark detection, critique pass, counterfactual generation.
- [ ] **Phase 10: ML Audit + Calibration + Aggregator Extension** — Audit ML against corpus, decide retrain/down-weight, train Platt on corpus, extend SignalAvailability with new signals, bump to engine v3.0.
- [ ] **Phase 11: Existing UI Integration + Privacy Policy** — Wire /api/analyze + video-upload component to new engine, storage retention policy, onboarding integration with 9-card profile.
- [ ] **Phase 12: Accuracy Benchmark + Acceptance Gate** — Final benchmark run, target accuracy improvement met, cost in budget, no regressions, M1 ships.

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
**Plans:** TBD (~4-5 plans across waves)

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
**Plans:** TBD (~5 plans — schema, modal UI, 9 card components, settings flow, integration with existing onboarding)
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
  6. Existing 203 tests pass without modification
**Plans:** TBD (~3 plans)

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
**Plans:** TBD (~2-3 plans)

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
**Plans:** TBD (~3-4 plans, executable in parallel within phase)

### Phase 6: Audio Analysis + Fingerprint Matching
**Goal:** Audio stage produces real signals (voice clarity, audio hook, silence ratio, fingerprint match) replacing the current no-op.
**Depends on:** Phase 3 (pipeline infrastructure)
**Requirements:** AUDIO-01..06
**Success Criteria:**
  1. `Stage 4: Audio` returns a real result object (not `null`) with voice clarity, audio hook score, silence/voiceover/music ratio
  2. Audio fingerprint match against trending sounds DB returns matched sound + velocity (rising / peak / declining) when match found
  3. Audio signal feeds aggregator with appropriate weight
  4. Existing trend enrichment fuzzy string match still works as fallback when fingerprint match is unavailable
  5. Audio analysis adds <2s to total pipeline latency (folded into existing Gemini calls where possible)
**Plans:** TBD (~2 plans)

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
**Plans:** TBD (~4 plans)

### Phase 8: Benchmark Retrieval
**Goal:** pgvector-backed top-K retrieval returns 3-5 similar competitor videos as evidence on every prediction; filtered by niche, platform, and creator tier.
**Depends on:** Phase 3 (pipeline infrastructure)
**Requirements:** RETRIEVAL-01..06
**Success Criteria:**
  1. `pgvector` extension installed in Supabase; `competitor_videos.embedding` column with appropriate index
  2. Backfill job embeds all existing competitor videos (one-time)
  3. Predict-time embedding of input video summary completes in <1s and queries top-K=5 with niche + platform + tier filter
  4. Retrieval results stored on prediction (`retrieval_evidence` field) with similarity scores + outcomes
  5. Retrieval signal added to aggregator (low weight initially; tuned via eval harness)
**Plans:** TBD (~3 plans)

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
**Plans:** TBD (~3-4 plans)

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
**Plans:** TBD (~3 plans)

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
**Plans:** TBD (~3 plans)
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
**Plans:** TBD (~1-2 plans)

## Progress

**Execution Order:** 1 ∥ 2 → 3 → 4 → 5 ∥ 6 ∥ 7 ∥ 8 → 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Training Corpus & Eval Foundation | 0/TBD | Not started | - |
| 2. Creator Profile & 9-Card Interview | 0/TBD | Not started | - |
| 3. Pipeline Infrastructure | 0/TBD | Not started | - |
| 4. Wave 0 — Content Type + Niche Detection | 0/TBD | Not started | - |
| 5. Video Segmentation + Hook Decomposition | 0/TBD | Not started | - |
| 6. Audio Analysis + Fingerprint | 0/TBD | Not started | - |
| 7. Multi-Persona Simulation | 0/TBD | Not started | - |
| 8. Benchmark Retrieval | 0/TBD | Not started | - |
| 9. Platform Algo Fit + Self-Critique + Counterfactuals | 0/TBD | Not started | - |
| 10. ML Audit + Calibration + Aggregator Extension | 0/TBD | Not started | - |
| 11. Existing UI Integration + Privacy Policy | 0/TBD | Not started | - |
| 12. Accuracy Benchmark + Acceptance Gate | 0/TBD | Not started | - |
