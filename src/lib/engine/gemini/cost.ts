/**
 * Phase 5 — Per-model Gemini cost helper.
 *
 * Source: extends gemini.ts:142-149 (single-model `calculateCost`) with per-model pricing.
 * Cited: ai.google.dev/gemini-api/docs/pricing as of 2026-05-18.
 *
 * PITFALL #9 (RESEARCH lines 554-573): Without per-model lookup, the hook (Pro) cost is
 * under-counted by ~13× vs Flash. This was the BLOCKING dependency for Plan 02 segment helpers.
 *
 * The legacy single-model helper in gemini.ts becomes a thin shim that pins GEMINI_MODEL
 * pricing so existing text + video legacy call sites (gemini.ts:357, gemini.ts:497)
 * stay byte-identical. See Task 2 in 05-01-PLAN.md.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "engine.gemini.cost" });

// Per-token rates ($/token), keyed by model name. Unknown models silently fall back to
// Flash preview pricing (NOT throws) so cost calc never raises — see threat T-5-01-05.
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview":  { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-pro-preview":    { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 }, // alias redirects to 3.1
  "gemini-3-flash-preview":  { input: 0.50 / 1_000_000,  output:  3.00 / 1_000_000 },
  "gemini-3.1-flash-lite":   { input: 0.25 / 1_000_000,  output:  1.50 / 1_000_000 },
  "gemini-2.5-flash":        { input: 0.15 / 1_000_000,  output:  0.60 / 1_000_000 }, // legacy text + video calls
};

// WR-01: Track which unknown models we've already warned about so we emit
// exactly ONE log per unknown model per process — repeated calls with the
// same unknown model do not spam the logger (a typical pipeline invocation
// fires 3 segment calls with the same model, and we want a single warning,
// not three).
const warnedUnknownModels = new Set<string>();

const FALLBACK_INPUT_TOKENS = 2000;
const FALLBACK_OUTPUT_TOKENS = 800;

/**
 * Per-model cost in cents from Gemini usageMetadata.
 * Returns Flash-preview pricing as safe default on unknown models (does NOT throw).
 *
 * WR-01: When `model` is not in `PRICING`, this still returns a number (the
 * Flash-preview rate) — never throws — but emits a one-time log.warn so
 * production cost under-counting is observable. RESEARCH Pitfall #9 warned
 * that without per-model lookup, Pro cost is under-counted by ~13× vs Flash;
 * the same applies in reverse when GEMINI_*_MODEL env vars flip to a model
 * not yet in this table.
 *
 * @param model — Gemini model ID (e.g. "gemini-3.1-pro-preview", "gemini-2.5-flash")
 * @param usageMetadata — `response.usageMetadata` from `@google/genai` SDK; may be undefined
 *                        if the API didn't return it (tokenizer fallback paths).
 * @returns cost in cents
 */
export function calculateCost(
  model: string,
  usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
): number {
  const knownRates = PRICING[model];
  if (!knownRates && !warnedUnknownModels.has(model)) {
    warnedUnknownModels.add(model);
    log.warn(
      "Unknown Gemini model — using gemini-3-flash-preview pricing as safe default; production cost may be under-counted if this is a Pro-tier model",
      { model },
    );
  }
  const rates = knownRates ?? PRICING["gemini-3-flash-preview"]!;
  const input = usageMetadata?.promptTokenCount ?? FALLBACK_INPUT_TOKENS;
  const output = usageMetadata?.candidatesTokenCount ?? FALLBACK_OUTPUT_TOKENS;
  return (input * rates.input + output * rates.output) * 100; // cents
}

/**
 * WR-01 — Test-only reset hook for the once-per-process warned-model set.
 * Exported so unit tests can assert the warning fires exactly once per unknown
 * model after a clean state. Production code MUST NOT call this.
 */
export function _resetCostWarnedModelsForTest(): void {
  warnedUnknownModels.clear();
}
