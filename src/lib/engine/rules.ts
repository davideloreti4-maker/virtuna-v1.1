/**
 * Rule evaluation tier classification:
 *
 * REGEX tier (deterministic, fast, no API cost):
 *   question_hook, curiosity_gap, negative_bias, bold_claim, story_hook,
 *   payoff_delay, pattern_interrupt, info_density, short_duration,
 *   caption_hook, cta_clarity, authenticity
 *
 * SEMANTIC tier (DeepSeek evaluation, slower, ~$0.001 per batch):
 *   loop_structure     — requires video analysis, regex always returns false
 *   emotional_arc      — requires full content analysis, regex always returns false
 *   text_overlay       — regex always returns true (meaningless)
 *   trending_sound     — needs audio context, regex returns false
 *   trending_audio     — needs audio context, regex returns false
 *   original_audio     — no regex pattern, needs semantic eval
 *   post_timing        — no regex pattern, needs semantic eval
 *   content_pacing     — no regex pattern, needs semantic eval
 *   niche_authority    — no regex pattern, needs semantic eval
 *   carousel_depth     — platform-specific, needs semantic eval
 *   thumbnail_bait     — platform-specific, needs semantic eval
 *   duet_stitch        — platform-specific, needs semantic eval
 *   reel_hook_speed    — platform-specific, needs semantic eval
 *
 * NOTE: To switch a rule's tier, update its evaluation_tier column in rule_library.
 * The code reads the tier from DB — no code change needed for reclassification.
 *
 * MIGRATION: The seed data (supabase/seed.sql) needs evaluation_tier updated for
 * the semantic-tier rules listed above. The DB migration (Phase 4) added the column
 * with DEFAULT 'regex'. Rules will be reclassified in Plan 2 or Plan 3 of this phase.
 */

import OpenAI from "openai";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import type { RuleScoreResult } from "./types";

// Cache rules for 1 hour — rule_library changes infrequently
const rulesCache = createCache<Rule[]>(60 * 60 * 1000);

// DeepSeek-chat pricing: $0.14/1M input, $0.28/1M output (cheaper than reasoner)
const SEMANTIC_INPUT_PRICE_PER_TOKEN = 0.14 / 1_000_000;
const SEMANTIC_OUTPUT_PRICE_PER_TOKEN = 0.28 / 1_000_000;
const SEMANTIC_TIMEOUT_MS = 15_000; // 15s — semantic eval is simpler than full reasoning

interface Rule {
  id: string;
  name: string;
  description: string | null;
  category: string;
  pattern: string | null;
  score_modifier: number | null;
  platform: string | null;
  evaluation_prompt: string | null;
  evaluation_tier: "regex" | "semantic";
  weight: number;
  max_score: number;
}

// Zod schema for semantic evaluation response
const SemanticEvaluationSchema = z.object({
  evaluations: z.array(
    z.object({
      rule_name: z.string(),
      score: z.number().min(0).max(10),
      rationale: z.string(),
    })
  ),
});

type SemanticEvaluation = z.infer<typeof SemanticEvaluationSchema>;

// Lazy-initialized OpenAI client for semantic eval (NOT imported from deepseek.ts to avoid circular dep)
let semanticClient: OpenAI | null = null;

function getSemanticClient(): OpenAI {
  if (!semanticClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY for semantic rule evaluation");
    semanticClient = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
  }
  return semanticClient;
}

/**
 * Load active rules from the rule_library table (ENGINE-04)
 */
export async function loadActiveRules(
  supabase: ReturnType<typeof createServiceClient>,
  platform?: string
): Promise<Rule[]> {
  // Check cache first (INFRA-02)
  const cacheKey = `rules:${platform ?? "all"}`;
  const cached = rulesCache.get(cacheKey);
  if (cached) return cached;

  let query = supabase
    .from("rule_library")
    .select(
      "id, name, description, category, pattern, score_modifier, platform, evaluation_prompt, evaluation_tier, weight, max_score"
    )
    .eq("is_active", true);

  // Include cross-platform rules (null) and platform-specific rules
  if (platform) {
    query = query.or(`platform.is.null,platform.eq.${platform}`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load rules:", error);
    return [];
  }

  // Cast through unknown — Supabase types may not include evaluation_tier until types are regenerated
  const rules = (data ?? []) as unknown as Rule[];
  rulesCache.set(cacheKey, rules);
  return rules;
}

/**
 * Simple pattern matching for deterministic rules (regex tier)
 */
function matchesPattern(content: string, pattern: string): boolean {
  const lowerContent = content.toLowerCase();

  switch (pattern) {
    case "question_hook":
      return /^[^.!]*\?/.test(content); // Starts with a question
    case "curiosity_gap":
      return /\b(secret|reveal|discover|truth|never|always|actually)\b/i.test(content);
    case "negative_bias":
      return /\b(stop|don't|never|worst|mistake|wrong|fail|avoid)\b/i.test(content);
    case "bold_claim":
      return /\b(no one|everyone|always|never|guaranteed|proven)\b/i.test(content);
    case "story_hook":
      return /\b(i was|i remember|one day|last week|this morning|when i)\b/i.test(content);
    case "loop_structure":
      return false; // Needs video analysis — skip for text-only
    case "payoff_delay":
      return lowerContent.includes("wait for it") || lowerContent.includes("at the end");
    case "pattern_interrupt":
      return /\b(but wait|plot twist|here's the thing|actually)\b/i.test(content);
    case "info_density":
      // Heuristic: high word count relative to short content = dense
      return content.split(/\s+/).length > 50;
    case "emotional_arc":
      return false; // Needs full content analysis, not simple pattern
    case "trending_sound":
    case "trending_audio":
      return false; // Needs audio analysis
    case "short_duration":
      return content.length < 300; // Proxy for short-form
    case "text_overlay":
      return true; // Text content always benefits from overlays
    case "caption_hook":
      return /^[^.!?]{1,80}[.!?]/.test(content); // Short punchy opening
    case "cta_clarity":
      return /\b(follow|share|comment|save|like|subscribe|click|link|bio)\b/i.test(content);
    case "authenticity":
      return /\b(i|my|me|we|our|personally)\b/i.test(content);
    default:
      console.debug(`[rules] Unknown regex pattern: ${pattern}`);
      return false;
  }
}

/**
 * Evaluate semantic-tier rules via a single batched DeepSeek call.
 * Returns evaluation results mapped by rule_name. On failure, returns empty array.
 */
async function evaluateSemanticRules(
  content: string,
  rules: Rule[]
): Promise<SemanticEvaluation["evaluations"]> {
  if (rules.length === 0) return [];

  // Filter out rules without evaluation prompts (can't evaluate without one)
  const evaluableRules = rules.filter((r) => r.evaluation_prompt);
  const skippedRules = rules.filter((r) => !r.evaluation_prompt);

  for (const skipped of skippedRules) {
    console.warn(
      `[rules] Skipping semantic rule "${skipped.name}": no evaluation_prompt defined`
    );
  }

  if (evaluableRules.length === 0) return [];

  try {
    const ai = getSemanticClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEMANTIC_TIMEOUT_MS);

    const ruleList = evaluableRules
      .map((r, i) => `${i + 1}. ${r.name}: ${r.evaluation_prompt}`)
      .join("\n");

    const prompt = `Evaluate the following content against these rules. For each rule, provide a score (0-10) and brief rationale (1 sentence).

Content: ${content}

Rules to evaluate:
${ruleList}

Return JSON: { "evaluations": [{ "rule_name": string, "score": number, "rationale": string }] }`;

    const response = await ai.chat.completions.create(
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const text = response.choices[0]?.message?.content ?? "";
    // Strip markdown fences if present
    const cleaned =
      text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)?.[1]?.trim() ?? text.trim();
    const parsed = JSON.parse(cleaned);
    const result = SemanticEvaluationSchema.safeParse(parsed);

    if (!result.success) {
      console.warn(
        `[rules] Semantic eval response validation failed: ${result.error.message}`
      );
      return [];
    }

    // Log cost estimate
    const promptTokens = response.usage?.prompt_tokens;
    const completionTokens = response.usage?.completion_tokens;
    const costCents =
      ((promptTokens ?? 1500) * SEMANTIC_INPUT_PRICE_PER_TOKEN +
        (completionTokens ?? 500) * SEMANTIC_OUTPUT_PRICE_PER_TOKEN) *
      100;
    console.log(
      `[rules] Semantic eval: ${evaluableRules.length} rules, ~${costCents.toFixed(4)} cents` +
        (promptTokens
          ? ` (${promptTokens} in, ${completionTokens} out tokens)`
          : "")
    );

    return result.data.evaluations;
  } catch (error) {
    console.warn(
      `[rules] Semantic evaluation failed, falling back to regex-only:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

/**
 * Score content against loaded rules (ENGINE-04, RULE-01, RULE-02)
 *
 * Hybrid evaluation:
 * - Regex tier: deterministic pattern matching (fast, no API cost)
 * - Semantic tier: batched DeepSeek evaluation (slower, ~$0.001 per batch)
 *
 * If semantic evaluation fails, falls back to regex-only results.
 */
export async function scoreContentAgainstRules(
  content: string,
  rules: Rule[]
): Promise<RuleScoreResult> {
  const matched_rules: RuleScoreResult["matched_rules"] = [];
  let totalScore = 0;
  let totalMaxScore = 0;

  // Split rules by evaluation tier
  const regexRules = rules.filter((r) => r.evaluation_tier === "regex");
  const semanticRules = rules.filter((r) => r.evaluation_tier === "semantic");

  // --- Regex tier (synchronous, deterministic) ---
  for (const rule of regexRules) {
    const maxScore = rule.max_score;
    totalMaxScore += maxScore;

    if (rule.pattern) {
      const matches = matchesPattern(content, rule.pattern);
      if (matches && rule.score_modifier) {
        const normalized = Math.min(
          maxScore,
          (rule.score_modifier / 15) * maxScore
        );
        totalScore += normalized * rule.weight;
        matched_rules.push({
          rule_id: rule.id,
          rule_name: rule.name,
          score: normalized,
          max_score: maxScore,
          tier: "regex" as const,
        });
      }
    } else {
      // Regex-tier rule without pattern: score 0
      console.debug(`[rules] Regex rule "${rule.name}" has no pattern, scoring 0`);
    }
  }

  // --- Semantic tier (async, DeepSeek batch) ---
  for (const rule of semanticRules) {
    totalMaxScore += rule.max_score;
  }

  const semanticEvals = await evaluateSemanticRules(content, semanticRules);

  // Map semantic evaluations to matched rules
  for (const evaluation of semanticEvals) {
    // Find matching rule by name (case-insensitive)
    const rule = semanticRules.find(
      (r) => r.name.toLowerCase() === evaluation.rule_name.toLowerCase()
    );
    if (!rule) {
      console.debug(
        `[rules] Semantic eval returned unknown rule: ${evaluation.rule_name}`
      );
      continue;
    }

    // Semantic scoring: (score/10) * max_score * weight
    const normalizedScore = (evaluation.score / 10) * rule.max_score;
    totalScore += normalizedScore * rule.weight;
    matched_rules.push({
      rule_id: rule.id,
      rule_name: rule.name,
      score: normalizedScore,
      max_score: rule.max_score,
      tier: "semantic" as const,
    });
  }

  // Normalize to 0-100
  const rule_score =
    totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 50;

  return { rule_score: Math.min(100, Math.max(0, rule_score)), matched_rules };
}
