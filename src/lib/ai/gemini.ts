/**
 * Gemini AI client for viral video explanation and hashtag gap analysis.
 *
 * Uses @google/genai with lazy-initialized singleton.
 * Model: gemini-2.5-flash-lite with JSON response mode.
 */

import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import {
  ViralExplanationSchema,
  HashtagGapSchema,
  type ViralExplanation,
  type HashtagGap,
  type ViralVideoInput,
} from "./types";
import { buildViralPrompt, buildHashtagGapPrompt } from "./prompts";

// --- Singleton client ---

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// --- Helpers ---

interface GeminiResult<T> {
  analysis: T;
  usage: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Shared helper: call Gemini with a prompt and validate response with Zod.
 * Uses responseMimeType: "application/json" for structured output.
 */
async function callGemini<T>(
  prompt: string,
  schema: ZodType<T>
): Promise<GeminiResult<T>> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "";
  const parsed = JSON.parse(raw);

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error(
      "Gemini response validation failed:",
      result.error.issues.slice(0, 3)
    );
    throw new Error("Gemini response failed Zod validation");
  }

  return {
    analysis: result.data,
    usage: {
      prompt_tokens: response.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

// --- Public API ---

export async function explainViralVideos(
  handle: string,
  avgViews: number,
  viralVideos: ViralVideoInput[]
): Promise<GeminiResult<ViralExplanation>> {
  return callGemini(
    buildViralPrompt(handle, avgViews, viralVideos),
    ViralExplanationSchema
  );
}

export async function analyzeHashtagGap(
  handle: string,
  competitorOnly: { tag: string; count: number }[],
  userOnly: { tag: string; count: number }[],
  shared: { tag: string; competitorCount: number; userCount: number }[]
): Promise<GeminiResult<HashtagGap>> {
  return callGemini(
    buildHashtagGapPrompt(handle, competitorOnly, userOnly, shared),
    HashtagGapSchema
  );
}
