/**
 * Qwen AI client for viral video explanation and hashtag gap analysis.
 * Replaces the former Gemini client — same public API, same return types.
 * Model: QWEN_REASONING_MODEL (qwen3.7-plus) via DashScope International (OpenAI-compatible).
 */

import OpenAI from "openai";
import type { ZodType } from "zod";
import {
  ViralExplanationSchema,
  HashtagGapSchema,
  type ViralExplanation,
  type HashtagGap,
  type ViralVideoInput,
} from "./types";
import { buildViralPrompt, buildHashtagGapPrompt } from "./prompts";
import { stripModelOutput } from "../engine/utils/strip";
import { QWEN_REASONING_MODEL } from "../engine/qwen/client";

const DASHSCOPE_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
// Single source of truth — was a divergent `?? "qwen3.6-plus"` literal that drifted
// from the central QWEN_REASONING_MODEL (qwen3.7-plus). Import the constant so it can't.
const MODEL = QWEN_REASONING_MODEL;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: DASHSCOPE_ENDPOINT });
  }
  return client;
}

interface GeminiResult<T> {
  analysis: T;
  usage: { prompt_tokens: number; completion_tokens: number };
}

async function callQwen<T>(
  prompt: string,
  schema: ZodType<T>,
): Promise<GeminiResult<T>> {
  const ai = getClient();

  const completion = await ai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw     = completion.choices[0]?.message?.content ?? "";
  const cleaned = stripModelOutput(raw);
  const parsed  = JSON.parse(cleaned);

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error("Qwen response validation failed:", result.error.issues.slice(0, 3));
    throw new Error("Qwen response failed Zod validation");
  }

  return {
    analysis: result.data,
    usage: {
      prompt_tokens:      completion.usage?.prompt_tokens     ?? 0,
      completion_tokens:  completion.usage?.completion_tokens ?? 0,
    },
  };
}

export async function explainViralVideos(
  handle: string,
  avgViews: number,
  viralVideos: ViralVideoInput[],
): Promise<GeminiResult<ViralExplanation>> {
  return callQwen(buildViralPrompt(handle, avgViews, viralVideos), ViralExplanationSchema);
}

export async function analyzeHashtagGap(
  handle: string,
  competitorOnly: { tag: string; count: number }[],
  userOnly: { tag: string; count: number }[],
  shared: { tag: string; competitorCount: number; userCount: number }[],
): Promise<GeminiResult<HashtagGap>> {
  return callQwen(buildHashtagGapPrompt(handle, competitorOnly, userOnly, shared), HashtagGapSchema);
}
