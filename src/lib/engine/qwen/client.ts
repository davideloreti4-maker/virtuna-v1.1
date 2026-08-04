import OpenAI from "openai";

const DASHSCOPE_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

let client: OpenAI | null = null;

export function getQwenClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) throw new Error("Missing DASHSCOPE_API_KEY environment variable");
    // maxRetries:0 — every engine stage owns its own retry loop (+ circuit breaker on
    // deepseek). The SDK default (2) stacks on top of those manual loops → up to 6 HTTP
    // attempts on a single Omni call. Make the app the sole retry authority: predictable
    // latency tail + cost. (Audit A2.)
    client = new OpenAI({ apiKey, baseURL: DASHSCOPE_ENDPOINT, maxRetries: 0 });
  }
  return client;
}

/**
 * Fixed sampling seed for all scoring-critical LLM calls, paired with `temperature: 0`.
 * Together these make the engine reproducible: the same input yields the same score
 * run-to-run. This is the precondition for a trustworthy eval/weight-fit number — you
 * cannot separate model error from run-to-run sampling jitter if the scorer drifts
 * between runs. Greedy decoding (temp 0) is the primary lever; the seed pins any residual
 * nondeterminism (notably thinking-mode stages).
 */
export const QWEN_SEED = 7;

// Model ID constants — env-overridable, defaults to the agreed stack.
// Default flipped plus→flash 2026-06-06 (quick/20260605-engine-latency-quality-spine-ab):
// A/B-validated on 2 videos (easy + hard) — omni-flash HALVED the read (36→17s), held/
// improved the text substrate (richer verbatim, emotion_arc intact, correct flop detection
// on the weak-hook case) at ~5× lower GA cost. omni is the foundation the fold + Apollo
// both reason over → highest-leverage latency lever. Rollback: QWEN_OMNI_MODEL=qwen3.5-omni-plus.
export const QWEN_OMNI_MODEL      = process.env.QWEN_OMNI_MODEL      ?? "qwen3.5-omni-flash";
// Shared reasoning model (chat / decode / adapt / text-mode / fold / vision).
// Default 3.7-plus -> 3.7-FLASH 2026-08-04 (owner call): 3.7-flash is the same generation,
// accepts text + image + VIDEO (so every sighted call site keeps its capability), carries 1M
// context, and costs $0.03/$0.13 per M at ≤32K input against plus's $0.40/$1.60 — an order of
// magnitude. The audio boundary is unchanged and is the whole reason omni stays: 3.7-flash is
// DEAF, exactly like 3.7-plus was, so audio still enters only through QWEN_OMNI_MODEL above.
// ⚠️ The retired-flash note that used to sit here was about qwen3.6-FLASH, a previous
// generation: it was dropped in 2026-06-25 because plus held multi-output reactions (SIM
// candidates, fold personas) far more distinct. That risk does not transfer automatically to a
// newer model, but it is the thing to watch — the fold's diversity-collapse retry
// (FOLD_DIVERSITY_RETRY_TEMP) is the tripwire. Rollback: QWEN_REASONING_MODEL=qwen3.7-plus.
export const QWEN_REASONING_MODEL = process.env.QWEN_REASONING_MODEL ?? "qwen3.7-flash";
// The platform runs on two models plus TWO scoped holdouts (QWEN_APOLLO_MODEL and
// QWEN_CALIBRATE_MODEL below, both on 3.7-plus on live evidence): QWEN_OMNI_MODEL (the Wave 0 / audience-bake AUDIO
// sensor) + QWEN_REASONING_MODEL (everything else — text and video). See docs/MODEL-POLICY.md.
// Apollo reasoner model (the score-mode judge in deepseek.ts) — SCOPED separately from
// QWEN_REASONING_MODEL so Apollo can move independently of chat/decode/adapt/text-mode.
// ⚠️ Apollo STAYS ON 3.7-PLUS. It moved to flash with the shared constant on 2026-08-04 and was
// moved straight back the same hour, on evidence: `scripts/apollo-cite-harness.ts`, same video,
// same prompt, the two models back to back —
//     plus : composite 81 · cites [§2.1 §2.2 §2.3 §2.5] · 59.7s · 2.07¢
//     flash: composite 53 · cites NONE                  · 17.1s · 0.50¢
// Flash emits no §-cites at all: every lever comes back as generic prose ("contrast / curiosity
// gap") where plus grounds it in the knowledge core ("§2.1 rapid context + specificity"). That
// citation IS the product here — MODEL-POLICY calls Apollo "cited, framework-grounded expert
// judgment (the video moat)" — and the headline composite swings 28 points on one clip. The 3×
// speedup is the tell that the `thinking_budget` is not being spent. Apollo is the only call
// running thinking ON, which is why it is the only one that regressed.
// Cheap-to-run is not cheap if it stops answering the question. Rollback FORWARD (re-try flash)
// only behind a fresh harness run. Deaf on both, so this is about reasoning, not capability.
export const QWEN_APOLLO_MODEL    = process.env.QWEN_APOLLO_MODEL    ?? "qwen3.7-plus";
// CALIBRATE synth model (audience/enrich-signature) — SCOPED separately for the same reason
// Apollo is: it can be held back without pinning the rest of the platform.
// ⚠️ CALIBRATE STAYS ON 3.7-PLUS. Measured with `scripts/calibrate-synth-harness.ts` on a real
// 32-post @zachking payload, the byte-identical input to both models:
//     plus : 3/3 PASS · 52.6-56.5s · ~0.63¢ · Σshares 1.00 every run
//     flash: 0/7 PASS · ~20s · ~0.053¢ · Σshares 0.75-0.85, NEVER 1.0
// Flash breaks the two HARD invariants in SynthSchema, not the soft ones:
//   1. persona shares must sum to 1.0 (±0.02) — it emitted 0.75-0.85 in all 7 runs;
//   2. in 2 of 7 runs it also FLATTENED the shape, putting `personas`/`persona_weights` at the
//      top level instead of under `audience`.
// Both make `SynthSchema.safeParse` throw, and `defaultSynthesize` has NO retry — so
// calibration.ts:375 turns every bake into `{ error: "scrape_failed" }` AFTER the Apify scrape
// is already paid for, blaming the scrape for a synthesis failure. Note this is NOT the Apollo
// failure mode: CALIBRATE runs thinking OFF (enrich-signature.ts:391, D-01), so nothing here is
// about an unspent thinking_budget — flash simply cannot hold a 10-way constrained allocation.
// Its PROSE was fine (10 distinct creator-specific personas), which is exactly why only the
// live harness caught it. Rollback FORWARD (re-try flash) only behind a fresh harness run.
export const QWEN_CALIBRATE_MODEL = process.env.QWEN_CALIBRATE_MODEL ?? "qwen3.7-plus";
