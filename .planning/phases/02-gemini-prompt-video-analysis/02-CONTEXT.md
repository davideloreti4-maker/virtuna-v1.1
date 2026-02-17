# Phase 2: Gemini Prompt + Video Analysis - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite Gemini prompts to return 5 TikTok-aligned evaluation factors (scored 0-10) with rationales and improvement tips. Enable full video content analysis for video inputs. Text/script-only analysis continues to work without video. Cost estimation uses actual token-based pricing internally (users see credits, not costs).

</domain>

<decisions>
## Implementation Decisions

### Factor Definitions & Scoring
- Keep 5 factors: Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge
- Absolute scoring (0.0-10.0 scale, one decimal) — universal quality standards, not niche-relative
- Each factor returns: score (decimal) + rationale (1-2 sentences why) + improvement tip (actionable suggestion)
- Scores are content-quality focused — TikTok algorithm weights are NOT applied by Gemini (handled downstream)

### Video vs Text Mode Behavior
- Video mode: Gemini analyzes video visuals ONLY (not caption/script) — users upload from gallery
- Text mode: Gemini analyzes script/caption text only — lower accuracy, clearly separate path
- Video inputs unlock additional video-specific signals beyond the 5 factors (visual_production_quality, hook_visual_impact, pacing_score, transition_quality)
- Video duration cap: 3 minutes maximum
- On video analysis failure: return error, NO partial/fallback result — user should retry or switch to text mode

### Prompt Calibration
- Embed key viral thresholds from calibration-baseline.json directly in the Gemini prompt
- Load calibration data dynamically from JSON at runtime (not hardcoded) — auto-updates when Phase 10 recalibrates
- Gemini scores pure content quality — algorithm knowledge (shares 3x, comments 2x, likes 1x) stays downstream in aggregation/DeepSeek
- Pass niche as input field in user message — enables niche-specific factor rationales and tips without anchoring scores

### Model Selection & Cost
- Gemini Flash for both text and video analysis (~$0.002/video, ~$0.0002/text)
- Easy upgrade path to Pro if Phase 12 benchmarking shows Flash underperforming (one-line model change)
- Soft cost cap with logging — log when analysis exceeds threshold but don't abort
- Users consume credits (1 analysis = 1 credit regardless of input mode) — raw costs are internal only

### Claude's Discretion
- Exact prompt template structure and few-shot examples
- Video frame sampling strategy (how many frames, which ones)
- Token budget allocation between factors
- Soft cost cap threshold value
- Specific video-specific signal definitions beyond the 4 named ones

</decisions>

<specifics>
## Specific Ideas

- Factor tips should be niche-aware and actionable ("your hook would work better with a before/after reveal for fitness content")
- The 5 factors map to key algorithm signals: hook (Scroll-Stop), retention (Completion Pull), replay (Rewatch), sharing (Share Trigger), emotion (Emotional Charge)
- Credit system means Gemini cost optimization is an internal concern, not user-facing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-gemini-prompt-video-analysis*
*Context gathered: 2026-02-16*
