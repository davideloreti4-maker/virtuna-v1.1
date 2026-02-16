import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import type { RuleScoreResult } from "./types";

// Cache rules for 1 hour — rule_library changes infrequently
const rulesCache = createCache<Rule[]>(60 * 60 * 1000);

interface Rule {
  id: string;
  name: string;
  description: string | null;
  category: string;
  pattern: string | null;
  score_modifier: number | null;
  platform: string | null;
  evaluation_prompt: string | null;
  weight: number;
  max_score: number;
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
    .select("id, name, description, category, pattern, score_modifier, platform, evaluation_prompt, weight, max_score")
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

  const rules = (data ?? []) as Rule[];
  rulesCache.set(cacheKey, rules);
  return rules;
}

/**
 * Simple pattern matching for deterministic rules
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
      return false;
  }
}

/**
 * Score content against loaded rules (ENGINE-04)
 * Uses deterministic pattern matching for rules with patterns
 */
export async function scoreContentAgainstRules(
  content: string,
  rules: Rule[]
): Promise<RuleScoreResult> {
  const matched_rules: RuleScoreResult["matched_rules"] = [];
  let totalScore = 0;
  let totalMaxScore = 0;

  for (const rule of rules) {
    const maxScore = rule.max_score;
    totalMaxScore += maxScore;

    if (rule.pattern) {
      // Deterministic scoring
      const matches = matchesPattern(content, rule.pattern);
      if (matches && rule.score_modifier) {
        const normalized = Math.min(maxScore, (rule.score_modifier / 15) * maxScore);
        totalScore += normalized * rule.weight;
        matched_rules.push({
          rule_id: rule.id,
          rule_name: rule.name,
          score: normalized,
          max_score: maxScore,
          tier: 'regex' as const,
        });
      }
    }
  }

  // Normalize to 0-100
  const rule_score =
    totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 50;

  return { rule_score: Math.min(100, Math.max(0, rule_score)), matched_rules };
}
