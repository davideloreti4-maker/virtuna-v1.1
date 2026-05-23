/**
 * Phase 13 Plan 02 — Stage 11 Counterfactuals (rebuilt D-01..D-06).
 *
 * Rebuilt from DeepSeek V4 Flash → Gemini 3.1 Pro (D-02).
 * Always-on: no overall_score >= 70 short-circuit (D-04).
 * Optional videoContext arg for fileUri threading (D-01 — Plan 03 passes real values).
 * Full signal context via buildSignalContextUserMessage (D-03 — no truncation).
 * Discriminated-union output schema per band (D-05).
 * Cost telemetry via calculateGeminiCost (D-10).
 */
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type { PredictionResult, CounterfactualResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { calculateCost } from "./qwen/cost";
import { getQwenClient, QWEN_REASONING_MODEL } from "./qwen/client";
import {
  STABLE_COUNTERFACTUALS_SYSTEM_PROMPT,
  buildSignalContextUserMessage,
  CounterfactualsResponseSchema,
} from "./stage11-counterfactuals-prompts";
import { stripModelOutput } from "./utils/strip";

const log = createLogger({ module: "stage11-counterfactuals" });

export const QWEN_STAGE11_MODEL = QWEN_REASONING_MODEL;

const PER_CALL_TIMEOUT_MS = 30_000;

/**
 * Pure-TS check (NOT model-generated). Appends a LIKELY_FLOP warning to
 * result.warnings[] when overall_score < 30 AND post-critique confidence > 0.70.
 * Uses POST-CRITIQUE confidence (PredictionResult.confidence after Stage 10 adjustment).
 */
export function maybeAppendLikelyFlopWarning(result: PredictionResult): void {
  const score = result.overall_score;
  const confidence = result.confidence;

  if (score < 30 && confidence > 0.70) {
    log.warn("LIKELY_FLOP detected", { score, confidence });
    result.warnings.push(
      "LIKELY_FLOP: This content scores below 30 with high confidence (>70%), " +
        "indicating strong consensus that it will underperform. Consider significant " +
        "revisions to the hook, structure, or platform targeting before publishing.",
    );
  }
}

/**
 * Phase 13 D-01..D-06 contract: always-on counterfactual generation via Gemini 3.1 Pro.
 *
 * Key invariants:
 * - NO overall_score >= 70 short-circuit (D-04)
 * - videoContext optional: Plan 02 passes null; Plan 03 threads real fileUri (D-01/D-18)
 * - Full signal context via buildSignalContextUserMessage, no truncation (D-03)
 * - Discriminated-union Zod schema per band (D-05): low=3 fix, mid=2+1, high=1+2-3
 * - Single retry on Zod failure; Sentry capture on second failure (PATTERN S7)
 * - Cost telemetry via calculateGeminiCost (D-10)
 */
export async function runStage11Counterfactuals(
  aggregateResult: PredictionResult,
  _videoContext: { fileUri: string; mimeType: string } | null,
  onEvent?: StageEventCallback,
): Promise<CounterfactualResult | null> {
  const start = emitStageStart(onEvent, "stage_11_counterfactuals", "post");
  let costCents = 0;

  const ai          = getQwenClient();
  const model       = QWEN_STAGE11_MODEL;
  const userMessage = buildSignalContextUserMessage(aggregateResult);

  let attempt   = 0;
  let lastError: Error | null = null;

  while (attempt <= 1) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      const extraInstruction = attempt > 0
        ? "\nIMPORTANT: Return ONLY raw JSON — no explanation, no markdown fences."
        : "";

      const completion = await ai.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: STABLE_COUNTERFACTUALS_SYSTEM_PROMPT + extraInstruction },
            { role: "user",   content: userMessage },
          ],
          response_format: { type: "json_object" },
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);

      costCents += calculateCost(model, completion.usage ?? undefined);

      const raw  = completion.choices[0]?.message?.content ?? "{}";
      const text = stripModelOutput(raw);

      let parsed: ReturnType<typeof CounterfactualsResponseSchema.safeParse>;
      try {
        parsed = CounterfactualsResponseSchema.safeParse(JSON.parse(text));
      } catch {
        parsed = { success: false, error: new Error("JSON parse failed") } as never;
      }

      if (!parsed.success) {
        lastError = new Error(
          `validation failed: ${"error" in parsed ? String(parsed.error) : "unknown"}`,
        );
        if (attempt === 0) { attempt++; continue; }
        throw lastError;
      }

      emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
        cost_cents: +costCents.toFixed(4),
        ok: true,
      });

      const data = parsed.data;
      return { band: data.band, suggestions: data.suggestions };

    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError" || attempt >= 1) break;
      attempt++;
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "stage_11_counterfactuals" } });
  emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
    cost_cents: +costCents.toFixed(4),
    ok: false,
    warning: lastError?.message,
  });
  return null;
}
