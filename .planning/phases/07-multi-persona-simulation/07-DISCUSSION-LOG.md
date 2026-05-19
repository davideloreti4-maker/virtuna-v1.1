# Phase 7: Multi-Persona Simulation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 7-multi-persona-simulation
**Areas discussed:** Persona identities, Reaction aggregation, Per-content-type tuning, Failure + eval strategy

---

## Persona identities

### Question 1: Demographic frame for the 6 FYP personas

| Option | Description | Selected |
|--------|-------------|----------|
| Gen Z dominant (4 GenZ / 2 Millennial) | Matches platform reality. 4 personas aged 18-25, 2 personas aged 26-35. | |
| Balanced (3 GenZ / 3 Millennial) | Reflects the broader user base including the Millennial growth segment. | |
| Niche-driven (vary per content type) | Demographic frame shifts per niche. | |
| **(Freeform)** | "we need something which actually represents the fyp on tiktok" | ✓ |

**User's choice:** Freeform — push for actual FYP representation, not a stylized demographic mix.
**Notes:** This redirected the discussion away from arbitrary demographic splits toward a research-grounded blueprint anchored to real US TikTok audience composition (Pew 2024 + Statista 2025).

### Question 2: Initial 6-persona blueprint (F19, F23, M21, F29, M32, F38) + 4 specialized

| Option | Description | Selected |
|--------|-------------|----------|
| Lock as-is | Adopt the proposed 6 FYP + 4 specialized. | |
| Lock but skew younger | Replace F38 with another Gen Z persona. | |
| Lock but more male representation | Shift to 3F / 3M. | |
| **(Freeform)** | "adjust to younger and analyze yourself how we can improve ??" | ✓ |

**User's choice:** Freeform — skew younger AND push the design further. Self-critique invited.
**Notes:** Triggered a deeper analysis: behavioral-archetype layer (lurker / saver / sharer / tough crowd / etc.), scroll-stop triggers, psychographic motivators, time-of-day context. Surfaced the core insight that "the FYP" isn't a demographic cross-section — it's a smart routing system that delivers content to interest clusters. Variance inside the FYP audience is BEHAVIORAL within a cluster, not demographic across clusters.

### Question 3: Lock the interest-cluster-aware model + enhancements

| Option | Description | Selected |
|--------|-------------|----------|
| Lock it | 6 stable behavioral archetypes instantiated per detected niche; 4 specialized. | |
| Lock it AND embed scroll/stop triggers + psychographics + time-of-day context | Maximum richness. | ✓ |
| Revise further | Type adjustments. | |

**User's choice:** Lock with maximum richness.
**Notes:** Each persona's system prompt embeds (1) archetype definition, (2) scroll-past + stop triggers, (3) psychographic motivator, (4) time-of-day / mood context tag. All four blocks are byte-stable across runs — DeepSeek's automatic input cache applies ~50× discount.

---

## Reaction aggregation

### Question 1: Roll-up math for the 4 behavioral metrics

| Option | Description | Selected |
|--------|-------------|----------|
| Flat mean per metric | Simple average across all 10 personas. Easy to calibrate. May under-predict viral. | |
| Per-metric different rule (Recommended) | completion = mean; share/comment/save = top-3-enthusiast-weighted. | ✓ |
| Flat mean for now, revisit Phase 10 | Punt to corpus evidence. | |

**User's choice:** Per-metric different rule.
**Notes:** Top-3 enthusiasts weight 60%, remaining 7 split 40%. Captures the long-tail nature of viral cascades — a few enthusiasts drive most shares, not flat sharing across the population.

### Question 2: Aggregator integration approach

| Option | Description | Selected |
|--------|-------------|----------|
| Add as new signal, Phase 10 decides swap (Recommended) | Persona aggregate is a NEW field; aggregator unchanged. | ✓ |
| Hard-swap source now | Aggregator reads persona aggregate as new behavioral source. | |
| Shadow swap with feature flag | Both signals computed; env flag controls which feeds aggregator. | |

**User's choice:** Add as new signal, Phase 10 decides swap.
**Notes:** Honors the milestone-wide additive-only constraint. ROADMAP SC#4's literal "replaces" language is upgraded to "made available to replace" — Phase 10's calibration evidence drives the actual swap.

### Question 3: Per-persona free-text reasoning

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reasoning per persona (Recommended) | Each persona returns scores + 1-2 sentence reaction. ~$0.0004 extra. | ✓ |
| Numbers only | Cheaper, cleaner schema. | |
| Reasoning only for outliers | Hybrid. | |

**User's choice:** Yes — reasoning per persona.
**Notes:** Powers M2 audience-viz UX directly, gives Phase 9 self-critique cross-reference material, makes eval debugging trivial.

---

## Per-content-type tuning

### Question 1: Lock the 7-row allocation table

| Option | Description | Selected |
|--------|-------------|----------|
| Lock as-is | Adopt the proposed table. | |
| Lock but make vlog less loyalist-heavy | Vlog adjusted from 3/2/4/1 to 4/2/3/1. | ✓ |
| Default 6/2/1/1 for everything, skip per-content tuning | Punt to Phase 10. Violates SC#2. | |
| Let me adjust | Custom allocations. | |

**User's choice:** Lock with vlog adjusted to 4/2/3/1.
**Notes:** Vlogs can break out beyond the follower base; keeping 4 FYP slots preserves the viral upside while still leaning loyalist (3 slots vs 1 default).

### Question 2: Creator-stage adjustment

| Option | Description | Selected |
|--------|-------------|----------|
| No — defer to Phase 9 (Recommended) | Phase 9 ALGO-05 owns creator-tier adjustments. | ✓ |
| Yes — light stage adjustment | Adjust on top of content-type table. | |
| Yes — full creator-tier tuning now | Nano/micro/mid/established multipliers. | |

**User's choice:** No — defer to Phase 9.
**Notes:** Clean phase boundary. Phase 7 owns content-type-only allocation tuning.

---

## Failure + eval strategy

### Question 1: Wave 3 success threshold

| Option | Description | Selected |
|--------|-------------|----------|
| ≥7 of 10 succeed (Recommended) | Lose up to 3 personas, still trust aggregate. | ✓ |
| ≥6 of 10 (majority) | More aggregate availability; risk of biased survivor set. | |
| All 10 or fall back | Strictest; fragile in production. | |
| Tiered — must have ≥4 FYP AND ≥1 of each other | Preserves demographic coverage; higher fallback rate. | |

**User's choice:** ≥7 of 10 succeed.
**Notes:** Below threshold, return null aggregate + `wave_3_below_threshold` warning. Aggregator falls back to v2 DeepSeek behavioral (still computed). `signal_availability.personas = true` only when threshold met.

### Question 2: Eval validation aggressiveness

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight A/B in Phase 7 eval (Recommended) | Run corpus with v2 vs persona-aggregate; ~$0.20 cost; surfaces problems fast. | ✓ |
| Persist both, defer all A/B to Phase 10 | Cleaner phase boundaries; expensive course-correct if broken. | |
| Full A/B + per-archetype accuracy | More debugging signal; ~$0.50 cost. | |

**User's choice:** Lightweight A/B in Phase 7 eval.
**Notes:** After Phase 7 ships, run 225-row corpus with two configs (v2 behavioral active vs persona aggregate substituted). Compare macro_f1, ECE, viral_recall. Persist both result rows to benchmark_results with distinct engine_version tags. Flag Phase 10 attention if persona aggregate is materially worse.

---

## Claude's Discretion

Areas left to researcher / planner without further user input:

- Per-niche persona instantiation text content (D-05)
- Cross-niche curiosity adjacent-niche edges in taxonomy.ts (D-03)
- Scroll-past + stop triggers per archetype (D-04)
- Psychographic motivator assignment per archetype × niche (D-04)
- Time-of-day / mood context tag set (D-04)
- DeepSeek structured-output Zod schema (D-19)
- System prompt + user message builder templates (D-17)
- File organization (`src/lib/engine/wave3/` split into registry / prompts / aggregator)
- Top-3-enthusiast threshold mechanics (per-metric vs composite)
- Aggregator over surviving subset (when fewer than 10 personas succeed)
- Per-persona retry policy + circuit breaker inheritance
- Test surface (Vitest unit + integration; 80% threshold)
- Per-niche cache warmup script (planner-level decision)
- Top-3 tie-break rule

## Deferred Ideas

Ideas mentioned or implied during discussion, captured for future phases:

- Aggregator swap (v2 → persona aggregate) — Phase 10 owns
- Creator-stage tuning on top of content-type allocation — Phase 9 owns (ALGO-05)
- Per-archetype Platt calibration — Phase 10 may add if A/B reveals imbalance
- M2 audience-viz UI consuming persona_simulation_results — M2 owns
- Self-critique cross-reference against persona reasoning — Phase 9 owns
- Per-persona counterfactuals — future milestone
- Persona expansion beyond 10 (SC#1 hard-locked at 10) — future milestone
- Multi-edge cross-niche adjacency graph — defer until eval data justifies
- Per-niche cache warmup script — planner decides
- Synthetic creator profiles for eval — defer until D-14 A/B reveals need
- Per-content-type tuning table revision based on corpus evidence — Phase 10 input
