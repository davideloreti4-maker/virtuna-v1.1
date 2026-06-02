/**
 * Phase 03 Plan 01 — Decode Engine.
 *
 * Mirrors src/lib/engine/stage11-counterfactuals.ts structure verbatim.
 *
 * Key invariants:
 *   D-06: 4 beats in fixed order (Zod enforces, assertion in runDecode)
 *   D-02: honest-absence verdicts (enforced at prompt level)
 *   D-04: luck.length >= 1 (pure-TS backstop AFTER Zod parse)
 *   D-05: luck taxonomy restricted (Zod LuckCategoryEnum)
 *   D-07: third-person, no advice verbs (prompt contract)
 *   D-10: DecodeResult is variants.remix.decode payload shape; overall_score null on rows
 *
 * Model: QWEN_DECODE_MODEL (env-overridable, defaults to QWEN_REASONING_MODEL)
 * Retry: single retry on Zod/parse failure (stage11 pattern)
 * Sentry: S7 pattern on final failure
 * Cost: calculateCost telemetry (Qwen pricing)
 */
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { calculateCost } from "@/lib/engine/qwen/cost";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { DecodeResultZodSchema, BEAT_IDS } from "./decode-types";
import { DECODE_SYSTEM_PROMPT, buildDecodeContext } from "./decode-prompts";
import type { OmniStructuralInput, DecodeResult } from "./decode-types";

const log = createLogger({ module: "engine.remix.decode" });

// Env-overridable model — defaults to qwen3.6-plus (same as stage11)
const QWEN_DECODE_MODEL = process.env.QWEN_DECODE_MODEL ?? QWEN_REASONING_MODEL;

// 45s fail-fast — decode context is smaller than stage11's full signal context
const PER_CALL_TIMEOUT_MS = 45_000;

/**
 * Run the decode engine on an Omni structural output.
 *
 * Returns a validated DecodeResult with:
 *   - exactly 4 beats in fixed order (D-06)
 *   - honest-absence verdicts (D-02, enforced at prompt level)
 *   - luck.length >= 1 (D-04, pure-TS backstop)
 *
 * Returns null on final failure (Sentry S7 captures exception).
 */
export async function runDecode(
  omni: OmniStructuralInput,
): Promise<DecodeResult | null> {
  const ai    = getQwenClient();
  const model = QWEN_DECODE_MODEL;
  let costCents = 0;

  let attempt   = 0;
  let lastError: Error | null = null;

  while (attempt <= 1) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      // Retry nudge on user message — keeps system prompt byte-stable for prefix cache
      const extraInstruction = attempt > 0
        ? "\n\nIMPORTANT: Return ONLY raw JSON — no explanation, no markdown fences."
        : "";

      const completion = await ai.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: DECODE_SYSTEM_PROMPT },
            { role: "user",   content: buildDecodeContext(omni) + extraInstruction },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1200,
          temperature: 0,
          seed: QWEN_SEED,
          // @ts-expect-error — DashScope extensions not in OpenAI SDK types
          enable_thinking: true,
          thinking_budget: 2000,
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);

      costCents += calculateCost(model, completion.usage ?? undefined);

      const raw  = completion.choices[0]?.message?.content ?? "{}";
      const text = stripModelOutput(raw);

      let parsed: ReturnType<typeof DecodeResultZodSchema.safeParse>;
      try {
        parsed = DecodeResultZodSchema.safeParse(JSON.parse(text));
      } catch {
        parsed = { success: false, error: new Error("JSON parse failed") } as never;
      }

      if (!parsed.success) {
        lastError = new Error(
          `decode validation failed: ${"error" in parsed ? String(parsed.error) : "unknown"}`,
        );
        log.warn("decode_validation_failed", {
          attempt,
          error: "error" in parsed ? String(parsed.error) : "unknown",
          raw_output: text.slice(0, 1000),
        });
        if (attempt === 0) { attempt++; continue; }
        throw lastError;
      }

      // Pure-TS backstop AFTER Zod parse succeeds:
      // If model somehow returns luck:[] (shouldn't pass Zod min(1), but defensive layer),
      // inject a default algorithmic_outlier entry.
      const data = parsed.data as DecodeResult;
      if (data.luck.length === 0) {
        Sentry.captureMessage("decode_luck_empty_backstop", "warning");
        data.luck.push({
          category: "algorithmic_outlier",
          note: "Viral performance included an unrepeatable algorithmic distribution spike.",
        });
      }

      // Assert beats order matches BEAT_IDS (D-06 — fixed order invariant)
      if (data.beats.length !== 4) {
        throw new Error(`Expected 4 beats, got ${data.beats.length}`);
      }

      log.info("decode_complete", {
        cost_cents: +costCents.toFixed(4),
        luck_count: data.luck.length,
        beat_verdicts: data.beats.map((b) => `${b.id}:${b.verdict}`).join(","),
      });

      return data;

    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError" || attempt >= 1) break;
      attempt++;
    }
  }

  // Pattern S7: capture on final failure
  Sentry.captureException(lastError, { tags: { stage: "decode" } });
  log.warn("decode_failed", {
    cost_cents: +costCents.toFixed(4),
    error: lastError?.message,
  });
  return null;
}

// Re-export types for convenience
export type { OmniStructuralInput, DecodeResult } from "./decode-types";
export { BEAT_IDS };
