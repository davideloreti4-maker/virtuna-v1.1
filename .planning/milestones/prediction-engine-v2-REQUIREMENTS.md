# Requirements Archive: Prediction Engine v2

**Archived:** 2026-02-17
**Original defined:** 2026-02-16
**Core Value:** AI-powered content intelligence that tells creators whether their content will resonate — and exactly why — before they post.

## Milestone Requirements — All Complete

### Engine Core

- [x] **ENG-01**: Engine produces 5 TikTok-aligned factors (Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge) each scored 0-10
- [x] **ENG-02**: Engine outputs behavioral predictions (completion_pct, share_pct, comment_pct) instead of abstract scores
- [x] **ENG-03**: Engine uses FeatureVector as standardized signal backbone between all pipeline stages
- [x] **ENG-04**: Engine uses new aggregation formula (behavioral 45% + gemini 25% + rules 20% + trends 10%)
- [x] **ENG-05**: Gemini factor scores contribute to final prediction score (currently 0%)
- [x] **ENG-06**: Engine returns reasoning text, warnings array, and feature_vector in PredictionResult
- [x] **ENG-07**: Engine confidence is numeric (signal availability + model agreement), not categorical

### Video Analysis

- [x] **VID-01**: User can submit a TikTok URL for analysis (server extracts video via Apify)
- [x] **VID-02**: User can upload a video file for analysis (Supabase Storage bucket)
- [x] **VID-03**: Gemini analyzes full video content (hook quality, pacing, transitions, production quality)
- [x] **VID-04**: Video-specific factors populate when video provided (visual_production_quality, hook_visual_impact, pacing_score)
- [x] **VID-05**: Text/script input mode continues to work as before

### Model Switch

- [x] **MOD-01**: DeepSeek switches from R1 to V3.2-reasoning (70% cheaper, 2x faster)
- [x] **MOD-02**: DeepSeek uses 5-step CoT framework (Completion -> Share -> Pattern -> Fatal Flaw -> Score)
- [x] **MOD-03**: Cost estimation uses actual token-based pricing (not hardcoded values)

### Pipeline Architecture

- [x] **PIPE-01**: Pipeline restructured to 10 stages with Wave 1 (Gemini + Audio + Creator) and Wave 2 (DeepSeek + Trends)
- [x] **PIPE-02**: Creator Context stage queries creator_profiles for engagement baseline and viral relativity
- [x] **PIPE-03**: Input normalization converts AnalysisInput -> ContentPayload (hashtag extraction, duration hints, TikTok URL resolution)
- [x] **PIPE-04**: Pipeline uses Promise.allSettled() for partial failure recovery with warnings
- [x] **PIPE-05**: Gemini receives structured signals only (no scores) to prevent anchoring

### Infrastructure

- [x] **INFRA-01**: Rate limiting enforces per-tier daily limits (free: 5/day, starter: 50/day, pro: unlimited)
- [x] **INFRA-02**: In-memory caching for rules (1hr TTL), trending_sounds (5min), scraped_videos (15min)
- [x] **INFRA-03**: Circuit breaker uses exponential backoff (1s->3s->9s) with half-open state
- [x] **INFRA-04**: Input validation (max 10K chars, video URL format, TikTok URL detection)

### Rules Engine

- [x] **RULE-01**: Hybrid rules: deterministic regex tier + semantic DeepSeek evaluation tier
- [x] **RULE-02**: Broken rules fixed or disabled (loop_structure, emotional_arc, text_overlay)
- [x] **RULE-03**: Per-rule accuracy tracking via rule_contributions JSONB
- [x] **RULE-04**: Dynamic weight selection adapts to available signals and signal strength

### Upload & Results UI

- [x] **UI-01**: Content form supports 3 input mode tabs (Text, TikTok URL, Video Upload)
- [x] **UI-02**: Video upload with drag-drop, progress indicator, thumbnail preview
- [x] **UI-03**: Results show 5 TikTok factors with scores, progress bars, descriptions, tips
- [x] **UI-04**: Results show behavioral predictions (completion %, share %, comment %)
- [x] **UI-05**: Suggestions display as before/after format grouped by category and priority
- [x] **UI-06**: Persona reactions removed (DeepSeek schema dropped persona_reactions — clean removal)
- [x] **UI-07**: SSE loading phases match new pipeline stages
- [x] **UI-08**: Analysis history shows video icon for video analyses
- [x] **UI-09**: Warnings display as subtle alert banners
- [x] **UI-10**: Variants section and Themes section removed

### Calibration & ML

- [x] **CAL-01**: Data analysis script mines 5000 scraped videos for virality patterns and thresholds
- [x] **CAL-02**: ECE measurement pipeline computes calibration error from predicted vs actual
- [x] **CAL-03**: Platt scaling recalibrates raw scores via logistic regression coefficients
- [x] **CAL-04**: ML model trained on scraped video FeatureVectors -> predicted virality
- [x] **CAL-05**: Monthly calibration audit cron re-fits parameters and alerts on drift

### Enhanced Signals

- [x] **SIG-01**: Fuzzy sound matching replaces substring with Jaro-Winkler similarity
- [x] **SIG-02**: Trend phase classification factors in absolute volume (not just growth rate)
- [x] **SIG-03**: Semantic hashtag scoring with popularity weighting and saturation detection
- [x] **SIG-04**: Apify scraper supports configurable niche-specific hashtag lists

## Requirement Outcomes

| Requirement | Phase | Outcome |
|-------------|-------|---------|
| ENG-01 | Phase 2 | Validated — 5 factors returned by Gemini |
| ENG-02 | Phase 3 | Validated — behavioral predictions in DeepSeek output |
| ENG-03 | Phase 4 | Validated — FeatureVector type defined and used |
| ENG-04 | Phase 5 | Validated — new formula in aggregator.ts |
| ENG-05 | Phase 2 | Validated — Gemini contributes 25% to score |
| ENG-06 | Phase 4, 13 | Validated — reasoning wired in Phase 13 fix |
| ENG-07 | Phase 4 | Validated — numeric confidence 0-1 |
| VID-01 | Phase 4, 7 | Validated — TikTok URL input mode |
| VID-02 | Phase 4, 7, 14 | Validated — Supabase Storage upload wired |
| VID-03 | Phase 2 | Validated — Gemini video analysis via Files API |
| VID-04 | Phase 2 | Validated — video-specific factors populate |
| VID-05 | Phase 2 | Validated — text mode continues to work |
| MOD-01 | Phase 3 | Validated — V3.2-reasoning model configured |
| MOD-02 | Phase 3 | Validated — 5-step CoT in prompt |
| MOD-03 | Phase 3 | Validated — token-based cost estimation |
| PIPE-01 | Phase 5 | Validated — 10-stage wave pipeline |
| PIPE-02 | Phase 5 | Validated — Creator Context stage |
| PIPE-03 | Phase 4 | Validated — normalize.ts conversion |
| PIPE-04 | Phase 5 | Validated — allSettled with warnings |
| PIPE-05 | Phase 5 | Validated — no scores to DeepSeek |
| INFRA-01 | Phase 6 | Validated — per-tier rate limiting |
| INFRA-02 | Phase 6 | Validated — TTL caching |
| INFRA-03 | Phase 6 | Validated — exponential backoff |
| INFRA-04 | Phase 6 | Validated — input validation |
| RULE-01 | Phase 9 | Validated — hybrid regex+semantic |
| RULE-02 | Phase 9 | Validated — broken rules fixed |
| RULE-03 | Phase 9, 13 | Validated — rule_contributions JSONB, cron fixed |
| RULE-04 | Phase 9 | Validated — dynamic weight selection |
| UI-01 | Phase 7 | Validated — 3 input mode tabs |
| UI-02 | Phase 7, 14 | Validated — drag-drop with Storage upload |
| UI-03 | Phase 8 | Validated — 5-factor breakdown |
| UI-04 | Phase 8 | Validated — behavioral predictions cards |
| UI-05 | Phase 8 | Validated — before/after suggestions |
| UI-06 | Phase 8, 15 | Adjusted — placeholder removed (not re-implemented) |
| UI-07 | Phase 8 | Validated — SSE loading phases |
| UI-08 | Phase 8, 15 | Adjusted — Video icon, not thumbnail |
| UI-09 | Phase 8 | Validated — warning banners |
| UI-10 | Phase 8 | Validated — variants/themes removed |
| CAL-01 | Phase 1 | Validated — 7,321 videos analyzed |
| CAL-02 | Phase 10 | Validated — ECE pipeline |
| CAL-03 | Phase 10 | Validated — Platt scaling |
| CAL-04 | Phase 10 | Validated — ML model trained (31% acc) |
| CAL-05 | Phase 10 | Validated — monthly audit cron |
| SIG-01 | Phase 11 | Validated — Jaro-Winkler fuzzy matching |
| SIG-02 | Phase 11 | Validated — volume-aware trends |
| SIG-03 | Phase 11 | Validated — semantic hashtag scoring |
| SIG-04 | Phase 11 | Validated — configurable Apify hashtags |

**Coverage:** 47/47 requirements validated or adjusted. 0 dropped.

## Notes on Adjusted Requirements

- **UI-06** (Persona reactions): Original spec called for "names, quotes, sentiment, wouldShare badge." DeepSeek schema intentionally dropped persona_reactions in Phase 3 to redirect tokens to accuracy. Persona section cleanly removed in Phase 15.
- **UI-08** (History thumbnails): Original spec called for "video thumbnails." Since video_storage_path is not persisted in analysis_results and generating signed URLs in a list would be expensive, a Video icon indicator was used instead.

## Future Requirements (Deferred to v3)

- **OUT-01**: User can report actual content performance after posting
- **OUT-02**: System compares predicted vs actual for ground truth calibration
- **OUT-03**: Outcome data feeds back into ML model retraining
- **PLAT-01**: Platform-specific algorithm prompts for Instagram, YouTube, Twitter
- **PLAT-02**: Platform-specific weight profiles in aggregator

---
*Archived: 2026-02-17*
