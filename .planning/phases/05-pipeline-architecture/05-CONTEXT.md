# Phase 5: Pipeline Architecture - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the prediction engine to a 10-stage pipeline with wave-based parallelism (Wave 1: Gemini + Audio + Creator parallel, Wave 2: DeepSeek + Trends parallel), Creator Context lookups, and a new aggregation formula (behavioral 45% + gemini 25% + rules 20% + trends 10%). This phase rewires the engine internals — no UI changes, no new input modes, no infrastructure hardening.

</domain>

<decisions>
## Implementation Decisions

### Stage failure behavior
- **All stages are required** — if any stage fails, the entire analysis fails. No partial results, no degraded mode.
- Both AI models (Gemini and DeepSeek) are essential — no fallback to one model alone
- Non-AI stages (rules, trends, audio, creator context) are also required — strict pipeline
- Error messages should be **specific**: tell the user which stage failed (e.g., "Analysis failed: video processing timed out"), not a generic error
- Retry/recovery logic is out of scope for this phase (belongs in Phase 6: Infrastructure Hardening)

### Creator Context strategy
- **Cold start**: Use platform-wide averages from scraped_videos as default baseline when creator has no profile
- **Score impact**: Creator data is **context only** — feeds into AI prompts for reasoning but does NOT directly modify the final aggregated score
- **Data scope**: Query full creator profile (follower count, avg views, engagement rate, niche, posting frequency)
- **Stage timing**: Creator Context runs in Wave 1 (parallel with Gemini + Audio) — fast DB query, results ready for DeepSeek in Wave 2

### Aggregation tuning
- Weight formula: behavioral 45% + gemini 25% + rules 20% + trends 10%
- **Confidence**: Combined formula using both signal availability AND model agreement (Gemini vs DeepSeek score direction)
- **Low confidence flag**: Below a threshold, add a warning like "Low confidence — limited signal data"
- **Score breakdown**: Include per-component contribution in the result (behavioral contributed X/10, gemini Y/10, etc.) for transparency
- Per-run cost tracking: calculate and store total API cost (Gemini tokens + DeepSeek tokens) per analysis

### Pipeline observability
- **Per-stage timing**: Log execution duration of each stage in the analysis result
- **SSE behavior**: Keep current behavior — SSE streams final result only, loading UI uses timed phases (real stage-by-stage SSE updates not needed)
- **Cost tracking**: Calculate and persist per-run API cost (Gemini + DeepSeek token usage)

### Claude's Discretion
- Whether weights are hardcoded or config-driven (maintainability call)
- Where to store pipeline telemetry (analysis_results JSONB column vs console logs)
- Exact confidence formula coefficients
- Low-confidence threshold value

</decisions>

<specifics>
## Specific Ideas

- Pipeline should fail fast and tell users exactly what broke — no guessing
- Creator context enriches the AI's reasoning but shouldn't bias the score directly
- Score breakdown enables future debugging and calibration work in Phase 10

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-pipeline-architecture*
*Context gathered: 2026-02-16*
