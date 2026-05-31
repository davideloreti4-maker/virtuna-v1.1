/**
 * Phase 13 Plan 02 — Stage 11 Counterfactuals (rebuilt D-01..D-06).
 *
 * Model: Qwen reasoning (QWEN_REASONING_MODEL = qwen3.6-plus) via DashScope —
 * the pipeline is Qwen-only. (History: DeepSeek V4 Flash → Gemini 3.1 Pro → Qwen.)
 * Always-on: no overall_score >= 70 short-circuit (D-04).
 * Optional videoContext arg for fileUri threading (D-01 — Plan 03 passes real values).
 * Full signal context via buildSignalContextUserMessage (D-03 — no truncation).
 * Discriminated-union output schema per band (D-05).
 * Cost telemetry via calculateCost (Qwen pricing, D-10).
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

// 60s fail-fast. With the bounded thinking budget (2000) + max_tokens cap added to
// the call, stage11 lands ~30-35s single attempt — well under this ceiling, so the
// retry (which previously DOUBLED latency to ~113-158s when the unbounded-thinking
// call exceeded the timeout) effectively never fires on the happy path. The cap
// here is now a genuine fail-fast for a stuck call, not a near-finish guillotine.
const PER_CALL_TIMEOUT_MS = 60_000;

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
 * Phase 13 D-01..D-06 contract: always-on counterfactual generation via Qwen reasoning (qwen3.6-plus).
 *
 * Key invariants:
 * - NO overall_score >= 70 short-circuit (D-04)
 * - videoContext optional: Plan 02 passes null; Plan 03 threads real fileUri (D-01/D-18)
 * - Full signal context via buildSignalContextUserMessage, no truncation (D-03)
 * - Discriminated-union Zod schema per band (D-05): low=3 fix, mid=2+1, high=1+2-3
 * - Single retry on Zod failure; Sentry capture on second failure (PATTERN S7)
 * - Cost telemetry via calculateCost (Qwen pricing, D-10)
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

      // Measured E2E: stage11 set NO thinking config, so qwen3.6-plus defaulted to
      // thinking-mode ON + UNBOUNDED chain-of-thought → 90s+ single-attempt latency
      // (vs stage10's 41.6s WITH a 4000-token budget). Counterfactuals is signal-
      // grounded suggestion formatting, not novel reasoning, so a small budget is
      // ample. In-pattern with stage10 (4000) / pass2 (8000); 2000 here keeps the
      // creator-framework matching while bounding latency to ~30-35s. max_tokens
      // caps the final output (3-4 short suggestions, never long-form).
      const completion = await ai.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: STABLE_COUNTERFACTUALS_SYSTEM_PROMPT + extraInstruction },
            { role: "user",   content: userMessage },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1800,
          // @ts-expect-error — DashScope extensions not in OpenAI SDK types (enable_thinking + thinking_budget)
          enable_thinking: true,
          thinking_budget: 2000,
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
        // Diagnostic (board-fix #2): counterfactuals persisted null despite the
        // 30→60s timeout raise — the failure is schema validation, not timeout.
        // Log the raw model output + expected band so a re-run reveals exactly how
        // the model's shape diverges from the per-band discriminated union
        // (low=3 fix / mid=2 fix+1 reinforcement / high=1 stretch+2-3 reinforcement).
        const expectedScore = aggregateResult.overall_score ?? 0;
        const expectedBand =
          expectedScore >= 75 ? "high" : expectedScore >= 50 ? "mid" : "low";
        log.warn("counterfactuals_validation_failed", {
          attempt,
          expected_band: expectedBand,
          overall_score: expectedScore,
          error: "error" in parsed ? String(parsed.error) : "unknown",
          raw_output: text.slice(0, 2000),
        });
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
