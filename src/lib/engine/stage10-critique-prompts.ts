/**
 * Phase 9 — Stage 10 Critique Prompts (Plan 09-05).
 *
 * Pure module exporting:
 * - `STABLE_CRITIQUE_SYSTEM_PROMPT` — byte-identical constant with 4 locked D-13 consistency
 *   checks, Cross-Creator Consensus grounding, and Numerical Rules table.
 * - `buildCritiqueUserMessage(result, creatorContext?)` — volatile per-request user message
 *   with summarized PredictionResult fields. NEVER includes past_wins/past_flops URLs.
 * - `CritiqueResponseSchema` — Zod boundary validator for V3 response.
 *
 * Pattern source: `wave3/persona-prompts.ts` — same stable-prefix + volatile-tail discipline.
 */
import { z } from "zod";
import type { PredictionResult } from "./types";
import type { CreatorContext } from "./creator";

// =====================================================
// Cache-stable system prompt (D-17 + Pitfall 1).
// Byte-identical constant — never interpolate Date.now() / Math.random() here.
// Includes ~500 tokens: Cross-Creator Consensus, Numerical Rules, 4 D-13 checks.
// =====================================================

export const STABLE_CRITIQUE_SYSTEM_PROMPT = `You are a prediction self-critic for a short-form video analytics engine. Your job is to grade the engine's own output for internal consistency — not to change what the engine decided, but to assess how much we should trust it.

## Cross-Creator Consensus (highest-confidence signals for short-form video)
These 11 rules appear across ALL three creators (Jenny Hoyos, Ava Yuergens, Alex Hormozi):
1. The Hook Decides Everything: first 2-3 seconds determines 80%+ of performance
2. Three-Second Window is Sacred: hook stack in ≤3 seconds
3. Specificity > Generality: specific beats general every time
4. Numbers and Concrete Outcomes in Hooks: exact figures increase credibility
5. Assume Audio-Off / Visual-First: 50% of viewers watch muted → text overlays mandatory
6. Low Reading Level: 5th grade or below (MrBeast = 1st grade)
7. Cut the Filler / Pace-Break Intros: eliminate "hey guys, today we're going to..."
8. Niche/Narrow Targeting Wins Conversion: broad hook → narrow body → niche CTA
9. Repurpose Winners Rather Than Net-New: 70% creative = variations of top performers
10. Volume Discipline: sustained cadence at defensible volume; never zero, never spam
11. CTA / Conversion Architecture Must Be Built In: ending emotion decides viewer rating

## Numerical Rules (full table, for flagging contradictions)
1. Outlier = ≥5× follower count in views  2. 3-hook stack in first 3s (see/read/hear)
3. 5th-grade reading level  4. MrBeast = 1st-grade  5. Optimal Short = 34s
6. Shorts <30s need ~100% retention  7. Retention ≥90% for virality  8. Scroll-through ≥70%
9. Hook ≤3s (ideally ≤2s)  10. Hook+foreshadow ≤3s total  11. First 5s = multiple scene changes
12. Max 3 objects in frame  13. Power words: banned/free/one-dollar/secret/cheap
16. Hooks = ~80% of ad performance  17. 5× more read headline vs body  18. Attention = first 3s
19. 50% watch audio-off  20. Clean cuts every 3-4s  21. 30s short target  22. No such thing as too long, only too boring
23. Value:Ask 98:2 (short), 3:1 (long)  35. Shareability: 20% shares-to-view + 92% growth

## Four Locked Consistency Checks (D-13)
Run ALL FOUR checks. For each violation found, add a human-readable string to flags[] explaining the contradiction with specific scores cited.

**Check #1 — Signal Agreement:** If |gemini_score - behavioral_score| > 30 points, flag it.
Example flag: "Hook gemini score (8/10) sharply contradicts behavioral scroll-past median (2.1s) — signals disagree by >30 points. Gemini saw strong visual hook but personas abandoned immediately."

**Check #2 — Score vs Factors:** If overall_score > 70 but the top-3 factors are negative (score ≤4/10), OR overall_score < 30 but top-3 factors are positive (score ≥7/10), flag it.
Example flag: "overall_score=78 but top factors all score ≤3/10 — internal contradiction. High score driven by signal weighting, not individual factor quality."

**Check #3 — Card 6 Historical Match:** If the creator has documented past flops (past_flops_count > 0) AND the current prediction pattern matches a known flop pattern (e.g., high confidence + low retention signals), flag it.
Example flag: "Prediction pattern (high confidence + low hook score) matches creator's documented flop pattern (past_flops_count=\${past_flops_count}). Historical match warrants skepticism."

**Check #4 — Over-confidence with Thin Signals:** If confidence > 0.7 AND 2+ of these signals are unavailable: audio=false, retrieval=false, gemini_hook=false, personas=false — flag it.
Example flag: "Confidence=0.82 but audio, retrieval, and gemini_hook are all unavailable. Score is based on thin signal coverage — confidence should be lower."

## Confidence Adjustment
- confidence_adjustment must be in range [-0.20, 0]. Negative = reduce confidence. 0 = no change.
- Reduce by 0.05–0.08 per check that fires. If 3+ checks fire, cap at -0.20.
- DO NOT output values outside [-0.20, 0] — the consumer enforces this limit anyway.
- DO NOT change the overall_score — only confidence.

## Output JSON Schema
{ "consistency_score": 0-10, "flags": ["string (max 400 chars each, cite specific scores)"], "confidence_adjustment": -0.20 to 0 }

Return ONLY the JSON object. flags[] must be human-readable (the creator sees these verbatim). Always cite specific numbers.`;

// =====================================================
// Volatile per-request user message.
// NEVER includes past_wins/past_flops URLs — only counts (T-09-05-01).
// =====================================================

export function buildCritiqueUserMessage(
  result: PredictionResult,
  creatorContext: CreatorContext | null,
): string {
  const sections: string[] = [];

  sections.push("## Prediction Result Summary");
  sections.push(`- overall_score: ${result.overall_score}/100`);
  sections.push(`- confidence: ${result.confidence.toFixed(4)} (label: ${result.confidence_label})`);
  sections.push("");

  // Top 3 factors by score (never full list — T-09-05-04 cost control)
  if (result.factors && result.factors.length > 0) {
    const topFactors = [...result.factors]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    sections.push("Top Factors (by score):");
    for (const f of topFactors) {
      sections.push(`  - ${f.name}: ${f.score}/10`);
    }
    sections.push("");
  }

  // Signal scores
  sections.push("Signal Scores:");
  sections.push(`  - gemini_score: ${result.gemini_score}/100`);
  sections.push(`  - behavioral_score: ${result.behavioral_score}/100`);
  sections.push(`  - audio_perceptual_score: ${result.audio_perceptual_score ?? "N/A"}`);
  sections.push("");

  // Signal availability (boolean flags for Check #4)
  const sa = result.signal_availability;
  sections.push("Signal Availability:");
  sections.push(`  - audio: ${sa.audio ?? false}`);
  sections.push(`  - retrieval: ${sa.retrieval ?? false}`);
  sections.push(`  - gemini_hook: ${sa.gemini_hook ?? false}`);
  sections.push(`  - personas: ${sa.personas ?? false}`);
  sections.push("");

  // Persona aggregate summary
  if (result.persona_behavioral_aggregate) {
    const agg = result.persona_behavioral_aggregate;
    sections.push("Persona Behavioral Aggregate:");
    sections.push(`  - completion_pct: ${agg.completion_pct}`);
    sections.push(`  - share_pct: ${agg.share_pct}`);
    sections.push(`  - comment_pct: ${agg.comment_pct}`);
    sections.push(`  - save_pct: ${agg.save_pct}`);
    sections.push("");
  }

  // Platform fit scores if available
  if (result.platform_fit) {
    sections.push("Platform Fit Scores:");
    for (const pf of result.platform_fit) {
      sections.push(`  - ${pf.platform}: ${pf.fit_score}/100`);
    }
    sections.push("");
  }

  // Card 6 — counts only, NEVER URLs (T-09-05-01 + Phase 2 T-02-01)
  if (creatorContext) {
    const winsCount = creatorContext.past_wins?.length ?? 0;
    const flopsCount = creatorContext.past_flops?.length ?? 0;
    sections.push(`Creator History: past_wins_count=${winsCount}, past_flops_count=${flopsCount}`);
  }

  return sections.join("\n");
}

// =====================================================
// Zod schema for V3 critique response validation.
// consistency_score: 0-10, flags: up to 8 strings of ≤400 chars,
// confidence_adjustment: allowed range [-1, 0] from model — TS clamps to [-0.20, 0].
// =====================================================

export const CritiqueResponseSchema = z.object({
  consistency_score: z.number().min(0).max(10),
  flags: z.array(z.string().min(1).max(400)).max(8),
  confidence_adjustment: z.number().min(-1).max(0),
});
