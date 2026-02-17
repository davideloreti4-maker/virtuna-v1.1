# Milestone: Prediction Engine v2

**Status:** SHIPPED 2026-02-17
**Phases:** 1-15
**Total Plans:** 32

## Overview

Transform the prediction engine from ~40-55% accuracy to ~75-85% through TikTok-aligned prompts, full video analysis, a 10-stage pipeline with FeatureVector backbone, behavioral predictions, ML training on 5000 scraped videos, and calibration infrastructure. 15 phases (12 original + 3 gap closure), milestone-scoped numbering starting at 1.

## Phases

### Phase 1: Data Analysis
**Goal**: Produce data-driven virality patterns and thresholds from 5000 scraped TikTok videos
**Depends on**: Nothing (first phase)
**Plans**: 1 plan

Plans:
- [x] 1-01: Scraped Video Data Analysis

**Details:** Mined 7,321 TikTok videos with algorithm-aligned weighted engagement scoring: 5 tiers, creator size normalization, view velocity, save rate, and share rate as #1 virality signal.

### Phase 2: Gemini Prompt + Video Analysis
**Goal**: Gemini returns 5 TikTok-aligned factors and can analyze full video content
**Depends on**: Phase 1
**Plans**: 1 plan

Plans:
- [x] 02-01: Rewrite GeminiResponseSchema + prompt template + text/video analysis paths

**Details:** TikTok-aligned 5-factor Gemini prompt with calibration embedding + video analysis via Gemini Files API upload.

### Phase 3: DeepSeek Prompt + Model Switch
**Goal**: DeepSeek uses V3.2-reasoning with structured 5-step CoT and outputs behavioral predictions
**Depends on**: Phase 1
**Plans**: 1 plan

Plans:
- [x] 03-01: DeepSeek prompt rewrite with 5-step CoT, behavioral predictions, V3.2-reasoning cost estimation

**Details:** 5-step CoT behavioral prediction prompt with calibration embedding, score-free Gemini handoff, and V3.2-reasoning token-based cost estimation.

### Phase 4: Types, Schema & DB Migration
**Goal**: All v2 types defined (FeatureVector, ContentPayload, PredictionResult), input schema expanded for 3 modes, DB migrated
**Depends on**: Phase 2, Phase 3
**Plans**: 2 plans

Plans:
- [x] 4-01: FeatureVector, Input Schema & Type Definitions
- [x] 4-02: DB Migration & Input Normalization

**Details:** FeatureVector signal backbone, 3-mode AnalysisInput with Zod refine, ContentPayload normalized type, and PredictionResult v2 with behavioral predictions and feature vector.

### Phase 5: Pipeline Architecture
**Goal**: Pipeline restructured to 10 stages with Wave-based parallelism, Creator Context, and new aggregation formula
**Depends on**: Phase 4
**Plans**: 2 plans

Plans:
- [x] 5-01: Creator Context stage + 10-stage pipeline restructure with wave parallelism and per-stage timing
- [x] 5-02: V2 aggregation formula, confidence calculation, FeatureVector assembly, API route + hook wiring

**Details:** 10-stage wave-parallel pipeline with Creator Context stage, strict fail-all mode, and per-stage timing. New aggregation: behavioral 45% + gemini 25% + rules 20% + trends 10%.

### Phase 6: Infrastructure Hardening
**Goal**: Production-ready infrastructure with rate limiting, caching, partial failure recovery, and improved circuit breaker
**Depends on**: Phase 5
**Plans**: 1 plan

Plans:
- [x] 6-01: TTL caching, rate limiting by tier, input validation, exponential backoff circuit breaker, partial pipeline failure recovery

**Details:** Rate limiting by tier, TTL caching for DB queries, exponential backoff circuit breaker, and partial pipeline failure recovery.

### Phase 7: Upload & Input UI
**Goal**: Users can upload videos, paste TikTok URLs, or enter text through a tabbed content form
**Depends on**: Phase 4
**Plans**: 2 plans

Plans:
- [x] 7-01: VideoUpload + TikTokUrlInput standalone components
- [x] 7-02: Content form 3-tab rewrite + test-creation-flow v2 payload wiring

**Details:** VideoUpload with drag-drop zone, 200MB validation, canvas thumbnail extraction. TikTokUrlInput with regex URL validation and preview card. 3-tab content form with unified formData state.

### Phase 8: Results Card & Breakdown UI
**Goal**: Results display shows factor breakdown, behavioral predictions, before/after suggestions, persona reactions, and updated loading states
**Depends on**: Phase 5
**Plans**: 3 plans

Plans:
- [x] 08-01: Hero score with confidence badge + 5-factor breakdown with expand-on-click progress bars
- [x] 08-02: Behavioral predictions stat cards + suggestions with effort tags in after-only format
- [x] 08-03: ResultsPanel v2 assembly, v2 loading skeletons, persona placeholder, warnings, dashboard/flow wiring, v1 removal

**Details:** Hero score with confidence badge and 5-factor TikTok breakdown. Behavioral predictions stat cards. Before/after suggestions with effort tags. Full v2 results panel assembly with v1 removal.

### Phase 9: Hybrid Rules & Dynamic Weights
**Goal**: Rules use hybrid regex+semantic evaluation with per-rule tracking and signal-adaptive weight selection
**Depends on**: Phase 5
**Plans**: 3 plans

Plans:
- [x] 09-01: Hybrid regex+semantic rule evaluation engine with tier classification and broken rule fix
- [x] 09-02: Per-rule accuracy tracking via rule_contributions JSONB storage and cron-based computation
- [x] 09-03: Dynamic weight selection adapting to signal availability with proportional redistribution

**Details:** Hybrid regex+semantic rule evaluation with batched DeepSeek-chat calls. Per-rule accuracy tracking. Dynamic weight selection with signal-adaptive proportional redistribution.

### Phase 10: Calibration & ML Training
**Goal**: Calibration infrastructure measures and corrects prediction accuracy, ML model trained on scraped video data
**Depends on**: Phase 5, Phase 1
**Plans**: 5 plans

Plans:
- [x] 10-01: ECE measurement pipeline with computeECE, calibration report, and admin API route
- [x] 10-02: Platt scaling fit/apply with gradient descent logistic regression and 24hr cached parameters
- [x] 10-03: Training data extraction from 7000+ scraped videos into 15-feature vectors with virality tier labels
- [x] 10-04: Multinomial logistic regression ML model training, persistence, and inference
- [x] 10-05: Monthly calibration audit cron (ECE + Platt refit + drift alert) and retrain-ml cron update

**Details:** ECE measurement pipeline with binned accuracy. Platt scaling with gradient descent. Multinomial logistic regression trained on scraped data. Monthly calibration audit cron with drift alerting.

### Phase 11: Enhanced Signals & Audio
**Goal**: Signal quality improved for audio matching, hashtag scoring, and scraper coverage
**Depends on**: Nothing (independent)
**Plans**: 3 plans

Plans:
- [x] 11-01: Jaro-Winkler fuzzy sound matching, trend phase volume fix, audioTrendingMatch wiring
- [x] 11-02: Semantic hashtag scoring with popularity weighting and saturation detection
- [x] 11-03: Configurable Apify scraper hashtags via env var + expanded defaults + traceability

**Details:** Pure-TypeScript Jaro-Winkler fuzzy matching replaces substring sound detection. Volume-aware trend classification. Semantic hashtag scoring with saturation detection. Configurable Apify scraper hashtags.

### Phase 12: E2E Flow Testing, Polish & Merge
**Goal**: Full customer experience verified, accuracy benchmarked, code cleaned up, merged to main
**Depends on**: All previous phases (1-11)
**Plans**: 2 plans

Plans:
- [x] 12-01: Accuracy benchmarking — 50 content samples through full pipeline with results report
- [x] 12-02: Build/lint fix, engine cleanup, full user flow verification in browser, merge to main

**Details:** E2E benchmark with 50 diverse content samples across 15 niches. Build/lint clean. Code merged to main.

### Phase 13: Engine Bug Fixes & Wiring (GAP CLOSURE)
**Goal**: Fix integration bugs and silent failures identified by milestone audit
**Depends on**: Phase 12
**Plans**: 2 plans

Plans:
- [x] 13-01: Fix validate-rules cron select, content_type derivation, video upload guard
- [x] 13-02: Wire DeepSeek reasoning_summary into PredictionResult.reasoning

**Details:** Three surgical fixes: rule_contributions in cron select, dynamic content_type from input_mode, video_upload sentinel guard. Plus reasoning_summary wiring.

### Phase 14: Video Upload Storage (GAP CLOSURE)
**Goal**: Wire video upload end-to-end from UI through Supabase Storage to Gemini video analysis
**Depends on**: Phase 13
**Plans**: 2 plans

Plans:
- [x] 14-01: Client-side Supabase Storage upload with progress tracking and real video_storage_path wiring
- [x] 14-02: Server-side video download from Storage and pipeline routing to Gemini video analysis

**Details:** Supabase Storage upload with simulated progress. Real video_storage_path wiring. Server-side download to Gemini video analysis pipeline.

### Phase 15: UI Polish & Remaining Gaps (GAP CLOSURE)
**Goal**: Close remaining UI gaps — persona reactions, history thumbnails, and benchmark validation
**Depends on**: Phase 14
**Plans**: 2 plans

Plans:
- [x] 15-01: Remove persona placeholder, wire history video indicators
- [x] 15-02: Benchmark env-gated documentation and compilation validation

**Details:** Removed persona reactions placeholder. Added Video icon indicator for video_upload history items. Benchmark script documented with env-gated setup instructions.

---

## Milestone Summary

**Key Decisions:**
- Algorithm-aligned WES: (likes x1 + comments x2 + shares x3) / views mirrors TikTok 2025 point system
- Share rate is #1 measurable virality KPI — viral threshold at 1.83% (p90)
- DeepSeek V3.2-reasoning (70% cheaper, 2x faster than R1)
- 5-step CoT framework: Completion, Engagement, Pattern Match, Fatal Flaw, Final Scores
- Behavioral predictions replace abstract scores (completion_pct, share_pct, comment_pct, save_pct)
- New aggregation formula: behavioral 45% + gemini 25% + rules 20% + trends 10%
- Video errors fail hard — no partial results, no fallback to text mode
- Pure TypeScript multinomial logistic regression — no external ML libraries
- Simulated upload progress since Supabase JS v2 lacks native progress events

**Issues Resolved:**
- validate-rules cron selecting wrong columns (rule_contributions not in query)
- content_type hardcoded to "video" instead of derived from input_mode
- Empty reasoning field in PredictionResult (reasoning_summary not wired)
- Video upload sentinel "pending-upload" reaching pipeline (now returns 400)
- Persona reactions placeholder left in results panel (removed)

**Issues Deferred:**
- Apify actor for TikTok URL to video extraction needs live testing (direct URLs expire)
- DeepSeek V3.2-reasoning availability/API endpoint needs production verification
- Supabase Storage bucket creation needed in production
- Outcome Collection UX (predicted vs actual comparison) — deferred to v3
- Multi-platform algorithm variants (Instagram/YouTube/Twitter) — deferred to v3

**Technical Debt Incurred:**
- Supabase generated types not regenerated for new columns (type assertions used)
- Simulated upload progress (0-90% via setInterval) instead of real progress
- ML model achieves 31% accuracy on 5-class problem (vs 20% random baseline) — needs more training data
- ESLint targeted ignores for pre-existing non-engine code

---
*Archived: 2026-02-17*
*For current project status, see .planning/ROADMAP.md*
