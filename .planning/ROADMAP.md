# Roadmap: Prediction Engine v2

## Overview

Transform the prediction engine from ~40-55% accuracy to ~75-85% through TikTok-aligned prompts, full video analysis, a 10-stage pipeline with FeatureVector backbone, behavioral predictions, ML training on 5000 scraped videos, and calibration infrastructure. 12 phases, 26 plans, milestone-scoped numbering starting at 1.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Data Analysis** - Mine 5000 scraped videos for virality patterns and thresholds
- [x] **Phase 2: Gemini Prompt + Video Analysis** - Rewrite Gemini with TikTok factors and enable full video analysis
- [x] **Phase 3: DeepSeek Prompt + Model Switch** - Rewrite DeepSeek with 5-step CoT and switch to V3.2-reasoning
- [x] **Phase 4: Types, Schema & DB Migration** - Define all v2 types, expand input schema, run DB migrations
- [ ] **Phase 5: Pipeline Architecture** - Restructure to 10-stage pipeline with new aggregation formula
- [ ] **Phase 6: Infrastructure Hardening** - Rate limiting, caching, partial failure recovery, circuit breaker
- [ ] **Phase 7: Upload & Input UI** - Video upload, TikTok URL input, updated content form
- [ ] **Phase 8: Results Card & Breakdown UI** - Factor breakdown, behavioral predictions, suggestions, personas
- [ ] **Phase 9: Hybrid Rules & Dynamic Weights** - Upgrade rules to hybrid semantic+regex, signal-adaptive weights
- [ ] **Phase 10: Calibration & ML Training** - ECE measurement, Platt scaling, ML model on scraped data
- [ ] **Phase 11: Enhanced Signals & Audio** - Fuzzy sound matching, semantic hashtags, expanded scraper
- [ ] **Phase 12: E2E Flow Testing, Polish & Merge** - Accuracy benchmarking, full user flow test, merge to main

## Phase Details

### Phase 1: Data Analysis
**Goal**: Produce data-driven virality patterns and thresholds from 5000 scraped TikTok videos
**Depends on**: Nothing (first phase)
**File Ownership**: `scripts/analyze-dataset.ts`, `src/lib/engine/calibration-baseline.json`
**Requirements**: CAL-01
**Success Criteria** (what must be TRUE):
  1. Data analysis script runs against scraped_videos table and outputs calibration-baseline.json
  2. Virality thresholds defined from real data distribution (p75, p90 view counts)
  3. Duration sweet spot, top hashtags, top sounds, and engagement ratios documented in output
**Plans**: 1 plan

Plans:
- [x] 1-01: Scraped Video Data Analysis

### Phase 2: Gemini Prompt + Video Analysis
**Goal**: Gemini returns 5 TikTok-aligned factors and can analyze full video content
**Depends on**: Phase 1
**File Ownership**: `src/lib/engine/gemini.ts`, `src/lib/engine/types.ts` (GeminiResponseSchema)
**Requirements**: VID-03, VID-04, VID-05, ENG-01, ENG-05
**Success Criteria** (what must be TRUE):
  1. Gemini returns 5 TikTok factors (Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge) each scored 0-10
  2. When a video URL is provided, Gemini analyzes visual content (hook quality, pacing, transitions)
  3. Video-specific factors (visual_production_quality, hook_visual_impact, pacing_score) populate for video inputs
  4. Text/script-only analysis continues to work without video
  5. Cost estimation uses actual token-based pricing instead of hardcoded values
**Plans**: 1 plan

Plans:
- [x] 02-01: Rewrite GeminiResponseSchema + prompt template + text/video analysis paths

### Phase 3: DeepSeek Prompt + Model Switch
**Goal**: DeepSeek uses V3.2-reasoning with structured 5-step CoT and outputs behavioral predictions
**Depends on**: Phase 1
**File Ownership**: `src/lib/engine/deepseek.ts`, `src/lib/engine/types.ts` (DeepSeekResponseSchema)
**Requirements**: MOD-01, MOD-02, MOD-03, ENG-02
**Success Criteria** (what must be TRUE):
  1. DeepSeek uses V3.2-reasoning model instead of R1
  2. Output includes behavioral predictions (completion_pct, share_pct, comment_pct)
  3. 5-step CoT framework produces structured reasoning (Completion, Share, Pattern, Fatal Flaw, Score)
  4. Cost estimation uses actual V3.2-reasoning token pricing
**Plans**: 1 plan

Plans:
- [x] 03-01: DeepSeek prompt rewrite with 5-step CoT, behavioral predictions, V3.2-reasoning cost estimation

### Phase 4: Types, Schema & DB Migration
**Goal**: All v2 types defined (FeatureVector, ContentPayload, PredictionResult), input schema expanded for 3 modes, DB migrated
**Depends on**: Phase 2, Phase 3
**File Ownership**: `src/lib/engine/types.ts` (master types), `src/lib/engine/normalize.ts`, `src/types/test.ts`, `supabase/` (migrations, seed)
**Requirements**: ENG-03, ENG-06, ENG-07, PIPE-03, VID-01, VID-02
**Success Criteria** (what must be TRUE):
  1. FeatureVector type exists as standardized signal backbone with all fields (hookScore, audioTrending, captionScore, etc.)
  2. AnalysisInput supports 3 input modes: text, TikTok URL, and video file upload
  3. PredictionResult includes reasoning, warnings, feature_vector, behavioral_predictions, and expanded meta
  4. DB migration runs clean with 7 new analysis_results columns, 2 rule_library columns, 3 new indexes
  5. Input normalization converts AnalysisInput to ContentPayload (hashtag extraction, duration hints, TikTok URL resolution)
**Plans**: 2 plans

Plans:
- [x] 4-01: FeatureVector, Input Schema & Type Definitions
- [x] 4-02: DB Migration & Input Normalization

### Phase 5: Pipeline Architecture
**Goal**: Pipeline restructured to 10 stages with Wave-based parallelism, Creator Context, and new aggregation formula
**Depends on**: Phase 4
**File Ownership**: `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts`, `src/lib/engine/creator.ts`, `src/app/api/analyze/route.ts`, `src/hooks/queries/use-analyze.ts`
**Requirements**: PIPE-01, PIPE-02, PIPE-04, PIPE-05, ENG-04
**Success Criteria** (what must be TRUE):
  1. Pipeline runs 10 stages in Wave 1 (Gemini + Audio + Creator parallel) and Wave 2 (DeepSeek + Trends parallel) structure
  2. Creator Context queries creator_profiles and returns engagement baseline (or null gracefully)
  3. Gemini factor scores contribute 25% to final prediction score (fixed from 0%)
  4. New aggregation formula applies: behavioral 45% + gemini 25% + rules 20% + trends 10%
  5. Confidence is a real numeric value based on signal availability and model agreement
**Plans**: 2 plans

Plans:
- [x] 5-01: Creator Context stage + 10-stage pipeline restructure with wave parallelism and per-stage timing
- [x] 5-02: V2 aggregation formula (behavioral 45% + gemini 25% + rules 20% + trends 10%), confidence calculation, FeatureVector assembly, API route + hook wiring

### Phase 6: Infrastructure Hardening
**Goal**: Production-ready infrastructure with rate limiting, caching, partial failure recovery, and improved circuit breaker
**Depends on**: Phase 5
**File Ownership**: `src/lib/cache.ts`, `src/app/api/analyze/route.ts` (rate limiting), `src/lib/engine/pipeline.ts` (allSettled), `src/lib/engine/deepseek.ts` (circuit breaker)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Rate limiting enforces per-tier daily limits (free: 5/day, starter: 50/day, pro: unlimited) and returns 429 when exceeded
  2. In-memory caching eliminates redundant DB queries for rules (1hr TTL), trending_sounds (5min), scraped_videos (15min)
  3. Partial stage failure produces warnings but completes analysis with available signals
  4. Circuit breaker uses exponential backoff (1s, 3s, 9s) with half-open recovery state
**Plans**: 1 plan

Plans:
- [ ] 6-01: Infrastructure Hardening

### Phase 7: Upload & Input UI
**Goal**: Users can upload videos, paste TikTok URLs, or enter text through a tabbed content form
**Depends on**: Phase 4
**File Ownership**: `src/components/app/video-upload.tsx`, `src/components/app/content-form.tsx`
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Content form has 3 input mode tabs: Text, TikTok URL, Video Upload
  2. Video upload supports drag-drop, progress indicator, thumbnail preview, and file removal
  3. Submitting any input mode hits /api/analyze with the correct payload fields
**Plans**: 2 plans

Plans:
- [ ] 7-01: Video Upload Component
- [ ] 7-02: Content Form Update

### Phase 8: Results Card & Breakdown UI
**Goal**: Results display shows factor breakdown, behavioral predictions, before/after suggestions, persona reactions, and updated loading states
**Depends on**: Phase 5
**File Ownership**: `src/components/app/simulation/results-panel.tsx`, `src/components/app/simulation/impact-score.tsx`, `src/components/app/simulation/behavioral-predictions.tsx`, `src/components/app/simulation/insights-section.tsx`, `src/components/app/simulation/loading-phases.tsx`, `src/components/app/simulation/attention-breakdown.tsx`, `src/components/app/test-history-item.tsx`, `src/stores/test-store.ts`
**Requirements**: UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. Results show 5 TikTok factors with scores, progress bars, descriptions, and tips
  2. Behavioral predictions (completion %, share %, comment %) display as visual metrics
  3. Suggestions show as before/after format grouped by category and sorted by priority
  4. Persona reactions show names, quotes, sentiment, and wouldShare badge
  5. SSE loading phases match new pipeline stage names and Variants/Themes sections are removed
**Plans**: 3 plans

Plans:
- [ ] 8-01: Score Display + Factor Breakdown
- [ ] 8-02: Behavioral Predictions + Suggestions Display
- [ ] 8-03: SSE Loading + Personas + History Update

### Phase 9: Hybrid Rules & Dynamic Weights
**Goal**: Rules use hybrid regex+semantic evaluation with per-rule tracking and signal-adaptive weight selection
**Depends on**: Phase 5
**File Ownership**: `src/lib/engine/rules.ts`, `src/lib/engine/deepseek.ts` (rule eval section), `src/lib/engine/aggregator.ts` (dynamic weights), `src/app/api/cron/validate-rules/route.ts`
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04
**Success Criteria** (what must be TRUE):
  1. Rules split into deterministic regex tier and semantic DeepSeek evaluation tier
  2. Broken rules (loop_structure, emotional_arc, text_overlay) are fixed or disabled
  3. Per-rule accuracy tracking stores rule_contributions JSONB in analysis_results
  4. Weight selection adapts to available signals and redistributes when signals are missing
**Plans**: 3 plans

Plans:
- [ ] 9-01: Semantic Rule Evaluation
- [ ] 9-02: Per-Rule Accuracy Tracking
- [ ] 9-03: Dynamic Weight Selection

### Phase 10: Calibration & ML Training
**Goal**: Calibration infrastructure measures and corrects prediction accuracy, ML model trained on scraped video data
**Depends on**: Phase 5, Phase 1
**File Ownership**: `src/lib/engine/calibration.ts`, `src/lib/engine/ml.ts`, `scripts/extract-training-data.ts`, `src/app/api/admin/calibration-report/route.ts`, `src/app/api/cron/retrain-ml/route.ts`, `src/app/api/cron/calibration-audit/route.ts`
**Requirements**: CAL-02, CAL-03, CAL-04, CAL-05
**Success Criteria** (what must be TRUE):
  1. ECE measurement pipeline computes calibration error from predicted vs actual using scraped video data
  2. Platt scaling recalibrates raw scores via logistic regression coefficients (A, B)
  3. ML model trained on scraped video FeatureVectors with measurable accuracy on test set
  4. Monthly calibration audit cron re-fits parameters and alerts on drift (ECE > 0.15)
**Plans**: 5 plans

Plans:
- [ ] 10-01: ECE Measurement Pipeline
- [ ] 10-02: Platt Scaling for Score Recalibration
- [ ] 10-03: ML Feature Extraction from Scraped Videos
- [ ] 10-04: ML Model Training
- [ ] 10-05: Monthly Calibration Audit Cron

### Phase 11: Enhanced Signals & Audio
**Goal**: Signal quality improved for audio matching, hashtag scoring, and scraper coverage
**Depends on**: Nothing (independent)
**File Ownership**: `src/lib/engine/trends.ts`, `src/lib/engine/fuzzy.ts`, `src/app/api/cron/calculate-trends/route.ts`, `src/app/api/cron/scrape-trending/route.ts`, `src/app/api/webhooks/apify/route.ts`
**Requirements**: SIG-01, SIG-02, SIG-03, SIG-04
**Success Criteria** (what must be TRUE):
  1. Sound matching uses Jaro-Winkler fuzzy similarity (threshold >0.7) instead of substring
  2. Trend phase classification factors in absolute volume alongside growth rate
  3. Hashtag scoring weights by popularity with saturation detection for overused tags
  4. Apify scraper supports configurable niche-specific hashtag lists via env var
**Plans**: 3 plans

Plans:
- [ ] 11-01: Fuzzy Sound Matching + Trend Phase Bug Fix
- [ ] 11-02: Semantic Hashtag Scoring
- [ ] 11-03: Expanded Apify Scraper

### Phase 12: E2E Flow Testing, Polish & Merge
**Goal**: Full customer experience verified, accuracy benchmarked, code cleaned up, merged to main
**Depends on**: All previous phases (1-11)
**File Ownership**: `scripts/benchmark.ts`, all engine + UI files (cleanup pass)
**Requirements**: (integration phase -- validates all prior requirements end-to-end)
**Success Criteria** (what must be TRUE):
  1. 50 diverse content samples benchmarked through full pipeline with v2 vs v1 score comparison
  2. Full user flow works in browser: upload video, paste TikTok URL, text input -- all three paths produce complete results
  3. Results card renders all sections: factors, behavioral predictions, suggestions, personas, warnings
  4. `pnpm build` and `pnpm lint` pass with zero errors
  5. Code merged to main branch
**Plans**: 2 plans

Plans:
- [ ] 12-01: Accuracy Benchmarking
- [ ] 12-02: Full User Flow Test, Code Cleanup & Merge

## Execution Waves

Wave groupings for parallel team dispatch. Phases within a wave have no inter-dependencies.

### Wave 1 (no dependencies)
- Phase 1: Data Analysis
- Phase 11: Enhanced Signals & Audio

### Wave 2 (depends on Wave 1)
- Phase 2: Gemini Prompt + Video Analysis (needs Phase 1)
- Phase 3: DeepSeek Prompt + Model Switch (needs Phase 1)

### Wave 3 (depends on Wave 2)
- Phase 4: Types, Schema & DB Migration (needs Phase 2 + Phase 3)

### Wave 4 (depends on Wave 3)
- Phase 5: Pipeline Architecture (needs Phase 4)
- Phase 7: Upload & Input UI (needs Phase 4)

### Wave 5 (depends on Wave 4)
- Phase 6: Infrastructure Hardening (needs Phase 5)
- Phase 8: Results Card & Breakdown UI (needs Phase 5)
- Phase 9: Hybrid Rules & Dynamic Weights (needs Phase 5)
- Phase 10: Calibration & ML Training (needs Phase 5 + Phase 1)

### Wave 6 (depends on ALL)
- Phase 12: E2E Flow Testing, Polish & Merge (needs Phases 1-11)

## Progress

**Execution Order:**
Phases execute in wave order. Within each wave, phases can run in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Analysis | 1/1 | ✓ Complete | 2026-02-16 |
| 2. Gemini Prompt + Video Analysis | 1/1 | ✓ Complete | 2026-02-16 |
| 3. DeepSeek Prompt + Model Switch | 1/1 | ✓ Complete | 2026-02-16 |
| 4. Types, Schema & DB Migration | 2/2 | ✓ Complete | 2026-02-16 |
| 5. Pipeline Architecture | 2/2 | ✓ Complete | 2026-02-16 |
| 6. Infrastructure Hardening | 0/1 | Not started | - |
| 7. Upload & Input UI | 0/2 | Not started | - |
| 8. Results Card & Breakdown UI | 0/3 | Not started | - |
| 9. Hybrid Rules & Dynamic Weights | 0/3 | Not started | - |
| 10. Calibration & ML Training | 0/5 | Not started | - |
| 11. Enhanced Signals & Audio | 0/3 | Not started | - |
| 12. E2E Flow Testing, Polish & Merge | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-16*
*Last updated: 2026-02-16 — Phase 5 complete*
