# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** AI-powered content intelligence that tells creators whether their content will resonate -- and exactly why -- before they post.
**Current focus:** Phase 3 (next)

## Current Position

**Milestone:** Prediction Engine v2
**Phase:** 2 of 12 (Gemini Prompt & Video Analysis) -- COMPLETE
**Plan:** 1 of 1 in current phase
**Status:** Phase 2 complete, ready for Phase 3
**Last activity:** 2026-02-16 -- Phase 2 Plan 1 executed (Gemini prompt rewrite + video analysis)

Progress: [██░░░░░░░░░░░░░░] 7.7% (2/26 plans)

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | 01   | 5min     | 2     | 4     |
| 02    | 01   | 4min     | 2     | 2     |

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
Stopped at: Completed 02-01-PLAN.md (Phase 2 Gemini Prompt & Video Analysis complete)
Resume file: None
Next: `/gsd:execute-phase 3`

---
*State created: 2026-02-16*
*Last updated: 2026-02-16 -- Phase 2 complete*
