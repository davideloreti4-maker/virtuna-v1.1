# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered content intelligence that tells creators whether their content will resonate -- and exactly why -- before they post.
**Current focus:** Phase 6 (Infrastructure Hardening) -- COMPLETE, ready for Phase 7

## Current Position

**Milestone:** Prediction Engine v2
**Phase:** 6 of 12 (Infrastructure Hardening) -- COMPLETE
**Plan:** 1 of 1 in current phase -- Phase 6 complete
**Status:** Rate limiting, TTL caching, exponential backoff circuit breaker, partial failure recovery
**Last activity:** 2026-02-16 -- Phase 6 Plan 1 executed (infrastructure hardening)

Progress: [████████░░░░░░░░] 30.8% (8/26 plans)

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
- [Plan]: 12 phases, 26 plans derived from deep 6-agent analysis of current engine gaps
- [Plan]: Switch DeepSeek from R1 to V3.2-reasoning (70% cheaper, 2x faster)
- [Plan]: Full video analysis via Gemini Flash-Lite (~$0.008/30s video)
- [Plan]: Behavioral predictions replace abstract scores (completion_pct, share_pct, comment_pct)
- [Plan]: New aggregation formula: behavioral 45% + gemini 25% + rules 20% + trends 10%
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
Stopped at: Completed 06-01-PLAN.md (Infrastructure hardening: rate limiting, caching, circuit breaker, resilience)
Resume file: None
Next: Execute Phase 7

---
*State created: 2026-02-16*
*Last updated: 2026-02-16 -- Phase 6 complete (rate limiting + TTL caching + circuit breaker + partial failure recovery)*
