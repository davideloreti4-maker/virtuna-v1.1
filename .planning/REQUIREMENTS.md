# Requirements: Virtuna — Prediction Engine v2

**Defined:** 2026-02-16
**Core Value:** AI-powered content intelligence that tells creators whether their content will resonate — and exactly why — before they post.

## Milestone Requirements

Requirements for Prediction Engine v2. Each maps to roadmap phases.

### Engine Core

- [ ] **ENG-01**: Engine produces 5 TikTok-aligned factors (Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge) each scored 0-10
- [ ] **ENG-02**: Engine outputs behavioral predictions (completion_pct, share_pct, comment_pct) instead of abstract scores
- [ ] **ENG-03**: Engine uses FeatureVector as standardized signal backbone between all pipeline stages
- [ ] **ENG-04**: Engine uses new aggregation formula (behavioral 45% + gemini 25% + rules 20% + trends 10%)
- [ ] **ENG-05**: Gemini factor scores contribute to final prediction score (currently 0%)
- [ ] **ENG-06**: Engine returns reasoning text, warnings array, and feature_vector in PredictionResult
- [ ] **ENG-07**: Engine confidence is numeric (signal availability + model agreement), not categorical

### Video Analysis

- [ ] **VID-01**: User can submit a TikTok URL for analysis (server extracts video via Apify)
- [ ] **VID-02**: User can upload a video file for analysis (Supabase Storage bucket)
- [ ] **VID-03**: Gemini analyzes full video content (hook quality, pacing, transitions, production quality)
- [ ] **VID-04**: Video-specific factors populate when video provided (visual_production_quality, hook_visual_impact, pacing_score)
- [ ] **VID-05**: Text/script input mode continues to work as before

### Model Switch

- [ ] **MOD-01**: DeepSeek switches from R1 to V3.2-reasoning (70% cheaper, 2x faster)
- [ ] **MOD-02**: DeepSeek uses 5-step CoT framework (Completion → Share → Pattern → Fatal Flaw → Score)
- [ ] **MOD-03**: Cost estimation uses actual token-based pricing (not hardcoded values)

### Pipeline Architecture

- [ ] **PIPE-01**: Pipeline restructured to 10 stages with Wave 1 (Gemini + Audio + Creator) and Wave 2 (DeepSeek + Trends)
- [ ] **PIPE-02**: Creator Context stage queries creator_profiles for engagement baseline and viral relativity
- [ ] **PIPE-03**: Input normalization converts AnalysisInput → ContentPayload (hashtag extraction, duration hints, TikTok URL resolution)
- [ ] **PIPE-04**: Pipeline uses Promise.allSettled() for partial failure recovery with warnings
- [ ] **PIPE-05**: Gemini receives structured signals only (no scores) to prevent anchoring

### Infrastructure

- [ ] **INFRA-01**: Rate limiting enforces per-tier daily limits (free: 5/day, starter: 50/day, pro: unlimited)
- [ ] **INFRA-02**: In-memory caching for rules (1hr TTL), trending_sounds (5min), scraped_videos (15min)
- [ ] **INFRA-03**: Circuit breaker uses exponential backoff (1s→3s→9s) with half-open state
- [ ] **INFRA-04**: Input validation (max 10K chars, video URL format, TikTok URL detection)

### Rules Engine

- [ ] **RULE-01**: Hybrid rules: deterministic regex tier + semantic DeepSeek evaluation tier
- [ ] **RULE-02**: Broken rules fixed or disabled (loop_structure, emotional_arc, text_overlay)
- [ ] **RULE-03**: Per-rule accuracy tracking via rule_contributions JSONB
- [ ] **RULE-04**: Dynamic weight selection adapts to available signals and signal strength

### Upload & Results UI

- [ ] **UI-01**: Content form supports 3 input mode tabs (Text, TikTok URL, Video Upload)
- [ ] **UI-02**: Video upload with drag-drop, progress indicator, thumbnail preview
- [ ] **UI-03**: Results show 5 TikTok factors with scores, progress bars, descriptions, tips
- [ ] **UI-04**: Results show behavioral predictions (completion %, share %, comment %)
- [ ] **UI-05**: Suggestions display as before/after format grouped by category and priority
- [ ] **UI-06**: Persona reactions show names, quotes, sentiment, wouldShare badge
- [ ] **UI-07**: SSE loading phases match new pipeline stages
- [ ] **UI-08**: Analysis history shows video thumbnails for video analyses
- [ ] **UI-09**: Warnings display as subtle alert banners
- [ ] **UI-10**: Variants section and Themes section removed

### Calibration & ML

- [ ] **CAL-01**: Data analysis script mines 5000 scraped videos for virality patterns and thresholds
- [ ] **CAL-02**: ECE measurement pipeline computes calibration error from predicted vs actual
- [ ] **CAL-03**: Platt scaling recalibrates raw scores via logistic regression coefficients
- [ ] **CAL-04**: ML model trained on scraped video FeatureVectors → predicted virality
- [ ] **CAL-05**: Monthly calibration audit cron re-fits parameters and alerts on drift

### Enhanced Signals

- [ ] **SIG-01**: Fuzzy sound matching replaces substring with Jaro-Winkler similarity
- [ ] **SIG-02**: Trend phase classification factors in absolute volume (not just growth rate)
- [ ] **SIG-03**: Semantic hashtag scoring with popularity weighting and saturation detection
- [ ] **SIG-04**: Apify scraper supports configurable niche-specific hashtag lists

## Future Requirements

Deferred to v3. Tracked but not in current roadmap.

### Outcome Collection

- **OUT-01**: User can report actual content performance after posting
- **OUT-02**: System compares predicted vs actual for ground truth calibration
- **OUT-03**: Outcome data feeds back into ML model retraining

### Multi-Platform

- **PLAT-01**: Platform-specific algorithm prompts for Instagram, YouTube, Twitter
- **PLAT-02**: Platform-specific weight profiles in aggregator

## Out of Scope

| Feature | Reason |
|---------|--------|
| Outcome Collection UX | Needs real user flow — defer to v3 for ground truth |
| Multi-platform algorithm variants | Instagram/YouTube/Twitter prompts — v3 |
| Content deduplication | Low priority vs accuracy gains |
| Score explanation UI (beyond factor cards) | Visual breakdown of score components — future polish |
| Monitoring dashboard | Real-time accuracy/cost tracking — operational concern |
| Light mode | Dark-mode first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 2 | Pending |
| ENG-02 | Phase 3 | Pending |
| ENG-03 | Phase 4 | Pending |
| ENG-04 | Phase 5 | Pending |
| ENG-05 | Phase 2 | Pending |
| ENG-06 | Phase 4 | Pending |
| ENG-07 | Phase 4 | Pending |
| VID-01 | Phase 4 | Pending |
| VID-02 | Phase 4 | Pending |
| VID-03 | Phase 2 | Pending |
| VID-04 | Phase 2 | Pending |
| VID-05 | Phase 2 | Pending |
| MOD-01 | Phase 3 | Pending |
| MOD-02 | Phase 3 | Pending |
| MOD-03 | Phase 3 | Pending |
| PIPE-01 | Phase 5 | Pending |
| PIPE-02 | Phase 5 | Pending |
| PIPE-03 | Phase 4 | Pending |
| PIPE-04 | Phase 5 | Pending |
| PIPE-05 | Phase 5 | Pending |
| INFRA-01 | Phase 6 | Pending |
| INFRA-02 | Phase 6 | Pending |
| INFRA-03 | Phase 6 | Pending |
| INFRA-04 | Phase 6 | Pending |
| RULE-01 | Phase 9 | Pending |
| RULE-02 | Phase 9 | Pending |
| RULE-03 | Phase 9 | Pending |
| RULE-04 | Phase 9 | Pending |
| UI-01 | Phase 7 | Pending |
| UI-02 | Phase 7 | Pending |
| UI-03 | Phase 8 | Pending |
| UI-04 | Phase 8 | Pending |
| UI-05 | Phase 8 | Pending |
| UI-06 | Phase 8 | Pending |
| UI-07 | Phase 8 | Pending |
| UI-08 | Phase 8 | Pending |
| UI-09 | Phase 8 | Pending |
| UI-10 | Phase 8 | Pending |
| CAL-01 | Phase 1 | Pending |
| CAL-02 | Phase 10 | Pending |
| CAL-03 | Phase 10 | Pending |
| CAL-04 | Phase 10 | Pending |
| CAL-05 | Phase 10 | Pending |
| SIG-01 | Phase 11 | Pending |
| SIG-02 | Phase 11 | Pending |
| SIG-03 | Phase 11 | Pending |
| SIG-04 | Phase 11 | Pending |

**Coverage:**
- Milestone requirements: 47 total (9 categories: ENG-7, VID-5, MOD-3, PIPE-5, INFRA-4, RULE-4, UI-10, CAL-5, SIG-4)
- Mapped to phases: 47
- Unmapped: 0

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation -- traceability complete*
