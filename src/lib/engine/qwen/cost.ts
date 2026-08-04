import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "engine.qwen.cost" });

// Per-token rates ($/token). Unknown models fall back to qwen3.6-flash pricing — never throws.
// qwen3.5-omni-plus is free during preview; we track tokens at $0 so GA cost projection works.
const PRICING: Record<string, { input: number; output: number }> = {
  "qwen3.5-omni-plus":  { input: 0.00 / 1_000_000, output: 0.00 / 1_000_000 }, // preview: free
  "qwen3.5-omni-flash": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  "qwen3.6-plus":       { input: 0.40 / 1_000_000, output: 2.40 / 1_000_000 },
  // qwen3.7-plus (Apollo, 2026-06-11): current promo rate (limited-time 20% off:
  // input $0.5→$0.4, output $2.0→$1.6). Revert to $0.50/$2.00 when the promo ends.
  "qwen3.7-plus":       { input: 0.40 / 1_000_000, output: 1.60 / 1_000_000 },
  "qwen3.6-flash":      { input: 0.25 / 1_000_000, output: 1.50 / 1_000_000 },
  "qwen3-max":          { input: 1.20 / 1_000_000, output: 6.00 / 1_000_000 },
  "qwq-plus":           { input: 0.80 / 1_000_000, output: 2.40 / 1_000_000 },
};

/**
 * Models DashScope prices in CONTEXT-LENGTH BANDS rather than at one flat rate. The band is
 * chosen by the INPUT size and moves both rates together, so a long call is dearer per token in
 * both directions. Flat-rating one of these would understate every heavy call — and the heavy
 * calls here are exactly the ones that matter (the fold ships a video plus 10 personas × N
 * segments; Apollo ships a video plus its thinking budget).
 *
 * qwen3.7-flash (2026-08-04, the platform reasoning model): $0.03/$0.13 per M up to 32K input,
 * $0.10/$0.40 through 256K, $0.20/$0.80 through 1M.
 */
const TIERED_PRICING: Record<string, { maxInputTokens: number; input: number; output: number }[]> = {
  "qwen3.7-flash": [
    { maxInputTokens:  32_000, input: 0.03 / 1_000_000, output: 0.13 / 1_000_000 },
    { maxInputTokens: 256_000, input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
    { maxInputTokens: Infinity, input: 0.20 / 1_000_000, output: 0.80 / 1_000_000 },
  ],
};

const warnedUnknownModels = new Set<string>();

const FALLBACK_INPUT_TOKENS  = 2000;
const FALLBACK_OUTPUT_TOKENS = 800;

export function calculateCost(
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
): number {
  const input  = usage?.prompt_tokens     ?? FALLBACK_INPUT_TOKENS;
  const output = usage?.completion_tokens ?? FALLBACK_OUTPUT_TOKENS;
  // Banded models resolve FIRST — they are priced but absent from PRICING, so checking the flat
  // table alone would both mis-rate them and fire the unknown-model warning on the platform's
  // own default model.
  const band = TIERED_PRICING[model]?.find((t) => input <= t.maxInputTokens);
  const knownRates = band ?? PRICING[model];
  if (!knownRates && !warnedUnknownModels.has(model)) {
    warnedUnknownModels.add(model);
    log.warn("Unknown Qwen model — using qwen3.6-flash pricing as safe default", { model });
  }
  const rates = knownRates ?? PRICING["qwen3.6-flash"]!;
  return (input * rates.input + output * rates.output) * 100; // cents
}

export function _resetCostWarnedModelsForTest(): void {
  warnedUnknownModels.clear();
}
