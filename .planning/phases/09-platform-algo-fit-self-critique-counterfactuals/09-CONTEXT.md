# Phase 9: Platform Algo Fit + Self-Critique + Counterfactuals - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Three coupled post-Wave-3 stages that complete the engine's signal set before aggregation and add two post-aggregation passes:

1. **Platform algo-fit** (pre-aggregator) — AI-scored per-platform fit signal. V3 reads full pipeline output + creator context and returns a fit score + written rationale per targeted platform. Score feeds into the aggregator as a new signal. Runs after Wave 3 (needs persona data) and before the aggregator.

2. **Self-critique** (post-aggregator, Stage 10) — V3 reads the full PredictionResult, checks for internal inconsistencies, cross-references creator's Card 6 wins/flops. Lowers `confidence` when contradictions are found (max -20%). Does NOT change `overall_score`. Returns written explanation with specifics.

3. **Counterfactuals** (post-aggregator, Stage 11) — V3 generates exactly 3 hyper-specific, ranked suggestions with concrete actions. Anchored to Phase 5 timestamps when available. Always runs. Anti-virality warning fires when score < 30 AND confidence > 70%.

**Pipeline order for Phase 9:**
```
Wave 3 (personas complete)
    ↓
Platform-fit V3 call  ← new, pre-aggregator
    ↓
Aggregator (includes platform-fit score as new signal)
    ↓
Stage 10: Self-critique V3  ← fills existing stage10-critique.ts stub
    ↓
Stage 11: Counterfactuals V3  ← fills existing stage11-counterfactuals.ts stub
```

**Out of scope this phase:**
- UI rendering of platform-fit scores, critique, or counterfactuals — M2 (Intelligence Surface milestone)
- Aggregator weight calibration for the platform-fit signal — Phase 10 owns this
- Additional platforms beyond TikTok, IG Reels, YT Shorts
- Per-platform counterfactuals (one counterfactual set for all platforms)

</domain>

<decisions>
## Implementation Decisions

### Platform Algo-Fit Signal

- **D-01: AI-scored via V3 (`deepseek-chat`), not rule-based.** The V3 call reads the full pipeline context (Gemini analysis, audio signals, persona reactions, hook decomp, creator context) and scores how well THIS specific video fits each targeted platform. Rationale: the value is in contextual scoring ("this video is 7/10 TikTok fit because the hook is strong but no loop mechanism") — not a static formula. Lives in new `src/lib/engine/wave4/platform-fit.ts`.

- **D-02: One V3 call, all targeted platforms together.** The creator targets 1-3 platforms via Card 0 (multi-select). A single V3 call with all target platforms in the prompt is cheaper and lets the model reason about cross-platform trade-offs.

- **D-03: One fit score per targeted platform.** Output shape:
  ```ts
  type PlatformFitResult = {
    platform: "tiktok" | "ig_reels" | "yt_shorts";
    fit_score: number;        // 0-100
    rationale: string;        // written explanation (2-4 sentences)
    watermark_penalty: boolean;
  };
  ```
  Only platforms from Card 0 are scored. If Card 0 is empty, defaults to TikTok only.

- **D-04: Watermark detection → cross-platform penalty.** ANY platform watermark detected (TikTok, IG, YT) lowers the fit score on ALL OTHER targeted platforms. TikTok watermark → penalty on IG fit + YT fit. IG watermark → penalty on TikTok fit + YT fit. Watermark detection: extend the Phase 5 Gemini hook-segment call with a watermark flag (hook frame is where watermarks appear). Feed result into the platform-fit V3 call as a known constraint.

- **D-05: Platforms supported: TikTok, IG Reels, YT Shorts only.** Three platforms for Phase 9. Additional platforms deferred.

- **D-06: Creator-tier-aware scoring.** Platform fit score adjusts based on creator follower tier (nano/micro/mid/macro/mega). TikTok algorithmically favors nano-creators; this is surfaced in the V3 system prompt as a scoring constraint. V3 receives `creatorContext.follower_tier` and incorporates it into per-platform reasoning.

- **D-07: Platform-fit score feeds into the aggregator as a new signal.** Influences `overall_score`. Phase 10 owns final weight calibration — Phase 9 ships with a defensible initial weight (to be specified by the planner; follow the precedent of Phase 8's retrieval signal: ~0.05, small until corpus-evidence validates).

- **D-08: Pipeline placement = after Wave 3, before aggregator.** Platform-fit needs persona behavioral data (Wave 3 output) to reason about fit. It completes before `aggregateScores()` so the score can influence the final viral prediction.

### Self-Critique (Stage 10)

- **D-09: V3 receives full `PredictionResult`.** All fields available — overall_score, confidence, factors, warnings, signal_availability, behavioral predictions, persona aggregate, retrieval evidence, audio scores, reasoning text, creator Card 6 wins/flops from `creatorContext`. Full context enables the most accurate consistency checks.

- **D-10: Inconsistencies lower `confidence` only — NOT `overall_score`.** The aggregator already computed the score with all signals. Critique adjusts confidence to reflect "how much should we trust this score?" not "is the score wrong?".

- **D-11: Max confidence adjustment = -20 percentage points.** Hard cap. Prevents V3 from catastrophically dropping a high-confidence prediction on a minor inconsistency. Example: confidence = 0.85 → after critique max floor = 0.65.

- **D-12: Critique returns a written explanation with specifics.** `CritiqueResult.flags` are human-readable strings, not code labels. Example: "High viral score (82) but Gemini hook score was 2/10 — these signals contradict. Hook quality typically drives viral potential. Confidence reduced." Downstream: M2 surface shows this verbatim.

- **D-13: Consistency checks the critique runs (system prompt locked):**
  1. Signal agreement — gemini_score vs behavioral_score divergence > 30 pts
  2. Score-vs-factors — overall_score high (>70) but top factors negative, or vice versa
  3. Card 6 historical match — prediction pattern matches creator's known flop or win pattern
  4. Over-confidence with thin signals — HIGH confidence but multiple signals missing (audio=false, retrieval=false, etc.)

### Counterfactuals (Stage 11)

- **D-14: Always generates — not conditional on score.** Free for all tiers (COUNTER-03). Runs on every prediction regardless of score. Even high-scoring videos benefit from "here's what would make it viral vs. just good."

- **D-15: Exactly 3 suggestions, ranked by estimated impact (highest first).** Consistent output shape for M2 UI. Not 1-3, not up to 5 — exactly 3 ranked suggestions.

- **D-16: Hyper-specific with concrete actions.** NOT "improve your hook." YES: "Move the key visual reveal from 0:05 to 0:01 — the Phase 5 segment analysis shows 40% viewer drop-off at 0:02, before your main hook lands. Getting the visual payoff in frame 1 could recover this drop." Suggestions reference actual numbers, timestamps, and signal values from the pipeline output.

- **D-17: Anchor to Phase 5 timestamps when available.** Hook decomp (Phase 5) provides timestamped sub-scores. Use these as anchor points for counterfactual suggestions (e.g., "at 0:03, your hook visual impact score was 4/10"). When Phase 5 data unavailable (signal_availability.gemini_hook = false), V3 infers from available context.

- **D-18: Anti-virality warning threshold: score < 30 AND confidence > 70%.** When both conditions met, add "LIKELY_FLOP" warning to `PredictionResult.warnings[]` (existing field) — no new field needed. Warning text is written, actionable: "High confidence this video will underperform. Primary signals: [top 2 factors dragging the score]."

### creator-intelligence.md Embedding Strategy

- **D-19: Distilled per prompt — three separate extractions, not full doc injection.** At 5,195 words, the full doc is too large to inject in every V3 call. Each of the three V3 calls (platform-fit, critique, counterfactuals) gets a targeted excerpt:

  **Platform-fit prompt:** Platform Algorithm Insights section + Numerical Rules table rows 1-10 + creator-tier rules from Cross-Creator Consensus. (~400 tokens of grounding.)

  **Critique prompt:** Cross-Creator Consensus section (11 consensus items — highest confidence signals) + Numerical Rules table (full). (~500 tokens of grounding.)

  **Counterfactuals prompt:** Hook Formulas section (all creators) + Retention Mechanics section + Virality Triggers section. (~600 tokens of grounding.) System prompt for counterfactuals also includes the explicit instruction: "When suggesting changes, cite the creator framework you're drawing from (e.g., 'per Jenny Hoyos's 5-part structure, your Foreshadow step is missing')."

- **D-20: System prompts are stable / cache-eligible.** The distilled creator-intelligence excerpts live in the SYSTEM prompt (static, byte-identical across calls). Video-specific data lives in the USER message. This maximizes DeepSeek input cache hit rate (~95% after warmup, ~50× token cost discount).

### Feedback Quality (Core Design Constraint)

- **D-21: Precision and actionability are the primary value driver.** All three V3 calls are optimized for creator-facing usefulness — not just technical accuracy. Vague outputs ("your hook could be better") are a failure mode. The system prompt for each call explicitly instructs V3 to reference specific timestamps, specific scores, specific creator-tested frameworks, and specific expected impact. This is enforced via the JSON output schema and the prompt instruction "be specific enough that the creator knows exactly what to change and why."

### Claude's Discretion

- Initial aggregator weight for platform-fit signal: planner to propose, following Phase 8 precedent (~0.05 start, Phase 10 calibrates). Redistribute existing weights proportionally.
- Exact Zod schema for `PlatformFitResult[]` on `PredictionResult` — planner defines, following Phase 7/8 field addition patterns (`?` optional to preserve compile against existing consumers).
- Error handling / graceful degradation for platform-fit V3 call: follow the existing `gracefulDegrade` pattern in `aggregator.ts` — null result + `signal_availability.platform_fit = false` → weight redistributed.
- Stage event emission for platform-fit: follow Phase 6/7/8 `stage_start` / `stage_end` event pattern from `events.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 9 Requirements
- `.planning/REQUIREMENTS.md` §ALGO-01..06, §CRITIQUE-01..03, §COUNTER-01..04 — locked requirements for this phase

### Research Grounding
- `.planning/research/creator-intelligence.md` — source of truth for V3 prompt content. Contains 40 numerical rules, 14+ named frameworks, 11 Cross-Creator Consensus items, 6 platform-specific rules per TikTok/IG/YT. Researcher and planner MUST read this before designing any V3 prompt.

### Engine Architecture
- `src/lib/engine/stage10-critique.ts` — existing no-op stub, Phase 9 fills this
- `src/lib/engine/stage11-counterfactuals.ts` — existing no-op stub, Phase 9 fills this
- `src/lib/engine/types.ts` — `CritiqueResult`, `CounterfactualResult`, `PredictionResult`, `SignalAvailability` type definitions
- `src/lib/engine/aggregator.ts` — `aggregateScores()`, `selectWeights()`, `SignalAvailability` extension pattern (D-07 wiring point)
- `src/lib/engine/pipeline.ts` — wave orchestration, `onStageEvent` callback pattern, place to wire new platform-fit stage

### Prior Phase Patterns to Follow
- `.planning/phases/08-benchmark-retrieval/08-CONTEXT.md` — D-03b (new signal initial weight), D-04 (SignalAvailability extension pattern)
- `.planning/phases/07-multi-persona-simulation/07-CONTEXT.md` — D-04 (stable system prompt + variable user message for DeepSeek cache), D-07 (per-metric aggregation), D-09 (JSON output shape)
- `.planning/phases/05-video-segmentation-hook-decomposition/05-CONTEXT.md` — hook decomp timestamp format for D-17 anchoring

### Design System
- `BRAND-BIBLE.md` — Raycast design language (for any UI-adjacent type comments or field naming)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/engine/events.ts` — `emitStageStart` / `emitStageEnd` pattern. All new stages (platform-fit, critique, counterfactuals) MUST emit these events (Phase 3 D-01 granularity).
- `src/lib/engine/deepseek.ts` — existing V3 call infrastructure. Platform-fit, critique, and counterfactuals all use `deepseek-chat` (same model as Wave 3 personas).
- `src/lib/engine/wave3.ts` — parallel persona call pattern. Platform-fit runs sequentially (single call) so no parallelism needed, but the error-handling pattern is the model.
- `src/lib/engine/aggregator.ts` (`selectWeights`, `SignalAvailability`) — Phase 8 added `retrieval` signal following the exact pattern Phase 9 must follow for `platform_fit`.
- Phase 5 hook decomp result — available on the pipeline result as timestamped segment scores. Used by D-17 (counterfactual timestamp anchoring).

### Established Patterns
- **SignalAvailability extension:** Add new key to `SignalAvailability` interface in `types.ts`; aggregator reads it in `selectWeights()` to redistribute when signal absent. Phase 8's `retrieval: boolean` is the direct precedent.
- **Optional field on PredictionResult:** New fields added as `?: Type` to preserve compile against existing consumers (Phase 7 D-20, Phase 8 wiring).
- **Graceful degradation:** V3 call fails → null result → `signal_availability.platform_fit = false` → weight redistributed. Same as audio / retrieval signal degradation.
- **Zod output validation:** V3 JSON output parsed via Zod schema before use (established in Phase 3, used in Phase 7 persona schemas). Platform-fit, critique, counterfactual outputs each need a Zod schema.

### Integration Points
- `src/lib/engine/pipeline.ts` — new platform-fit stage wired between Wave 3 completion and the aggregator call.
- `src/lib/engine/gemini.ts` — watermark detection flag added to Phase 5 hook-segment Gemini prompt (D-04). The flag returns from `analyzeHookSegment()` and is passed into the platform-fit call.
- `src/lib/engine/aggregator.ts` — receives `platformFitResult` alongside existing signals, applies initial weight (~0.05, Phase 10 calibrates).

</code_context>

<specifics>
## Specific Ideas

- The user emphasized: **precision and actionability are the primary value driver** (D-21). The V3 prompt instruction "be specific enough that the creator knows exactly what to change and why" is non-negotiable — this is the differentiator from generic AI feedback.
- Counterfactuals should cite the creator framework by name when applicable (e.g., "per Jenny Hoyos's 5-part structure, your Foreshadow step is missing"). This grounds suggestions in real creator knowledge rather than generic AI advice.
- Watermark penalty: user noted it "won't happen much with users but still good to have" — implement but don't over-engineer. A simple boolean flag from Gemini + a scoring penalty constant in the platform-fit module is sufficient.
- Anti-virality warning language should name the top 2 factors dragging the score, not just state the score threshold was hit.

</specifics>

<deferred>
## Deferred Ideas

- Additional platforms (Pinterest, LinkedIn, Facebook Reels, Snapchat Spotlight) — user said "just the 3 for now"
- Per-platform counterfactuals (different suggestions for TikTok vs IG) — complexity not warranted yet
- UI rendering of platform-fit scores, critique text, counterfactuals — M2 (Intelligence Surface milestone)
- Aggregator weight calibration for platform-fit — Phase 10 owns this with corpus evidence
- Cross-platform repurposing analysis — already in PROJECT.md out-of-scope list

</deferred>

---

*Phase: 09-platform-algo-fit-self-critique-counterfactuals*
*Context gathered: 2026-05-20*
