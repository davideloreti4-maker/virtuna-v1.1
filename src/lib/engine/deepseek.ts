import OpenAI from "openai";
import {
  DeepSeekResponseSchema,
  type AnalysisInput,
  type DeepSeekReasoning,
  type GeminiAnalysis,
  type RuleScoreResult,
  type TrendEnrichment,
} from "./types";

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner";
const MAX_RETRIES = 2; // 3 total attempts
const TIMEOUT_MS = 30_000;

// Circuit breaker state (ENGINE-14)
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
  }
  return client;
}

/** Check if circuit breaker is open */
function isCircuitOpen(): boolean {
  if (Date.now() < circuitOpenUntil) return true;
  if (circuitOpenUntil > 0 && Date.now() >= circuitOpenUntil) {
    // Reset after cooldown
    circuitOpenUntil = 0;
    consecutiveFailures = 0;
  }
  return false;
}

/** Record a failure and potentially open the circuit */
function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
    console.warn(
      `DeepSeek circuit breaker activated. Falling back to Gemini-only for ${COOLDOWN_MS / 60000} minutes.`
    );
  }
}

/** Record a success and reset failure counter */
function recordSuccess(): void {
  consecutiveFailures = 0;
}

/** Strip markdown code fences from LLM output */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

/** Strip DeepSeek R1 <think> tags */
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Parse and validate DeepSeek response with Zod */
function parseDeepSeekResponse(raw: string): DeepSeekReasoning {
  const cleaned = stripFences(stripThinkTags(raw));
  const parsed = JSON.parse(cleaned);
  const result = DeepSeekResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`DeepSeek response validation failed: ${result.error.message}`);
  }
  return result.data;
}

export interface DeepSeekInput {
  input: AnalysisInput;
  gemini_analysis: GeminiAnalysis;
  rule_result: RuleScoreResult;
  trend_enrichment: TrendEnrichment;
}

const REASONING_PROMPT = `You are an expert social media strategist analyzing content for viral potential. You have been given an initial AI analysis, rule scores, and trend data. Your job is to provide deep reasoning and produce actionable outputs.

Return a JSON object with these exact fields:
- persona_reactions: array of exactly 5 objects, each with persona_name (string), quote (string - a realistic reaction in their voice), sentiment ("positive"|"neutral"|"negative"), resonance_score (number 0-10)
  Create diverse personas: a Gen-Z creator, a marketing professional, a casual scroller, a niche expert, and a skeptic.
- suggestions: array of 3-5 objects, each with text (string - specific actionable advice), priority ("high"|"medium"|"low"), category (string like "hook", "content", "format", "timing")
- variants: array of 2-3 objects, each with content (string - rewritten version), predicted_score (number 0-100), label (string like "Hook-Optimized", "Emotional Appeal")
- conversation_themes: array of themes, each with title (string), percentage (number 0-100), description (string)
- refined_score: number 0-100 (your refined overall viral score considering all inputs)
- confidence_reasoning: string explaining your confidence in the prediction`;

/**
 * Reason with DeepSeek R1 (ENGINE-02, ENGINE-09, ENGINE-14)
 * Returns null if circuit breaker is open
 */
export async function reasonWithDeepSeek(
  context: DeepSeekInput
): Promise<{ reasoning: DeepSeekReasoning; cost_cents: number } | null> {
  // Circuit breaker check
  if (isCircuitOpen()) {
    return null;
  }

  const ai = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const userMessage =
        attempt === 0
          ? `${REASONING_PROMPT}

Content type: ${context.input.content_type}
Content: ${context.input.content_text}

Initial AI Analysis:
${JSON.stringify(context.gemini_analysis, null, 2)}

Rule Score: ${context.rule_result.rule_score}/100
Matched Rules: ${context.rule_result.matched_rules.map((r) => r.rule_name).join(", ")}

Trend Score: ${context.trend_enrichment.trend_score}/100
Trend Context: ${context.trend_enrichment.trend_context}`
          : `Your previous response was not valid JSON. Return ONLY the JSON object with no extra text.\n\n${REASONING_PROMPT}\n\nContent: ${context.input.content_text}`;

      const response = await ai.chat.completions.create(
        {
          model: DEEPSEEK_MODEL,
          messages: [{ role: "user", content: userMessage }],
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const text = response.choices[0]?.message?.content ?? "";
      const reasoning = parseDeepSeekResponse(text);

      recordSuccess();

      // Estimate cost: ~2K tokens in, ~2K tokens out
      const cost_cents = 0.005 * (attempt + 1);

      return { reasoning, cost_cents };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === "AbortError") {
        recordFailure();
        throw new Error(`DeepSeek request timed out after ${TIMEOUT_MS}ms`);
      }
      // Retry on parse/validation errors, but record API failures
      if (
        lastError.message.includes("timeout") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("503") ||
        lastError.message.includes("429")
      ) {
        recordFailure();
      }
      if (attempt === MAX_RETRIES) break;
    }
  }

  recordFailure();
  console.error(
    `DeepSeek failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
  return null; // Graceful degradation — pipeline continues with Gemini-only
}

export { DEEPSEEK_MODEL, isCircuitOpen };
