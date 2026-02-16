# Phase 1: Data Analysis - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce data-driven virality patterns and thresholds from ~5000 scraped TikTok videos. Output: calibration-baseline.json (machine-readable) and a human-readable summary report. This phase is analysis only — no engine changes, no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Virality definition
- Primary metric: engagement rate relative to account size (normalized), not raw view counts
- Need to research and determine the exact composite formula during analysis — blend of engagement rate, shares/views, comments/views normalized by reach
- Global baseline (vs all TikTok content) for v2 launch. Niche-aware and creator-history comparisons deferred to later phases
- 5 tiers: 0-25 Unlikely to perform, 25-45 Below average, 45-65 Average, 65-80 Strong potential, 80-100 Viral potential
- Encouraging/calibrated distribution: most content should land in the 40-65 range. "Viral" (80+) is achievable but selective
- Compute key differentiators: what factors separate viral-tier content from average-tier (e.g., "viral videos are 23% shorter, use trending sounds 3x more")

### Pattern priorities
- Mine ALL available fields equally: duration, hashtags, sounds, engagement ratios, category, description
- Description/caption: light analysis only — caption length correlation with virality. No deep NLP
- Dataset comes from general FYP scraping (trending/viral/fyp hashtags), not niche-specific

### Output format
- Two outputs: calibration-baseline.json (machine-readable) + markdown summary report (human-readable)
- JSON structure: Claude's discretion — organize by domain or consumer, whichever makes most sense for downstream phases
- Report location: Claude's discretion
- Script re-runnability: Claude's discretion

### Data filtering
- Filter extreme outliers (celebrity accounts with 10M+ followers, videos with 0 views). Keep the statistical middle
- ~40% of dataset expected to be duplicates — deduplication by platform_video_id is a critical first step
- Include a "data quality" section in the report showing exclusion counts, duplicate removal, and reasons

### Claude's Discretion
- JSON structure (by domain vs by consumer)
- Summary report location (.planning/research/ or scripts/)
- Whether script is re-runnable/idempotent
- Niche detection and breakdown in report (if it adds value for downstream phases)
- Exact outlier filtering thresholds (percentile cutoffs)
- Composite virality formula specifics (to be determined from the data)

</decisions>

<specifics>
## Specific Ideas

- Engagement rate relative to account size is the core metric — raw views are misleading
- The tool should feel "encouraging/calibrated" — most content scores average, viral is achievable but meaningful
- Key differentiators between tiers are essential — downstream prompts (Gemini, DeepSeek) need real data to cite
- Hashtags aren't available when users upload videos/scripts, so content-intrinsic patterns matter most for the prediction engine itself

</specifics>

<deferred>
## Deferred Ideas

- Niche-aware scoring baseline — future phase (requires niche detection + per-niche data depth)
- Creator history comparison ("this will do 2x your average") — when creator profiles mature
- Deep NLP on captions/descriptions — not needed for v2 launch

</deferred>

---

*Phase: 01-data-analysis*
*Context gathered: 2026-02-16*
