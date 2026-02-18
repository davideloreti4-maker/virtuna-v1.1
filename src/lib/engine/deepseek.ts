import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createLogger } from "@/lib/logger";
import {
  DeepSeekResponseSchema,
  type AnalysisInput,
  type DeepSeekReasoning,
  type GeminiAnalysis,
  type RuleScoreResult,
  type TrendEnrichment,
} from "./types";

const log = createLogger({ module: "deepseek" });

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner";
const MAX_RETRIES = 2; // 3 total attempts
const TIMEOUT_MS = 45_000; // 45s — reasoning model produces longer outputs with CoT thinking tokens

// V3.2-reasoning pricing: $0.28/1M input tokens, $0.42/1M output tokens
const INPUT_PRICE_PER_TOKEN = 0.28 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 0.42 / 1_000_000;
const FALLBACK_INPUT_TOKENS = 3000; // Richer prompt = more input tokens
const FALLBACK_OUTPUT_TOKENS = 2000;

// Circuit breaker state (INFRA-03: exponential backoff with half-open)
interface CircuitBreakerState {
  status: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  nextRetryAt: number; // timestamp when half-open probe is allowed
  backoffIndex: number; // 0, 1, 2 -> maps to 1s, 3s, 9s
}

const BACKOFF_SCHEDULE_MS = [1_000, 3_000, 9_000]; // 1s, 3s, 9s exponential
const FAILURE_THRESHOLD = 3;

let breaker: CircuitBreakerState = {
  status: "closed",
  consecutiveFailures: 0,
  nextRetryAt: 0,
  backoffIndex: 0,
};

let client: OpenAI | null = null;

// Calibration data cache
interface DeepSeekCalibrationData {
  primary_kpis: {
    share_rate: {
      percentiles: { p50: number; p75: number; p90: number };
    };
    comment_rate: {
      percentiles: { p50: number; p75: number; p90: number };
    };
    save_rate: {
      percentiles: { p50: number; p75: number; p90: number };
    };
    weighted_engagement_score: {
      percentiles: { p50: number; p75: number; p90: number };
    };
  };
  virality_tiers: Array<{
    tier: number;
    label: string;
    score_range: number[];
    median_share_rate: number;
    median_comment_rate: number;
    median_save_rate: number;
  }>;
  viral_vs_average: {
    differentiators: Array<{
      factor: string;
      difference_pct: number;
      description: string;
    }>;
  };
  duration_analysis: {
    sweet_spot_by_weighted_score: {
      optimal_range_seconds: number[];
    };
  };
}

let cachedCalibration: DeepSeekCalibrationData | null = null;

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

/** Check if circuit breaker is open (INFRA-03: half-open probe support) */
function isCircuitOpen(): boolean {
  if (breaker.status === "closed") return false;
  if (breaker.status === "open") {
    if (Date.now() >= breaker.nextRetryAt) {
      // Transition to half-open: allow ONE probe request
      breaker.status = "half-open";
      return false;
    }
    return true;
  }
  // half-open: allow the probe through
  return false;
}

/** Record a failure and potentially open the circuit (INFRA-03: exponential backoff) */
function recordFailure(): void {
  breaker.consecutiveFailures++;
  if (
    breaker.status === "half-open" ||
    breaker.consecutiveFailures >= FAILURE_THRESHOLD
  ) {
    // Open the circuit with exponential backoff
    const backoffMs =
      BACKOFF_SCHEDULE_MS[breaker.backoffIndex] ??
      BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]!;
    breaker.status = "open";
    breaker.nextRetryAt = Date.now() + backoffMs;
    breaker.backoffIndex = Math.min(
      breaker.backoffIndex + 1,
      BACKOFF_SCHEDULE_MS.length - 1
    );
    log.warn("Circuit breaker OPEN", {
      next_retry_ms: backoffMs,
      backoff_level: breaker.backoffIndex,
    });
  }
}

/** Record a success — full reset to closed state (INFRA-03) */
function recordSuccess(): void {
  breaker = {
    status: "closed",
    consecutiveFailures: 0,
    nextRetryAt: 0,
    backoffIndex: 0,
  };
}

/** Strip markdown code fences from LLM output */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

/** Parse and validate DeepSeek response with Zod */
function parseDeepSeekResponse(raw: string): DeepSeekReasoning {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = DeepSeekResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`DeepSeek response validation failed: ${result.error.message}`);
  }
  return result.data;
}

/** Calculate cost in cents from token usage metadata */
function calculateDeepSeekCost(
  promptTokens: number | undefined,
  completionTokens: number | undefined
): number {
  const input = promptTokens ?? FALLBACK_INPUT_TOKENS;
  const output = completionTokens ?? FALLBACK_OUTPUT_TOKENS;
  return (input * INPUT_PRICE_PER_TOKEN + output * OUTPUT_PRICE_PER_TOKEN) * 100;
}

/** Load calibration data from JSON file, cached after first read */
async function loadCalibrationData(): Promise<DeepSeekCalibrationData> {
  if (cachedCalibration) return cachedCalibration;

  const calibrationPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "calibration-baseline.json"
  );
  const raw = await fs.readFile(calibrationPath, "utf-8");
  cachedCalibration = JSON.parse(raw) as DeepSeekCalibrationData;
  return cachedCalibration;
}

/**
 * Format Gemini analysis signals for DeepSeek consumption.
 * Strips numeric scores to prevent anchoring — passes only rationales and tips.
 */
function formatGeminiSignals(analysis: GeminiAnalysis): string {
  const sections: string[] = [];

  // Factor rationales and tips (no scores)
  sections.push("## Gemini Content Analysis (qualitative signals only)");
  for (const factor of analysis.factors) {
    sections.push(`\n**${factor.name}:**`);
    sections.push(`- Assessment: ${factor.rationale}`);
    sections.push(`- Improvement: ${factor.improvement_tip}`);
  }

  // Overall impression
  sections.push(`\n**Overall Impression:** ${analysis.overall_impression}`);

  // Content summary
  sections.push(`\n**Content Summary:** ${analysis.content_summary}`);

  // Video signals descriptions (if available)
  if (analysis.video_signals) {
    sections.push(`\n**Video Production Signals:**`);
    sections.push(`- Visual production quality: assessed`);
    sections.push(`- Hook visual impact: assessed`);
    sections.push(`- Pacing: assessed`);
    sections.push(`- Transition quality: assessed`);
    // Note: We include that video signals exist but strip the numeric values
    // The presence of video analysis context helps DeepSeek weight visual factors
  }

  return sections.join("\n");
}

/**
 * Build the DeepSeek prompt with 5-step CoT framework and calibration data.
 */
function buildDeepSeekPrompt(
  context: DeepSeekInput,
  calibration: DeepSeekCalibrationData
): string {
  const shareP = calibration.primary_kpis.share_rate.percentiles;
  const commentP = calibration.primary_kpis.comment_rate.percentiles;
  const saveP = calibration.primary_kpis.save_rate.percentiles;

  // Get top 5 viral differentiators
  const topDifferentiators = [...calibration.viral_vs_average.differentiators]
    .sort((a, b) => Math.abs(b.difference_pct) - Math.abs(a.difference_pct))
    .slice(0, 5);

  const durationSweet = calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds;

  // Gemini signals (no scores)
  const geminiSignals = formatGeminiSignals(context.gemini_analysis);

  // Rule context (names only, no scores)
  const matchedRuleNames = context.rule_result.matched_rules
    .map((r) => r.rule_name)
    .join(", ") || "None";

  const prompt = `## Your Task

You are an expert TikTok content strategist. Analyze the content below using the 5-step framework. Your reasoning is INTERNAL — the user only sees your final JSON output.

## 5-Step Reasoning Framework

### Step 1: Completion Analysis
Evaluate: Would viewers watch this to the end?
Consider: Hook strength, narrative tension, pacing, payoff anticipation, information drip.
Output: hook_effectiveness (0-10), retention_strength (0-10), completion_pct prediction.

### Step 2: Engagement Prediction
Evaluate: Would viewers take action?
Consider: Share triggers (relatability, identity signaling, "tag someone"), comment provocation (controversy, questions, relatable frustrations), save worthiness (reference value, tutorial quality, bookmark-worthy tips).
Output: shareability (0-10), comment_provocation (0-10), save_worthiness (0-10), share_pct/comment_pct/save_pct predictions.

### Step 3: Pattern Match
Compare this content against known viral patterns from the dataset:
- Loop structure (videos that naturally restart)
- Duet/stitch bait (content that invites responses)
- Trending sound alignment
- Hook-first structure (value in first 3 seconds)
- Emotional escalation pattern
- "Wait for it" payoff structure

Top viral differentiators from 7,321 analyzed TikTok videos:
${topDifferentiators.map((d) => `- ${d.factor}: ${d.description}`).join("\n")}

Duration sweet spot: ${durationSweet[0]}-${durationSweet[1]} seconds

Output: trend_alignment (0-10), originality (0-10).

### Step 4: Fatal Flaw Check
Identify any critical issues that would kill performance regardless of other factors:
- No clear hook in first 2 seconds
- Content too long for topic (>60s for simple content)
- Misleading hook that doesn't pay off
- Poor audio quality or no audio strategy
- Caption too long (>100 chars for non-educational content)
- Content that actively discourages sharing (controversial without being shareable)
Output: Array of warning strings (empty if no fatal flaws).

### Step 5: Final Scores & Predictions
Using steps 1-4, produce your final behavioral predictions with percentile context.
Reference these dataset benchmarks for percentile framing:
- Share rate: p50=${(shareP.p50 * 100).toFixed(2)}%, p75=${(shareP.p75 * 100).toFixed(2)}%, p90=${(shareP.p90 * 100).toFixed(2)}%
- Comment rate: p50=${(commentP.p50 * 100).toFixed(2)}%, p75=${(commentP.p75 * 100).toFixed(2)}%, p90=${(commentP.p90 * 100).toFixed(2)}%
- Save rate: p50=${(saveP.p50 * 100).toFixed(2)}%, p75=${(saveP.p75 * 100).toFixed(2)}%, p90=${(saveP.p90 * 100).toFixed(2)}%
Frame percentiles as "top X%" (e.g., p90 = "top 10%", p75 = "top 25%").

---

## Content to Analyze

Content type: ${context.input.content_type}
Content:
${context.input.content_text}

---

${geminiSignals}

---

## Rule Matches
Matched rules: ${matchedRuleNames}

## Trend Context
${context.trend_enrichment.trend_context}
${context.creator_context ? `\n${context.creator_context}` : ""}

---

## Output Format

Return a JSON object with exactly these fields:

{
  "behavioral_predictions": {
    "completion_pct": <number 0-100>,
    "completion_percentile": "<string, e.g. 'top 30%'>",
    "share_pct": <number 0-100>,
    "share_percentile": "<string>",
    "comment_pct": <number 0-100>,
    "comment_percentile": "<string>",
    "save_pct": <number 0-100>,
    "save_percentile": "<string>"
  },
  "component_scores": {
    "hook_effectiveness": <number 0-10>,
    "retention_strength": <number 0-10>,
    "shareability": <number 0-10>,
    "comment_provocation": <number 0-10>,
    "save_worthiness": <number 0-10>,
    "trend_alignment": <number 0-10>,
    "originality": <number 0-10>
  },
  "suggestions": [
    { "text": "<actionable advice>", "priority": "high"|"medium"|"low", "category": "<hook|content|format|timing|audio>" }
  ],
  "warnings": ["<fatal flaw string>"],
  "confidence": "high"|"medium"|"low"
}

Provide 3-5 suggestions. Warnings array should be empty if no fatal flaws found.
Set confidence based on signal availability: "high" if video + text + trends available, "medium" if text + some signals, "low" if limited context.`;

  return prompt;
}

export interface DeepSeekInput {
  input: AnalysisInput;
  gemini_analysis: GeminiAnalysis;
  rule_result: RuleScoreResult;
  trend_enrichment: TrendEnrichment;
  creator_context?: string;
}

/**
 * Reason with DeepSeek V3.2-reasoning (ENGINE-02, ENGINE-09, ENGINE-14)
 * Returns null if circuit breaker is open.
 *
 * Uses 5-step CoT framework with calibration data embedding.
 * Gemini signals passed without numeric scores to prevent anchoring.
 */
export async function reasonWithDeepSeek(
  context: DeepSeekInput
): Promise<{ reasoning: DeepSeekReasoning; cost_cents: number } | null> {
  // Circuit breaker check
  if (isCircuitOpen()) {
    return null;
  }

  const startTime = performance.now();
  const ai = getClient();
  const calibration = await loadCalibrationData();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const userMessage =
        attempt === 0
          ? buildDeepSeekPrompt(context, calibration)
          : `Your previous response was not valid JSON. Return ONLY the JSON object with no extra text.\n\n${buildDeepSeekPrompt(context, calibration)}`;

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

      // Token-based cost estimation
      const cost_cents = calculateDeepSeekCost(
        response.usage?.prompt_tokens,
        response.usage?.completion_tokens
      );

      if (cost_cents > 1.0) {
        log.warn("Reasoning cost exceeds soft cap", {
          cost_cents: +cost_cents.toFixed(4),
          soft_cap: 1.0,
        });
      }

      const duration_ms = Math.round(performance.now() - startTime);
      log.info("Reasoning complete", {
        stage: "deepseek_reasoning",
        duration_ms,
        cost_cents: +cost_cents.toFixed(4),
        model: DEEPSEEK_MODEL,
      });

      Sentry.addBreadcrumb({
        category: "engine.deepseek",
        message: "Reasoning complete",
        level: "info",
        data: { duration_ms, cost_cents: +cost_cents.toFixed(4), model: DEEPSEEK_MODEL },
      });

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
      // Exponential backoff: 1s, 3s
      const delay = attempt === 0 ? 1000 : 3000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  recordFailure();
  log.error("DeepSeek failed after retries", {
    attempts: MAX_RETRIES + 1,
    error: lastError?.message,
  });
  Sentry.captureException(lastError, {
    tags: { stage: "deepseek_reasoning" },
  });

  // Fallback: use Gemini to produce the same DeepSeekReasoning output
  log.warn("Falling back to Gemini for reasoning");
  return reasonWithGeminiFallback(context);
}

// Gemini Flash pricing for fallback cost tracking
const GEMINI_INPUT_PRICE_PER_TOKEN = 0.15 / 1_000_000;
const GEMINI_OUTPUT_PRICE_PER_TOKEN = 0.60 / 1_000_000;
const GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

/**
 * Fallback: run the same 5-step CoT reasoning prompt through Gemini Flash
 * when DeepSeek is unavailable. Returns the same DeepSeekReasoning shape
 * so the pipeline can't tell the difference.
 */
async function reasonWithGeminiFallback(
  context: DeepSeekInput
): Promise<{ reasoning: DeepSeekReasoning; cost_cents: number }> {
  const fallbackStart = performance.now();
  const ai = getGeminiClient();
  const calibration = await loadCalibrationData();
  const prompt = buildDeepSeekPrompt(context, calibration);

  const response = await ai.models.generateContent({
    model: GEMINI_FALLBACK_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  const reasoning = parseDeepSeekResponse(text);

  // Track cost using Gemini pricing
  const promptTokens = response.usageMetadata?.promptTokenCount ?? FALLBACK_INPUT_TOKENS;
  const candidateTokens = response.usageMetadata?.candidatesTokenCount ?? FALLBACK_OUTPUT_TOKENS;
  const cost_cents =
    (promptTokens * GEMINI_INPUT_PRICE_PER_TOKEN +
      candidateTokens * GEMINI_OUTPUT_PRICE_PER_TOKEN) *
    100;

  const fallbackDuration = Math.round(performance.now() - fallbackStart);
  log.info("DeepSeek->Gemini fallback complete", {
    duration_ms: fallbackDuration,
    cost_cents: +cost_cents.toFixed(4),
  });

  Sentry.addBreadcrumb({
    category: "engine.deepseek",
    message: "Gemini fallback reasoning complete",
    level: "info",
    data: {
      duration_ms: fallbackDuration,
      cost_cents: +cost_cents.toFixed(4),
      model: GEMINI_FALLBACK_MODEL,
    },
  });

  return { reasoning, cost_cents };
}

export { DEEPSEEK_MODEL, isCircuitOpen };
