/**
 * SIM-1 Flash — runFlashTextMode (Plan 01-03 Task 2).
 *
 * Fires ONE bounded Qwen json_object call returning 10 per-persona verdicts + quotes.
 * Returns whole (no streaming) — P1 Pitfall #6 / A3.
 *
 * HARD ISOLATION (Pitfall #2):
 * This module imports ONLY from:
 *   - flash/* (flash-schema.ts, flash-prompts.ts)
 *   - wave3/persona-registry.ts (D-05 — data-driven personas)
 *   - qwen/client.ts (getQwenClient, QWEN_SEED, QWEN_FAST_MODEL)
 *   - utils/strip (stripModelOutput)
 * It MUST NOT import pipeline.ts, aggregator.ts, version.ts, or any wave3/fold*.ts.
 *
 * Call envelope mirrors runFold (wave3/fold.ts):
 *   getQwenClient + AbortController + temperature:0 + seed:QWEN_SEED +
 *   response_format:json_object + stripModelOutput → coerceFlashResponse → safeParse.
 * Model is resolved behind FLASH_MODEL env, defaulting to QWEN_FAST_MODEL (qwen3.6-flash).
 */

import { getQwenClient, QWEN_SEED, QWEN_FAST_MODEL } from "../qwen/client";
import { stripModelOutput } from "../utils/strip";
import {
  FlashResultSchema,
  coerceFlashResponse,
} from "./flash-schema";
import type { FlashResult } from "./flash-schema";
import {
  STABLE_FLASH_SYSTEM_PROMPT,
  buildFlashUserContent,
  buildNicheAwareSystemPrompt,
} from "./flash-prompts";
import type { FlashFraming, NichePanel } from "./flash-prompts";
import type { ContentTypeSlug } from "../types";

// Re-export FlashFraming and NichePanel so callers can import them from here
export type { FlashFraming, NichePanel };
// Re-export ContentTypeSlug for convenience (D-05 callers need it for the panel)
export type { ContentTypeSlug };

// ─── Model resolution (FLASH_MODEL env seam — Open Q1 / A2) ──────────────────
// FLASH_MODEL env lets the operator substitute a different flash model for testing.
// Defaults to QWEN_FAST_MODEL (qwen3.6-flash) — the flash-tier inference model.
// NOTE: the model label "sim1-flash" is a PRODUCT label (D-09/D-10); the underlying
// model is resolved here at the infrastructure layer.

const FLASH_MODEL = process.env.FLASH_MODEL ?? QWEN_FAST_MODEL;

// ─── Timeout (mirrors fold.ts PER_CALL_TIMEOUT_MS) ───────────────────────────
// Flash is a single bounded JSON call (~8–17s on flash models).
// 60s is generous; trim if needed for latency budget in future phases.

const PER_CALL_TIMEOUT_MS = 60_000;

// ─── FlashRunResult ──────────────────────────────────────────────────────────

export interface FlashRunResult {
  result: FlashResult;
  warnings: string[];
}

// ─── runFlashTextMode ────────────────────────────────────────────────────────

/**
 * Fire ONE bounded Qwen json_object call returning all 10 archetype persona
 * verdicts + quotes for the provided TEXT content.
 *
 * Mirrors the runFold bounded-call envelope:
 *   - getQwenClient (Qwen/DashScope OpenAI-compatible client)
 *   - AbortController timeout (PER_CALL_TIMEOUT_MS)
 *   - temperature:0 + seed:QWEN_SEED (determinism R8)
 *   - response_format: json_object
 *   - stripModelOutput → coerceFlashResponse → FlashResultSchema.safeParse
 *
 * @param content_text  The creator's text content to react to.
 * @param framing       Mode framing — swaps persona question + band verbiage (D-04).
 * @param panel         Optional niche panel (D-05, Plan 03-01). When present and panel.niche
 *                      is non-null, the system prompt is built via buildNicheAwareSystemPrompt,
 *                      folding selectPersonaSlots output into one niche-instantiated prompt.
 *                      When absent or panel.niche is null → byte-identical to STABLE_FLASH_SYSTEM_PROMPT
 *                      (back-compat; existing behavior unchanged).
 * @returns FlashRunResult with parsed FlashResult and any warnings.
 * @throws if the model response fails Zod validation after coercion.
 */
export async function runFlashTextMode(
  content_text: string,
  framing: FlashFraming,
  panel?: NichePanel,
): Promise<FlashRunResult> {
  const ai = getQwenClient();
  const warnings: string[] = [];

  // Resolve system prompt: niche-aware if a panel with a non-null niche is provided (D-05),
  // otherwise fall back to the byte-stable generic STABLE_FLASH_SYSTEM_PROMPT (back-compat).
  const systemPrompt =
    panel && panel.niche !== null
      ? buildNicheAwareSystemPrompt(panel)
      : STABLE_FLASH_SYSTEM_PROMPT;

  const callParams = {
    model: FLASH_MODEL,
    messages: [
      {
        role: "system" as const,
        content: systemPrompt, // byte-stable per {niche × contentType} tuple (D-17/D-05)
      },
      {
        role: "user" as const,
        content: buildFlashUserContent(content_text, framing),
      },
    ],
    response_format: { type: "json_object" as const },
  };

  // @ts-expect-error — temperature:0 + seed = reproducible results (R8, mirrors fold.ts)
  callParams.temperature = 0;
  // @ts-expect-error — seed pins residual nondeterminism (R8)
  callParams.seed = QWEN_SEED;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  let response;
  try {
    response = await ai.chat.completions.create(callParams as never, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    const isTimeout = error.name === "AbortError";
    throw new Error(
      isTimeout
        ? `runFlashTextMode: call aborted (timeout ${PER_CALL_TIMEOUT_MS}ms)`
        : `runFlashTextMode: call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  // ROBUST parse: stripModelOutput removes <think>/fences + extracts first balanced JSON
  const raw = response.choices[0]?.message?.content ?? "{}";
  const text = stripModelOutput(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`runFlashTextMode: JSON.parse failed on model output: ${text.slice(0, 200)}`);
  }

  // Coerce small-model sloppiness (bare array, verdict casing, fences) before Zod.
  const coerced = coerceFlashResponse(parsed);

  // Validate at the model boundary (T-04-01 pattern)
  const validated = FlashResultSchema.safeParse(coerced);
  if (!validated.success) {
    throw new Error(
      `runFlashTextMode: FlashResultSchema validation failed — ${validated.error.message}`,
    );
  }

  return { result: validated.data, warnings };
}
