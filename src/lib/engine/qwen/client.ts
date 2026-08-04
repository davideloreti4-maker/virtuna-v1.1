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
// The platform runs on two models only: QWEN_OMNI_MODEL (the Wave 0 / audience-bake AUDIO
// sensor) + QWEN_REASONING_MODEL (everything else — text and video). See docs/MODEL-POLICY.md.
// Apollo reasoner model (the score-mode judge in deepseek.ts) — SCOPED separately from
// QWEN_REASONING_MODEL so Apollo can move independently of chat/decode/adapt/text-mode.
// Moved to 3.7-flash 2026-08-04 with the shared constant. ⚠️ Apollo is the ONE call that runs
// thinking ON with a `thinking_budget` (the reasoning moat); if 3.7-flash rejects or ignores
// those DashScope extensions, this is the constant to roll back, and it can move alone:
// QWEN_APOLLO_MODEL=qwen3.7-plus. Deaf on both, so no capability is lost either way.
export const QWEN_APOLLO_MODEL    = process.env.QWEN_APOLLO_MODEL    ?? "qwen3.7-flash";
