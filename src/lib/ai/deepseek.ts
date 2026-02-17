/**
 * DeepSeek AI client for strategy analysis and content recommendations.
 *
 * Uses the OpenAI-compatible API with lazy-initialized singleton.
 * Model: deepseek-chat with JSON mode.
 */

import OpenAI from "openai";
import type { ZodType } from "zod";
import {
  StrategyAnalysisSchema,
  RecommendationsSchema,
  type StrategyAnalysis,
  type Recommendations,
  type CompetitorContext,
} from "./types";
import { buildStrategyPrompt, buildRecommendationsPrompt } from "./prompts";

// --- Singleton client ---

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

// --- Helpers ---

/**
 * Strip markdown fences and DeepSeek think tags from response text.
 * DeepSeek sometimes wraps JSON in ```json ... ``` or <think>...</think>.
 */
export function stripFences(text: string): string {
  let cleaned = text.trim();

  // Remove <think>...</think> blocks (deepseek-reasoner sometimes adds these)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Remove ```json ... ``` or ``` ... ``` wrappers
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1]!.trim();
  }

  return cleaned;
}

interface DeepSeekResult<T> {
  analysis: T;
  usage: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Shared helper: call DeepSeek with a prompt and validate response with Zod.
 * Includes 1 retry on parse failure with a stricter instruction.
 */
async function callDeepSeek<T>(
  prompt: string,
  schema: ZodType<T>
): Promise<DeepSeekResult<T>> {
  const ai = getClient();

  for (let attempt = 0; attempt < 2; attempt++) {
    const finalPrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: Your previous response was not valid JSON. Please respond with ONLY valid JSON, no markdown fences, no explanation text.`;

    const response = await ai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: finalPrompt }],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = stripFences(raw);

    const result = schema.safeParse(JSON.parse(cleaned));
    if (result.success) {
      return {
        analysis: result.data,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens ?? 0,
          completion_tokens: response.usage?.completion_tokens ?? 0,
        },
      };
    }

    // Log validation error on first attempt, retry
    if (attempt === 0) {
      console.warn(
        "DeepSeek response validation failed, retrying:",
        result.error.issues.slice(0, 3)
      );
    }
  }

  throw new Error("DeepSeek response failed Zod validation after 2 attempts");
}

// --- Public API ---

export async function analyzeStrategy(
  ctx: CompetitorContext
): Promise<DeepSeekResult<StrategyAnalysis>> {
  return callDeepSeek(buildStrategyPrompt(ctx), StrategyAnalysisSchema);
}

export async function generateRecommendations(
  ctx: CompetitorContext,
  strategyHighlights?: string,
  viralPatterns?: string
): Promise<DeepSeekResult<Recommendations>> {
  return callDeepSeek(
    buildRecommendationsPrompt(ctx, strategyHighlights, viralPatterns),
    RecommendationsSchema
  );
}
