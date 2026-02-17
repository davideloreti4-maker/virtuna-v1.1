# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered content intelligence that tells creators whether their content will resonate -- and exactly why -- before they post.
**Current focus:** Gap closure phases 13-15

## Current Position

**Milestone:** Prediction Engine v2
**Phase:** 13 of 15 (Engine Bug Fixes & Wiring) -- COMPLETE + VERIFIED
**Plan:** 2 of 2 in current phase (all plans complete)
**Status:** Phase 13 complete and verified (4/4 must-haves pass) -- proceeding to Phase 14
**Last activity:** 2026-02-17 -- Phase 13 executed and verified

Progress: [██████████████████████████] 100% (28/28 plans)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | 01   | 5min     | 2     | 4     |
| 02    | 01   | 4min     | 2     | 2     |
| 03    | 01   | 3min     | 2     | 2     |
| 04    | 01   | 2min     | 2     | 1     |
| 04    | 02   | 2min     | 2     | 2     |
| 05    | 01   | 3min     | 2     | 3     |
| 05    | 02   | 2min     | 2     | 3     |
| 06    | 01   | 4min     | 3     | 6     |
| 07    | 01   | 3min     | 2     | 2     |
| 07    | 02   | 3min     | 2     | 4     |
| 08    | 01   | 2min     | 2     | 2     |
| 08    | 02   | 3min     | 2     | 2     |
| 08    | 03   | 4min     | 2     | 8     |
| 09    | 01   | 3min     | 2     | 1     |
| 09    | 02   | 3min     | 2     | 4     |
| 09    | 03   | 2min     | 2     | 1     |
| 10    | 01   | 2min     | 2     | 2     |
| 10    | 02   | 2min     | 1     | 1     |
| 10    | 03   | 2min     | 1     | 2     |
| 10    | 04   | 2min     | 1     | 2     |
| 10    | 05   | 2min     | 2     | 3     |
| 11    | 01   | 10min    | 2     | 4     |
| 11    | 02   | 2min     | 1     | 4     |
| 11    | 03   | 5min     | 2     | 2     |
| 12    | 01   | 12min    | 2     | 3     |
| 12    | 02   | 13min    | 4     | 11    |
| 13    | 01   | 2min     | 2     | 3     |
| 13    | 02   | 2min     | 2     | 3     |

## Accumulated Context

### Decisions

- [Execute 01-01]: Algorithm-aligned WES: (likes×1 + comments×2 + shares×3) / views mirrors TikTok 2025 point system
- [Execute 01-01]: Share rate is #1 measurable virality KPI — viral threshold at 1.83% (p90)
- [Execute 01-01]: Save rate (bookmarks/views) as high-intent signal — viral videos 217% higher
- [Execute 01-01]: Creator size normalization via 5 tiers — nano creators reach 28x audience, mega only 0.94x
- [Execute 01-01]: View velocity (views/day) weakly correlated with WES — content quality > timing
- [Execute 01-01]: Hashtags/sounds demoted to context signals, NOT primary algo ranking factors
- [Execute 01-01]: 5 virality tiers at p25/p50/p75/p90 weighted engagement score boundaries
- [Execute 02-01]: 5 TikTok factors replace generic factors: Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge
- [Execute 02-01]: Absolute scoring (not niche-relative), most content 4-7, above 8 exceptional
- [Execute 02-01]: Calibration thresholds embedded in Gemini prompt at runtime from calibration-baseline.json
- [Execute 02-01]: Token-based cost estimation with Flash pricing ($0.15/1M input, $0.60/1M output)
- [Execute 02-01]: Video analysis as separate function with Gemini Files API upload/poll/cleanup lifecycle
- [Execute 02-01]: Video errors fail hard — no partial results, no fallback to text mode
- [Execute 03-01]: 5-step CoT framework: Completion, Engagement, Pattern Match, Fatal Flaw, Final Scores
- [Execute 03-01]: Behavioral predictions replace refined_score (completion_pct, share_pct, comment_pct, save_pct with percentile context)
- [Execute 03-01]: 7 component sub-scores for Phase 5 aggregator (hook_effectiveness, retention_strength, shareability, comment_provocation, save_worthiness, trend_alignment, originality)
- [Execute 03-01]: Gemini signals stripped of numeric scores to prevent DeepSeek anchoring
- [Execute 03-01]: Token-based cost at V3.2-reasoning pricing ($0.28/1M input, $0.42/1M output)
- [Execute 03-01]: Dead v1 fields removed from DeepSeek schema (persona_reactions, variants, conversation_themes, refined_score)
- [Execute 04-01]: FeatureVector uses camelCase for TypeScript convention (hookScore not hook_score)
- [Execute 04-01]: AnalysisInput uses Zod .refine() for conditional field validation based on input_mode
- [Execute 04-01]: PredictionResult confidence is numeric 0-1 with separate confidence_label for UI display
- [Execute 04-01]: Deprecated v1 types removed now (PersonaReaction, Variant, ConversationTheme + Zod schemas)
- [Execute 04-01]: score_weights uses named keys (behavioral/gemini/rules/trends) instead of v1 (rule/trend/ml)
- [Execute 04-02]: All migration statements use IF NOT EXISTS for idempotent re-runs
- [Execute 04-02]: Array.from(Set) instead of spread for ES2017 target compatibility
- [Execute 04-02]: video_url passthrough in normalizeInput — actual URL resolution deferred to Phase 5
- [Execute 04-02]: Duration hint extraction is best-effort from text, overridden by Apify/video metadata in Phase 5
- [Execute 05-01]: Pipeline returns raw PipelineResult instead of calling aggregateScores -- separates orchestration from scoring
- [Execute 05-01]: Circuit breaker null treated as stage failure per LOCKED DECISION (all stages required)
- [Execute 05-01]: Trend enrichment runs parallel to DeepSeek with placeholder context -- final data in PipelineResult
- [Execute 05-01]: Platform averages computed from scraped_videos in JS with module-level cache
- [Execute 05-01]: Creator niche resolved from profile if not provided in input
- [Execute 05-02]: Behavioral score = avg of 7 DeepSeek component scores normalized to 0-100
- [Execute 05-02]: Gemini score = avg of 5 Gemini factor scores normalized to 0-100
- [Execute 05-02]: Confidence = signal availability (0-0.6) + model agreement direction (0-0.4)
- [Execute 05-02]: Low confidence warning auto-appended when confidence < 0.4
- [Execute 05-02]: API route simplified to single pipeline call + aggregate, no direct engine module imports
- [Execute 05-02]: Fallback BehavioralPredictions with 0/N-A for defensive null handling
- [Execute 06-01]: Generic TTL cache with no LRU -- dataset sizes small (50 sounds, 200 videos, 30 rules)
- [Execute 06-01]: Rules cached 1hr, trending sounds 5min, scraped videos 15min
- [Execute 06-01]: Rate limit check before SSE stream, usage increment after successful analysis
- [Execute 06-01]: Circuit breaker 1s/3s/9s exponential backoff with half-open probe state
- [Execute 06-01]: Creator, rules, trends are non-critical stages -- fallback with warning on failure
- [Execute 06-01]: Gemini and DeepSeek remain critical -- pipeline halts on their failure
- [Execute 06-01]: Pipeline warnings merged in API route (avoids modifying aggregator.ts)
- [Execute 07-01]: Thumbnail extraction seeks to min(0.5s, duration/4) for meaningful frame
- [Execute 07-01]: File validation checks both MIME type and extension as fallback
- [Execute 07-01]: TikTok URL fetch deduplication via lastFetchedUrl ref
- [Execute 07-01]: Paste handler uses setTimeout(0) to defer fetch after input state update
- [Execute 07-02]: Submit button always says "Test" (not dynamic per tab)
- [Execute 07-02]: Tab switching preserves all input via single formData state object
- [Execute 07-02]: Validation on submit only with Record<string, string> errors cleared per-field
- [Execute 07-02]: Type selector step removed -- flow goes trigger -> form -> results directly
- [Execute 07-02]: Dashboard-client updated alongside plan scope (Rule 3 deviation) for compilation
- [Execute 08-01]: Fixed factor display order (Scroll-Stop, Completion, Rewatch, Share, Emotional) for muscle memory over worst-first sort
- [Execute 08-01]: Score color thresholds: >=7 coral, >=4 default, <4 purple per LOCKED decision
- [Execute 08-01]: FactorBreakdown re-exported as AttentionBreakdown for backward compat during migration
- [Execute 08-02]: Caption component for xs-sized text (Text only supports sm/base/lg)
- [Execute 08-02]: Effort tag mapping: high=Quick Win, medium=Medium, low=Major via Badge variants
- [Execute 08-02]: Backward-compat InsightsSection re-export to avoid breaking existing imports before Plan 3
- [Execute 08-02]: GlassCard blur=sm glow=false for stat cards — subtle glass without heavy blur
- [Execute 08-03]: Persona reactions as placeholder GlassCard — DeepSeek schema removed them, section ready for future
- [Execute 08-03]: ShareButton resultId optional — v2 PredictionResult has no string ID, falls back to current URL
- [Execute 08-03]: currentResult/setCurrentResult kept in store for survey-form.tsx backward compat
- [Execute 08-03]: Direct PredictionResult pass-through — no mapping shim, analyzeMutation.data goes straight to ResultsPanel
- [Plan]: 12 phases, 26 plans derived from deep 6-agent analysis of current engine gaps
- [Plan]: Switch DeepSeek from R1 to V3.2-reasoning (70% cheaper, 2x faster)
- [Plan]: Full video analysis via Gemini Flash-Lite (~$0.008/30s video)
- [Plan]: Behavioral predictions replace abstract scores (completion_pct, share_pct, comment_pct)
- [Plan]: New aggregation formula: behavioral 45% + gemini 25% + rules 20% + trends 10%
- [Execute 09-01]: Local OpenAI client in rules.ts to avoid circular dependency with deepseek.ts
- [Execute 09-01]: deepseek-chat model for semantic eval (cheaper/faster than deepseek-reasoner)
- [Execute 09-01]: Single batched DeepSeek call for all semantic rules per analysis (~$0.001/batch)
- [Execute 09-01]: 15s timeout for semantic eval (simpler than 45s full reasoning)
- [Execute 09-01]: Cast through unknown for evaluation_tier (Supabase types not regenerated)
- [Execute 09-02]: Per-rule accuracy uses direction agreement (rule high score + actual >= predicted) not correlation
- [Execute 09-02]: Min 10 samples per rule before weight adjustment for statistical significance
- [Execute 09-02]: Type assertion cast for rule_contributions query -- Supabase generated types stale
- [Execute 09-02]: rule_contributions JSONB persisted per analysis with rule_id, score, max_score, tier
- [Execute 09-03]: Dynamic weight selection via selectWeights() — missing signal weight redistributed proportionally
- [Execute 09-03]: Signal availability checks matched_rules count AND pipeline warnings to distinguish failure from zero matches
- [Execute 09-03]: Confidence penalty -0.05 per missing signal (rules, trends) for honest confidence
- [Execute 09-03]: ENGINE_VERSION bumped to 2.1.0 to distinguish dynamic-weight aggregator results
- [Execute 10-01]: Scores normalized from 0-100 (DB) to 0-1 for ECE computation
- [Execute 10-01]: 10 equal-width bins by default for ECE, configurable via numBins parameter
- [Execute 10-01]: Admin route reuses CRON_SECRET Bearer auth pattern from cron routes
- [Execute 10-01]: fetchOutcomePairs exported publicly for reuse by Platt scaling (10-02) and audit cron (10-05)
- [Execute 10-02]: PlattCacheEntry wrapper to distinguish cache miss from cached null result (insufficient data)
- [Execute 10-02]: Gradient averaging per iteration for numerical stability across varying dataset sizes
- [Execute 10-02]: 50-sample minimum before Platt fitting to prevent overfitting on small datasets
- [Execute 10-03]: All 15 training features normalized to 0-1 range for ML compatibility (clamped via clamp01)
- [Execute 10-03]: Deterministic Fisher-Yates shuffle using video ID hash seeds for reproducible train/test splits
- [Execute 10-03]: Virality tier assignment reuses calibration-baseline.json WES percentile thresholds
- [Execute 10-03]: No extreme outlier filtering for training data -- let ML model learn from full distribution
- [Execute 10-04]: Pure TypeScript multinomial logistic regression -- no external ML libraries for small bundle and simple deployment
- [Execute 10-04]: 31% test accuracy on 5-class problem (vs 20% random baseline) using engagement rate features
- [Execute 10-04]: Module-level cachedWeights for single-load-per-cold-start performance
- [Execute 10-04]: Tier midpoint score conversion: [12.5, 35, 55, 72.5, 90] weighted by class probabilities
- [Execute 10-04]: featureVectorToMLInput uses 0.5 defaults for engagement metrics not in FeatureVector
- [Execute 10-05]: 90-day lookback window for calibration audit to ensure meaningful ECE sample size
- [Execute 10-05]: ECE drift threshold 0.15 — below 0.10 well-calibrated, 0.10-0.15 acceptable, above needs attention
- [Execute 10-05]: Training data from scraped videos not outcomes — removed MIN_OUTCOMES_FOR_TRAINING gate
- [Execute 10-05]: Outcome count in retrain-ml response for monitoring only, does not gate training
- [Execute 11-01]: Case-insensitive Jaro-Winkler with Winkler prefix boost (p=0.1, max 4 chars)
- [Execute 11-01]: Exact substring match short-circuits to score 1.0 before computing Jaro-Winkler
- [Execute 11-01]: classifyTrendPhase: totalViews >= 500K with growthRate >= -0.2 classified as peak
- [Execute 11-01]: audioTrendingMatch = max velocity_score / 100 from matched trends (0-1 normalized)
- [Execute 11-02]: Saturation blocklist: #fyp, #foryou, #foryoupage, #viral, #trending, #xyzbca
- [Execute 11-02]: Saturation threshold: hashtag appearing in > 40% of scraped videos
- [Execute 11-02]: Log10-scaled popularity prevents mega-view tags from dominating relevance
- [Execute 11-02]: maxExpectedRelevance = 3 calibration: 3 highly-relevant trending hashtags scores ~1.0
- [Execute 11-02]: Saturated tags contribute 10% of normal weight to trend_score (not useless, just not differentiating)
- [Execute 12-01]: tsconfig-paths for runtime @/ alias resolution in scripts instead of rewriting engine imports
- [Execute 12-01]: Benchmark uses graceful API key handling: warn and continue instead of hard exit
- [Execute 12-01]: content_type mapped to valid schema values: image->post, text->thread, carousel->post
- [Execute 12-01]: benchmark-results.json gitignored as runtime data varying per environment
- [Execute 12-02]: ESLint targeted ignores for pre-existing non-engine code (extraction, hive, motion, visualization, viral-results)
- [Execute 12-02]: Direct merge with -X theirs strategy: milestone branch wins all conflicts
- [Execute 12-02]: themes-section.tsx and variants-section.tsx deleted during merge (v1 sections removed)
- [Execute 12-02]: Modify/delete conflicts resolved: 7 kept from milestone, 2 deleted (v1 sections)
- [Plan]: Personas are theater/UX, not accuracy signal -- lightweight 2-3 sentences each
- [Plan]: Remove conversation_themes and variants to redirect tokens to accuracy
- [Plan]: Pass structured Gemini signals to DeepSeek (no scores) to prevent anchoring
- [Execute 13-01]: text input_mode maps to content_type "thread" (closest DB enum for text-only content)
- [Execute 13-01]: video_storage_path must start with "videos/" prefix (Supabase Storage bucket convention)
- [Execute 13-02]: reasoning_summary as explicit JSON field (2-3 sentences) rather than extracting reasoning_content from API response
- [Execute 13-02]: z.string().min(10).max(500) validation ensures non-trivial but bounded reasoning text

### Pending Todos

None yet.

### Blockers/Concerns

- Apify actor for TikTok URL to video extraction needs testing (direct URLs expire)
- DeepSeek V3.2-reasoning availability/API endpoint to verify
- Supabase Storage bucket creation needed for video uploads

## Session Continuity

Last session: 2026-02-17
Stopped at: Phase 13 COMPLETE + VERIFIED (28/28 plans, 4/4 must-haves)
Resume file: None
Next: Plan and execute Phase 14 (Video Upload Storage)

---
*State created: 2026-02-16*
*Last updated: 2026-02-17 -- Phase 13 COMPLETE (28/28 plans)*
