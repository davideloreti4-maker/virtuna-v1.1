import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponseSchema, type AnalysisInput, type GeminiAnalysis } from "./types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
const MAX_RETRIES = 2; // 3 total attempts
const TIMEOUT_MS = 15_000;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Strip markdown code fences from LLM output */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

/** Parse and validate Gemini response with Zod */
function parseGeminiResponse(raw: string): GeminiAnalysis {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = GeminiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Gemini response validation failed: ${result.error.message}`);
  }
  return result.data;
}

const ANALYSIS_PROMPT = `You are a viral content analysis expert. Analyze the following content and return a JSON object with these exact fields:

- factors: array of 5 objects, each with: name (string), score (number 0-10), description (string explaining the score), tips (array of improvement strings)
  The 5 factors MUST be: "Hook Strength", "Emotional Resonance", "Clarity", "Originality", "Call to Action"
- overall_impression: string summarizing the content's viral potential
- content_summary: brief summary of the content
- hook_strength: number 0-10
- emotional_resonance: number 0-10
- clarity: number 0-10
- originality: number 0-10
- call_to_action: number 0-10

Score generously but honestly. Be specific in descriptions and tips.`;

/** Gemini structured output schema for responseSchema parameter */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          description: { type: Type.STRING },
          tips: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["name", "score", "description", "tips"],
      },
    },
    overall_impression: { type: Type.STRING },
    content_summary: { type: Type.STRING },
    hook_strength: { type: Type.NUMBER },
    emotional_resonance: { type: Type.NUMBER },
    clarity: { type: Type.NUMBER },
    originality: { type: Type.NUMBER },
    call_to_action: { type: Type.NUMBER },
  },
  required: [
    "factors",
    "overall_impression",
    "content_summary",
    "hook_strength",
    "emotional_resonance",
    "clarity",
    "originality",
    "call_to_action",
  ],
};

/**
 * Analyze content with Gemini Flash-Lite (ENGINE-01, ENGINE-08)
 * Uses structured output + Zod validation + retry logic
 */
export async function analyzeWithGemini(
  input: AnalysisInput
): Promise<{ analysis: GeminiAnalysis; cost_cents: number }> {
  const ai = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const prompt =
        attempt === 0
          ? `${ANALYSIS_PROMPT}\n\nContent type: ${input.content_type}\nContent:\n${input.content_text}`
          : `Your previous response was not valid JSON. Return ONLY the JSON object with no extra text.\n\n${ANALYSIS_PROMPT}\n\nContent type: ${input.content_type}\nContent:\n${input.content_text}`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          abortSignal: controller.signal,
        },
      });

      clearTimeout(timeout);

      const text = response.text ?? "";
      const analysis = parseGeminiResponse(text);

      // Estimate cost: ~1500 tokens in, ~500 tokens out for flash-lite
      const cost_cents = 0.001 * (attempt + 1);

      return { analysis, cost_cents };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === "AbortError") {
        throw new Error(`Gemini request timed out after ${TIMEOUT_MS}ms`);
      }
      // Retry on parse/validation errors
      if (attempt === MAX_RETRIES) break;
    }
  }

  throw new Error(
    `Gemini analysis failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

/**
 * Analyze image with Gemini Flash vision (ENGINE-15)
 */
export async function analyzeImageWithGemini(
  imageUrl: string,
  contentContext: string
): Promise<{ description: string; visual_score: number; cost_cents: number }> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this image as a thumbnail/visual for social media content. Context: ${contentContext}

Return JSON with:
- description: string describing visual elements, composition, and appeal
- visual_score: number 0-10 rating thumbnail effectiveness`,
          },
          {
            fileData: {
              fileUri: imageUrl,
              mimeType: "image/jpeg",
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  const cleaned = stripFences(text);
  const parsed = JSON.parse(cleaned);

  return {
    description: parsed.description ?? "",
    visual_score: Math.min(10, Math.max(0, Number(parsed.visual_score) || 5)),
    cost_cents: 0.002,
  };
}

export { GEMINI_MODEL };
