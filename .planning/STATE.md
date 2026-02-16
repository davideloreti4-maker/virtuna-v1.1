# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered content intelligence that tells creators whether their content will resonate -- and exactly why -- before they post.
**Current focus:** Phase 9 in progress -- Hybrid Rules & Dynamic Weights

## Current Position

**Milestone:** Prediction Engine v2
**Phase:** 9 of 12 (Hybrid Rules & Dynamic Weights) -- IN PROGRESS
**Plan:** 2 of 3 in current phase (09-02 complete, 09-01 pending)
**Status:** Phase 9 Plan 2 complete -- per-rule accuracy tracking with EMA weight adjustment
**Last activity:** 2026-02-16 -- Phase 9 Plan 2 executed (rule_contributions storage + per-rule accuracy cron)

Progress: [██████████████░░░] 53.8% (14/26 plans)

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
| 09    | 02   | 3min     | 2     | 4     |

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
- [Execute 09-02]: Per-rule accuracy uses direction agreement (rule high score + actual >= predicted) not correlation
- [Execute 09-02]: Min 10 samples per rule before weight adjustment for statistical significance
- [Execute 09-02]: Type assertion cast for rule_contributions query -- Supabase generated types stale
- [Execute 09-02]: rule_contributions JSONB persisted per analysis with rule_id, score, max_score, tier
- [Plan]: Personas are theater/UX, not accuracy signal -- lightweight 2-3 sentences each
- [Plan]: Remove conversation_themes and variants to redirect tokens to accuracy
- [Plan]: Pass structured Gemini signals to DeepSeek (no scores) to prevent anchoring

### Pending Todos

None yet.

### Blockers/Concerns

- Apify actor for TikTok URL to video extraction needs testing (direct URLs expire)
- DeepSeek V3.2-reasoning availability/API endpoint to verify
- Supabase Storage bucket creation needed for video uploads

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 09-02-PLAN.md (per-rule accuracy tracking + rule_contributions storage)
Resume file: None
Next: Phase 9 Plans 01 and 03 remaining

---
*State created: 2026-02-16*
*Last updated: 2026-02-16 -- Phase 9 Plan 2 complete (per-rule accuracy tracking, rule_contributions JSONB, EMA weight adjustment)*
