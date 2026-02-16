# Phase 3: DeepSeek Prompt + Model Switch - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite DeepSeek's prompt with a structured 5-step chain-of-thought framework and switch from R1 to V3.2-reasoning model. Output behavioral predictions with sub-scores for the Phase 5 aggregator. Personas are deferred to later phases.

</domain>

<decisions>
## Implementation Decisions

### Behavioral Predictions
- Output both absolute predictions AND percentile rank for context (e.g., "23% completion rate — top 30%")
- Claude's discretion on metric count (core 3 + save_pct if data supports it)
- Claude's discretion on per-prediction confidence qualifiers
- Percentile benchmarks should reference the scraped dataset — Claude picks the most defensible framing

### CoT Reasoning Structure
- 5-step CoT is internal only — users see final scores and predictions, not the reasoning chain
- Step 3 (Pattern Match) explicitly compares content against known viral patterns from calibration data (loop structure, duet bait, trending sounds, etc.)
- DeepSeek outputs component sub-scores (not a single overall score) — the Phase 5 aggregator combines them
- Claude's discretion on how fatal flaws surface to users (warnings vs high-priority suggestions)

### Gemini→DeepSeek Handoff
- Pass Gemini signals WITHOUT numeric scores to prevent anchoring
- Claude's discretion on exactly which signal types to pass (rationales, tips, or both)
- Video signals (visual production quality, hook visual impact, pacing, transitions) ARE passed to DeepSeek when available
- Claude's discretion on model role framing (second opinion vs independent) and calibration data inclusion

### Model Switch
- Switch from R1 to V3.2-reasoning — no fallback. If V3.2-reasoning is unavailable, fail hard (consistent with Gemini video error pattern)
- Use cost savings from V3.2-reasoning to invest in richer prompts — more calibration data, examples, detailed CoT instructions
- Personas deferred to Phase 5/8 — Phase 3 focuses on behavioral predictions + reasoning only
- Claude's discretion on auditing and removing dead v1 output fields beyond conversation_themes and variants

</decisions>

<specifics>
## Specific Ideas

- Pattern matching step should reference real viral patterns from the scraped dataset, not generic content theory
- Richer prompts enabled by cost savings — embed calibration baselines, viral examples, and detailed step-by-step reasoning instructions
- Sub-scores feed directly into the Phase 5 aggregation formula (behavioral 45% + gemini 25% + rules 20% + trends 10%)

</specifics>

<deferred>
## Deferred Ideas

- Persona reactions from DeepSeek — Phase 5 (pipeline) or Phase 8 (UI)
- Exposing CoT reasoning to users — could be a future "explain this score" feature

</deferred>

---

*Phase: 03-deepseek-prompt-model-switch*
*Context gathered: 2026-02-16*
