# Phase 9: Platform Algo Fit + Self-Critique + Counterfactuals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 09-platform-algo-fit-self-critique-counterfactuals
**Areas discussed:** Algo-fit computation, Pipeline placement, Critique grounding depth, Counterfactual generation trigger, Feedback quality (additional)

---

## Area 1: Algo-fit computation

| Option | Description | Selected |
|--------|-------------|----------|
| Rules-based | Hardcoded formula using known algorithm priorities. Fast, cheap, static. | |
| AI-scored | V3 reads actual video analysis and returns contextual fit score + rationale per platform. ~$0.002 extra per analysis. | ✓ |

**User's choice:** AI-scored
**Notes:** User initially asked about "any other short video platform" beyond TikTok/IG/YT Shorts — confirmed just the 3 original platforms for now.

---

## Watermark detection

| Option | Description | Selected |
|--------|-------------|----------|
| TikTok watermark only → IG penalty | Only TikTok → IG penalty | |
| All platform watermarks → other platform penalty | Any platform watermark detected = lower fit on other platforms | ✓ |

**User's choice:** All watermarks → penalty on all other targeted platforms
**Notes:** User noted "I don't think it will happen much with users but still good to know" — implement but no need to over-engineer.

---

## Per-platform score shape

| Option | Description | Selected |
|--------|-------------|----------|
| Primary platform only | One score for the main platform | |
| One score per targeted platform | Separate fit score for each Card 0 platform | ✓ |
| Single combined score | One score across all platforms | |

**User's choice:** One score per targeted platform (Recommended)

---

## Creator-tier adjustment

| Option | Description | Selected |
|--------|-------------|----------|
| No tier adjustment | Same scoring regardless of follower count | |
| Tier-aware scoring | Platform fit score adjusts based on creator follower tier (nano/micro/mid/macro/mega) | ✓ |

**User's choice:** Yes — tier-aware scoring

---

## Area 2: Pipeline placement

| Option | Description | Selected |
|--------|-------------|----------|
| Before Wave 3 | Platform-fit runs without persona data | |
| After Wave 3, before aggregator | Has persona reactions available; influences final score | ✓ |
| After aggregator | Informational only, doesn't influence score | |

**User's choice:** After Wave 3 (Recommended) + feeds into aggregator

---

## One call vs per-platform calls

| Option | Description | Selected |
|--------|-------------|----------|
| One call, all platforms together | Single V3 call reasons about all targeted platforms | ✓ |
| Separate call per platform | One V3 call per platform | |

**User's choice:** One call, all platforms together (Recommended)

---

## Area 3: Critique grounding depth

| Option | Description | Selected |
|--------|-------------|----------|
| Compact digest | ~800 tokens, cache-friendly | |
| Full PredictionResult | All fields available, ~3000 tokens | ✓ |
| Score + warnings + Card 6 only | Minimal, cheapest | |

**User's choice:** Full pipeline data (Recommended — i.e., full PredictionResult)

---

## Critique effect on prediction

| Option | Description | Selected |
|--------|-------------|----------|
| Lower score only | Change overall_score downward | |
| Lower confidence only | Change confidence field, not score | ✓ |
| Lower both score and confidence | Modify both fields | |

**User's choice:** Lower confidence only, not the score (Recommended)

---

## Confidence adjustment cap

| Option | Description | Selected |
|--------|-------------|----------|
| No cap | V3 can lower confidence by any amount | |
| Max -20% adjustment | Hard cap to prevent catastrophic drops on minor inconsistencies | ✓ |
| Max -10% adjustment | More conservative cap | |

**User's choice:** Yes — max -20% adjustment (Recommended)

---

## Area 4: Counterfactual generation trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Always generate | Runs on every prediction regardless of score | ✓ |
| Only for low scores | Generates when score < threshold | |
| Only on user request | On-demand, not automatic | |

**User's choice:** Always generate (Recommended)

---

## Timestamp anchoring

| Option | Description | Selected |
|--------|-------------|----------|
| No timestamps | Generic suggestions | |
| Anchor when data exists | Use Phase 5 timestamps when available, infer otherwise | ✓ |
| Always require timestamps | Skip if no Phase 5 data | |

**User's choice:** Yes — anchor to timestamps when data exists (Recommended)

---

## Anti-virality threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Score < 20 AND confidence > 80% | Stricter threshold | |
| Score < 30 AND confidence > 70% | Balanced threshold | ✓ |
| Score < 40 AND confidence > 60% | More warnings, more false positives | |

**User's choice:** Score < 30 AND confidence > 70% (Recommended)

---

## Additional area: Feedback Quality

User raised this explicitly: "It's really important that the user gets precise and actionable feedback — that's where a lot of the value gets created. This needs to be really on point."

| Question | Options | Selected |
|----------|---------|----------|
| Counterfactual specificity | General advice / Hyper-specific with concrete actions | Hyper-specific |
| Critique flags | Code labels / Written explanation with specifics | Written explanation |
| Platform-fit output | Score only / Score + written rationale per platform | Score + rationale |
| Suggestions count | 1-3 variable / Exactly 3 ranked by impact | Exactly 3 ranked |

---

## Claude's Discretion

- Initial aggregator weight for platform-fit signal (~0.05, following Phase 8 retrieval precedent)
- Exact Zod schema shape for `PlatformFitResult[]`
- Graceful degradation implementation (null result → SignalAvailability.platform_fit = false → weight redistributed)
- Stage event emission naming for platform-fit stage

## Deferred Ideas

- Additional platforms (Pinterest, LinkedIn, Facebook Reels, Snapchat Spotlight)
- Per-platform counterfactuals
- UI for all Phase 9 outputs → M2 Intelligence Surface milestone
- Aggregator weight calibration → Phase 10
