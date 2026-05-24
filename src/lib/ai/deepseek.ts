/**
 * Qwen AI client for strategy analysis and content recommendations.
 * Replaces the former DeepSeek client — same public API, same return types.
 * Model: qwen3.6-plus via DashScope International (OpenAI-compatible).
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
import { stripModelOutput } from "../engine/utils/strip";

const DASHSCOPE_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const MODEL = process.env.QWEN_REASONING_MODEL ?? "qwen3.6-plus";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: DASHSCOPE_ENDPOINT });
  }
  return client;
}

// Kept for any callers that imported stripFences from here.
export { stripModelOutput as stripFences };

interface DeepSeekResult<T> {
  analysis: T;
  usage: { prompt_tokens: number; completion_tokens: number };
}

async function callQwen<T>(
  prompt: string,
  schema: ZodType<T>,
): Promise<DeepSeekResult<T>> {
  const ai = getClient();

  for (let attempt = 0; attempt < 2; attempt++) {
    const finalPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\nIMPORTANT: Your previous response was not valid JSON. Respond with ONLY valid JSON, no markdown fences, no explanation.`;

    const completion = await ai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: finalPrompt }],
      response_format: { type: "json_object" },
    });

    const raw     = completion.choices[0]?.message?.content ?? "";
    const cleaned = stripModelOutput(raw);
    const result  = schema.safeParse(JSON.parse(cleaned));

    if (result.success) {
      return {
        analysis: result.data,
        usage: {
          prompt_tokens:     completion.usage?.prompt_tokens     ?? 0,
          completion_tokens: completion.usage?.completion_tokens ?? 0,
        },
      };
    }

    if (attempt === 0) {
      console.warn("Qwen response validation failed, retrying:", result.error.issues.slice(0, 3));
    }
  }

  throw new Error("Qwen response failed Zod validation after 2 attempts");
}

export async function analyzeStrategy(
  ctx: CompetitorContext,
): Promise<DeepSeekResult<StrategyAnalysis>> {
  return callQwen(buildStrategyPrompt(ctx), StrategyAnalysisSchema);
}

export async function generateRecommendations(
  ctx: CompetitorContext,
  strategyHighlights?: string,
  viralPatterns?: string,
): Promise<DeepSeekResult<Recommendations>> {
  return callQwen(buildRecommendationsPrompt(ctx, strategyHighlights, viralPatterns), RecommendationsSchema);
}
